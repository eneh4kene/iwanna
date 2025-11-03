import OpenAI from 'openai';
import { openaiConfig } from '../config';
import { logger } from '../utils/logger';
import { Intent, LocationContext } from '../types';

/**
 * Result from intent parsing
 */
interface ParseIntentResult {
  intent: Intent;
  embedding: number[];
}

/**
 * AI Service for intent parsing and embeddings
 */
class AIService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: openaiConfig.apiKey,
    });
  }

  /**
   * Parse user's wanna text into structured intent using GPT-4
   */
  async parseIntent(
    rawInput: string,
    moodEmoji?: string,
    locationContext?: LocationContext
  ): Promise<ParseIntentResult> {
    try {
      // Build context-aware prompt
      const systemPrompt = `You are an intent parser for Iwanna, a social connection app.
Users express what they want to do right now to meet 2-4 people nearby.

Parse their input into structured JSON with these fields:
- activity: Main activity (lowercase, 1-3 words, e.g., "coffee", "hiking")
- category: One of: food_social, outdoors, creative, sports, conversation, entertainment, nightlife
- energyLevel: low, medium, or high
- socialPreference: intimate (2-3 people), small_group (3-5), open (flexible)
- timeSensitivity: now (within 1-2 hours), today (within 6 hours), flexible
- durationEstimate: Estimated minutes (30, 60, 90, 120, 180, 240)
- locationFlexibility: specific (exact venue), neighborhood (within 1 mile), city_wide (anywhere)
- venueType: Type of place if clear (cafe, bar, park, restaurant, gym, etc.)
- keywords: Array of 3-7 relevant matching keywords
- emotionalTone: One word describing the vibe (curious, energetic, relaxed, adventurous, etc.)
- confidence: 0-1 score of how confident you are in this parsing

Be conversational and natural. Interpret casual language. Default to medium energy and small_group if unclear.`;

      const userPrompt = `Input: "${rawInput}"
${moodEmoji ? `Mood: ${moodEmoji}` : ''}
${locationContext ? `Location context: ${locationContext.neighborhood}, ${locationContext.city}` : ''}

Parse this into structured intent JSON.`;

      const completion = await this.client.chat.completions.create({
        model: openaiConfig.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: openaiConfig.temperature,
        max_tokens: openaiConfig.maxTokens,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content returned from OpenAI');
      }

      const intentData = JSON.parse(content);

      // Generate embedding for semantic matching
      const embedding = await this.generateEmbedding(rawInput);

      logger.debug('Intent parsed successfully', {
        activity: intentData.activity,
        category: intentData.category,
        confidence: intentData.confidence,
      });

      return {
        intent: intentData as Intent,
        embedding,
      };
    } catch (error) {
      logger.error('AI parsing failed, using fallback', error);

      // Fallback to basic parsing if AI fails
      return this.basicFallbackParsing(rawInput, moodEmoji);
    }
  }

  /**
   * Generate semantic embedding for similarity matching
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.client.embeddings.create({
        model: openaiConfig.embeddingModel,
        input: text,
        dimensions: 1536,
      });

      const embedding = response.data[0]?.embedding;
      if (!embedding) {
        throw new Error('No embedding returned from OpenAI');
      }

      return embedding;
    } catch (error) {
      logger.error('Embedding generation failed', error);
      // Return zero vector as fallback
      return new Array(1536).fill(0);
    }
  }

  /**
   * Fallback parsing if AI fails (keyword-based)
   */
  private basicFallbackParsing(
    rawInput: string,
    _moodEmoji?: string
  ): ParseIntentResult {
    const lower = rawInput.toLowerCase();

    // Simple keyword detection
    let activity = 'hang out';
    let category: Intent['category'] = 'conversation';
    let venueType: string | undefined = undefined;

    if (lower.includes('coffee') || lower.includes('cafe')) {
      activity = 'coffee';
      category = 'food_social';
      venueType = 'cafe';
    } else if (lower.includes('drink') || lower.includes('bar') || lower.includes('beer')) {
      activity = 'drinks';
      category = 'nightlife';
      venueType = 'bar';
    } else if (lower.includes('food') || lower.includes('eat') || lower.includes('lunch') || lower.includes('dinner')) {
      activity = 'food';
      category = 'food_social';
      venueType = 'restaurant';
    } else if (lower.includes('walk') || lower.includes('hike') || lower.includes('run')) {
      activity = 'walk';
      category = 'outdoors';
      venueType = 'park';
    } else if (lower.includes('work') || lower.includes('study') || lower.includes('cowork')) {
      activity = 'cowork';
      category = 'conversation';
      venueType = 'cafe';
    } else if (lower.includes('game') || lower.includes('play')) {
      activity = 'gaming';
      category = 'entertainment';
    } else if (lower.includes('gym') || lower.includes('workout')) {
      activity = 'workout';
      category = 'sports';
      venueType = 'gym';
    }

    // Extract keywords
    const keywords = rawInput
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3)
      .slice(0, 7);

    const intent: Intent = {
      activity,
      category,
      energyLevel: 'medium',
      socialPreference: 'small_group',
      timeSensitivity: 'now',
      durationEstimate: 120,
      locationFlexibility: 'neighborhood',
      venueType,
      keywords: keywords.length > 0 ? keywords : [activity],
      emotionalTone: 'curious',
      confidence: 0.5, // Low confidence for fallback
    };

    return {
      intent,
      embedding: new Array(1536).fill(0), // Zero vector
    };
  }

  /**
   * Get suggestions for similar wannas (for UI autocomplete)
   */
  async getSuggestions(partialInput: string): Promise<string[]> {
    const commonWannas = [
      'I wanna grab coffee and chat',
      'I wanna go for a walk',
      'I wanna grab drinks',
      'I wanna explore the city',
      'I wanna brainstorm startup ideas',
      'I wanna play basketball',
      'I wanna try a new restaurant',
      'I wanna study together',
      'I wanna go to a museum',
      'I wanna watch the sunset',
      'I wanna workout at the gym',
      'I wanna play board games',
      'I wanna go hiking',
      'I wanna grab lunch',
    ];

    // Simple filter for MVP
    if (!partialInput || partialInput.length < 2) {
      return commonWannas.slice(0, 5);
    }

    return commonWannas
      .filter(w => w.toLowerCase().includes(partialInput.toLowerCase()))
      .slice(0, 5);
  }
}

export const aiService = new AIService();
