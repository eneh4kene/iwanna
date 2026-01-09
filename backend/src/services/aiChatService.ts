import OpenAI from 'openai';
import { openaiConfig } from '../config';
import { logger } from '../utils/logger';

/**
 * AI Chat Service
 * Generates contextual AI messages for pod coordination
 */
class AiChatService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: openaiConfig.apiKey,
    });
  }

  /**
   * Generate an icebreaker message when pod is first formed
   */
  async generateIcebreaker(activity: string, memberCount: number, location?: string): Promise<string> {
    try {
      const prompt = this.buildIcebreakerPrompt(activity, memberCount, location);

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are @vibe, the AI social facilitator for iwanna pods.

CORE IDENTITY:
- You're a social lubricant, not a chatbot
- You reduce awkwardness and accelerate real-life meetups
- You're timing-aware and read the room
- You're invisible when things flow, present when things stall

PERSONALITY & VOICE:
- ALWAYS use lowercase (except proper nouns)
- Max 2 sentences per message (usually just 1)
- Active voice, present tense
- Use "we" not "you guys"
- 1 emoji max per message
- Sound like texting a friend, never corporate

RULES - NEVER:
- Say "I'm an AI assistant"
- Use phrases like "How can I help you?"
- Apologize or overexplain
- Be overly excited or formal
- Use multiple emojis

RULES - ALWAYS:
- Be actionable, not conversational
- Every message should have a clear next step
- Keep it short and genuine
- Sound warm but real

CONTEXT: This is Stage 1 (Pod Formation). Mental state: High anxiety, "who are these people?"
YOUR ROLE: Ice breaker. Prompt quick intros to get conversation started.

EXAMPLES:
✅ "hey! quick intros? who are you + what brought you here today?"
✅ "matched! drop a quick intro and let's make this happen"
❌ "Hello! I'm @vibe, your AI assistant here to help coordinate your meetup!"
❌ "Welcome everyone! I'm so excited to help you all connect!"`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 100,
        temperature: 0.9,
      });

      const message = completion.choices[0]?.message?.content?.trim();

      if (!message) {
        return this.getFallbackIcebreaker(activity, memberCount);
      }

      return message;
    } catch (error) {
      logger.error('Error generating icebreaker:', error);
      return this.getFallbackIcebreaker(activity, memberCount);
    }
  }

  /**
   * Generate a coordination suggestion message
   */
  async generateCoordinationSuggestion(
    activity: string,
    category: string,
    timeRemaining: number,
    confirmedCount: number,
    totalCount: number
  ): Promise<string | null> {
    try {
      // Only send coordination message if:
      // 1. Less than 2 hours remaining
      // 2. Not everyone has confirmed
      // 3. At least 1 person confirmed
      if (timeRemaining > 120 || confirmedCount === 0 || confirmedCount === totalCount) {
        return null;
      }

      const prompt = this.buildCoordinationPrompt(
        activity,
        category,
        timeRemaining,
        confirmedCount,
        totalCount
      );

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are @vibe, the AI social facilitator for iwanna pods.

CORE IDENTITY:
- Social lubricant helping strangers connect IRL
- Timing-aware and reads the room
- Actionable, never just conversational

PERSONALITY & VOICE:
- lowercase only (except proper nouns)
- Max 1-2 sentences
- Active voice, present tense
- Use "we" not "you guys"
- Max 1 emoji per message
- Sound like a friend texting

CONTEXT: Stage 3 (Decision Making) or Stage 4 (Plan Lock-In)
Mental state: "Let's figure this out but nobody wants to be pushy"
YOUR ROLE: Decision facilitator or confirmation helper.

EXAMPLES:
✅ "so where are we thinking? anyone got a spot in mind?"
✅ "quick vibe check - coffee, food, or just walking around?"
✅ "locking it in: coffee at Blue Bottle, 3:15pm?"
❌ "I hope you all have a wonderful time coordinating your meetup!"
❌ "Please confirm your attendance so we can finalize the plans."`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 80,
        temperature: 0.7,
      });

      const message = completion.choices[0]?.message?.content?.trim();
      return message || null;
    } catch (error) {
      logger.error('Error generating coordination message:', error);
      return null;
    }
  }

  /**
   * Generate a venue suggestion based on activity and location
   */
  async generateVenueSuggestion(
    activity: string,
    category: string,
    locationName?: string
  ): Promise<string | null> {
    try {
      const prompt = this.buildVenueSuggestionPrompt(activity, category, locationName);

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are @vibe, the AI social facilitator for iwanna pods.

CORE IDENTITY:
- You help groups find good spots to meet
- You're practical and specific, never vague

PERSONALITY & VOICE:
- lowercase only
- 1 sentence max
- Active voice
- Sound like a friend with local knowledge

CONTEXT: Stage 3 (Decision Making). Group needs location ideas.
YOUR ROLE: Suggest specific venue types based on their activity.

EXAMPLES:
✅ "try a local coffee shop with outdoor seating - good for chatting"
✅ "find a park with basketball courts nearby"
✅ "hit up a casual spot that does small plates - easy to share"
❌ "I recommend finding a suitable establishment in your area."
❌ "There are many wonderful options available for your activity!"`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 70,
        temperature: 0.7,
      });

      const message = completion.choices[0]?.message?.content?.trim();
      return message || null;
    } catch (error) {
      logger.error('Error generating venue suggestion:', error);
      return null;
    }
  }

  /**
   * Generate a safety reminder for first-time meetups
   */
  async generateSafetyReminder(): Promise<string> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are @vibe, the AI social facilitator for iwanna pods.

CORE IDENTITY:
- You care about user safety
- You're a friend looking out for the group

PERSONALITY & VOICE:
- lowercase only
- 1 sentence max
- Warm but not preachy or parental
- Sound caring but casual

CONTEXT: First-time meetup between strangers
YOUR ROLE: Quick safety reminder without killing the vibe

EXAMPLES:
✅ "quick reminder: meet in a public place and let someone know where you're going 👋"
✅ "stay safe - pick a public spot and tell a friend where you'll be"
✅ "meet somewhere public and share your plans with someone you trust ✨"
❌ "For your safety, it is recommended that you meet in a well-populated area."
❌ "Please be careful and make sure to take all necessary safety precautions!"`,
          },
          {
            role: 'user',
            content: 'Generate a brief, friendly safety reminder for people meeting up for the first time.',
          },
        ],
        max_tokens: 60,
        temperature: 0.6,
      });

      const message = completion.choices[0]?.message?.content?.trim();
      return message || this.getFallbackSafetyReminder();
    } catch (error) {
      logger.error('Error generating safety reminder:', error);
      return this.getFallbackSafetyReminder();
    }
  }

  /**
   * Generate a contextual response when @vibe is mentioned
   */
  async generateMentionResponse(
    userMessage: string,
    username: string,
    activity: string,
    recentMessages?: Array<{ username: string; content: string }>
  ): Promise<string> {
    try {
      const prompt = this.buildMentionResponsePrompt(
        userMessage,
        username,
        activity,
        recentMessages
      );

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are @vibe, the AI social facilitator for iwanna pods.

CORE IDENTITY:
- You're a social lubricant, not a chatbot
- You reduce awkwardness and accelerate IRL meetups
- You read the room and respond contextually
- You're helpful but never pushy

PERSONALITY & VOICE:
- ALWAYS use lowercase (except proper nouns)
- Max 2 sentences per message
- Active voice, present tense
- Use "we" not "you guys"
- 1 emoji max per message
- Sound like a friend texting, never corporate

RULES - NEVER:
- Say "I'm an AI" or mention being artificial
- Use phrases like "How can I help you?"
- Apologize or overexplain
- Be overly excited ("So excited!" "Amazing!")
- Use corporate language
- Use multiple emojis

RULES - ALWAYS:
- Be actionable with clear next steps
- Keep it genuine and real
- Match the energy of the conversation
- Offer specific help, not vague assistance
- Stay casual and warm

CONTEXT: You've been @mentioned in the pod chat. Someone needs help.
YOUR ROLE: Respond helpfully to their specific question or request.

RESPONSE PATTERNS:
Location questions → Point to map or suggest flexibility
Time questions → Reference countdown, encourage coordination
Decision paralysis → Offer 2-3 specific options
General help → Ask what they need specifically
Logistics → Provide practical next step

EXAMPLES:
✅ "meeting point's on the map 📍 but feel free to pick a better spot if you all agree"
✅ "check the countdown up top ⏱️ and just coordinate when you're all ready"
✅ "honestly just go with what feels right 🌟 chat it out and see where the vibe takes you"
❌ "I'm here to assist you with any questions or concerns you may have!"
❌ "I apologize for any confusion. Let me help you figure this out!"`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 120,
        temperature: 0.9,
      });

      const message = completion.choices[0]?.message?.content?.trim();

      if (!message) {
        return this.getFallbackMentionResponse(userMessage);
      }

      return message;
    } catch (error) {
      logger.error('Error generating mention response:', error);
      return this.getFallbackMentionResponse(userMessage);
    }
  }

  /**
   * Build prompt for icebreaker message
   */
  private buildIcebreakerPrompt(
    activity: string,
    memberCount: number,
    location?: string
  ): string {
    const locationText = location ? ` near ${location}` : '';
    return `Write a welcoming icebreaker for ${memberCount} people who just matched to ${activity}${locationText}. Encourage them to say hi and coordinate.`;
  }

  /**
   * Build prompt for coordination message
   */
  private buildCoordinationPrompt(
    activity: string,
    _category: string,
    timeRemaining: number,
    confirmedCount: number,
    totalCount: number
  ): string {
    const hoursRemaining = Math.floor(timeRemaining / 60);
    const minsRemaining = timeRemaining % 60;
    const timeText = hoursRemaining > 0 ? `${hoursRemaining}h ${minsRemaining}m` : `${minsRemaining} minutes`;

    return `${confirmedCount} of ${totalCount} people confirmed for ${activity}. ${timeText} left. Write a friendly nudge encouraging the others to confirm.`;
  }

  /**
   * Build prompt for venue suggestion
   */
  private buildVenueSuggestionPrompt(
    activity: string,
    category: string,
    locationName?: string
  ): string {
    const locationText = locationName ? ` near ${locationName}` : '';
    return `Suggest a good type of venue for ${activity} (${category})${locationText}. Be specific about place types.`;
  }

  /**
   * Build prompt for @vibe mention response
   */
  private buildMentionResponsePrompt(
    userMessage: string,
    username: string,
    activity: string,
    recentMessages?: Array<{ username: string; content: string }>
  ): string {
    let contextText = '';
    if (recentMessages && recentMessages.length > 0) {
      const chatContext = recentMessages
        .map((msg) => `${msg.username}: ${msg.content}`)
        .join('\n');
      contextText = `\n\nRecent chat:\n${chatContext}`;
    }

    return `${username} is asking you: "${userMessage}"\n\nContext: The group is meeting up to ${activity}.${contextText}\n\nRespond naturally and helpfully as @vibe.`;
  }

  /**
   * Fallback icebreaker messages
   */
  private getFallbackIcebreaker(activity: string, memberCount: number): string {
    const icebreakers = [
      `yo! ${memberCount} of you matched to ${activity} ✨ say hi and let\'s make this happen`,
      `${memberCount} people, same vibe: ${activity}. who\'s down? 🌟`,
      `matched! you all wanna ${activity}. drop a message and figure out the deets`,
      `alright, ${memberCount} people ready to ${activity}... this is gonna be fun 👋`,
      `${activity}? hell yeah. ${memberCount} people in, let\'s coordinate`,
    ];

    const index = Math.floor(Math.random() * icebreakers.length);
    return icebreakers[index] as string;
  }

  /**
   * Fallback safety reminder
   */
  private getFallbackSafetyReminder(): string {
    return '👋 Quick reminder: meet in a public place and let someone know where you\'re going!';
  }

  /**
   * Fallback @vibe mention responses
   */
  private getFallbackMentionResponse(userMessage: string): string {
    const message = userMessage.toLowerCase();

    // Check for common questions/topics
    if (message.includes('where') || message.includes('location') || message.includes('place')) {
      return "meeting point\'s on the map 📍 but feel free to pick a better spot if you all agree";
    }

    if (message.includes('when') || message.includes('time')) {
      return "check the countdown up top ⏱️ and just coordinate when you\'re all ready to head out";
    }

    if (message.includes('idea') || message.includes('suggest')) {
      return "honestly just go with what feels right 🌟 chat it out and see where the vibe takes you";
    }

    if (message.includes('help')) {
      return "i\'m here! throw any questions at me about coordinating or whatever ✨";
    }

    // Default friendly response
    const defaults = [
      "yo! what\'s up? 👋",
      "here to help with whatever you need",
      "what\'s on your mind?",
      "ready when you are 🚀",
    ];

    const index = Math.floor(Math.random() * defaults.length);
    return defaults[index] as string;
  }

  /**
   * Check if AI service is available
   */
  isAvailable(): boolean {
    return !!openaiConfig.apiKey && openaiConfig.apiKey !== 'sk-test-placeholder';
  }
}

export const aiChatService = new AiChatService();
