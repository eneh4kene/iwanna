/**
 * Activity to Emoji Mapper
 * Maps activity categories to beautiful, modern emojis
 */

// Category to emoji mapping (from AI-parsed categories)
const CATEGORY_EMOJIS: Record<string, string> = {
  // Food & Social
  food_social: '☕',
  coffee: '☕',
  drinks: '🍻',
  dinner: '🍽️',
  lunch: '🥗',
  brunch: '🥞',

  // Sports & Fitness
  sports: '⚽',
  basketball: '🏀',
  football: '🏈',
  soccer: '⚽',
  tennis: '🎾',
  running: '🏃',
  gym: '💪',
  fitness: '🏋️',
  yoga: '🧘',
  hiking: '🥾',
  climbing: '🧗',
  swimming: '🏊',
  cycling: '🚴',

  // Entertainment
  entertainment: '🎬',
  movies: '🎬',
  concert: '🎵',
  music: '🎵',
  comedy: '😂',
  theater: '🎭',
  karaoke: '🎤',
  trivia: '🧠',
  gaming: '🎮',
  board_games: '🎲',

  // Creative
  creative: '🎨',
  art: '🎨',
  painting: '🖌️',
  drawing: '✏️',
  photography: '📸',
  writing: '✍️',
  craft: '🧵',

  // Outdoor
  outdoor: '🌳',
  park: '🌳',
  beach: '🏖️',
  camping: '⛺',
  picnic: '🧺',
  nature: '🌿',

  // Nightlife
  nightlife: '🌙',
  party: '🎉',
  club: '💃',
  bar: '🍸',

  // Learning & Work
  study: '📚',
  learning: '📖',
  coworking: '💻',
  coding: '👨‍💻',

  // Conversation
  conversation: '💬',
  chat: '💬',
  meetup: '👥',
  networking: '🤝',

  // Adventure
  adventure: '🗺️',
  explore: '🧭',
  travel: '✈️',
  roadtrip: '🚗',

  // Wellness
  wellness: '🧘',
  meditation: '🕉️',
  spa: '💆',

  // Shopping
  shopping: '🛍️',
  thrifting: '👗',

  // Pets
  pets: '🐕',
  dog_park: '🐕',

  // Default fallback
  default: '✨',
};

// Activity keywords to emoji mapping (for fuzzy matching)
const KEYWORD_EMOJIS: Record<string, string> = {
  // Food keywords
  pizza: '🍕',
  burger: '🍔',
  sushi: '🍣',
  taco: '🌮',
  ramen: '🍜',
  ice_cream: '🍦',
  dessert: '🍰',
  boba: '🧋',
  tea: '🍵',
  wine: '🍷',
  beer: '🍺',
  cocktail: '🍹',

  // Sports keywords
  skate: '🛹',
  surf: '🏄',
  ski: '⛷️',
  snowboard: '🏂',
  golf: '⛳',
  baseball: '⚾',
  volleyball: '🏐',

  // Entertainment keywords
  anime: '📺',
  netflix: '📺',
  podcast: '🎙️',
  dance: '💃',
  dj: '🎧',

  // Activity keywords
  cook: '👨‍🍳',
  bake: '🧁',
  garden: '🌱',
  fish: '🎣',
  book: '📚',
  read: '📖',
  walk: '🚶',
  jog: '🏃',
  bike: '🚴',

  // Social keywords
  chill: '😌',
  vibe: '✨',
  hangout: '🤙',
  talk: '💬',
};

/**
 * Get emoji for activity
 * Priority:
 * 1. Existing emoji in activity text
 * 2. Category match
 * 3. Keyword match
 * 4. Default ✨
 */
export function getActivityEmoji(activity: string, category?: string): string {
  if (!activity) return CATEGORY_EMOJIS.default;

  // 1. Check if activity already has an emoji
  const emojiRegex = /(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/gu;
  const existingEmojis = activity.match(emojiRegex);
  if (existingEmojis && existingEmojis.length > 0) {
    return existingEmojis[0];
  }

  // 2. Try category match (from AI parsing)
  if (category) {
    const categoryLower = category.toLowerCase();
    if (CATEGORY_EMOJIS[categoryLower]) {
      return CATEGORY_EMOJIS[categoryLower];
    }
  }

  // 3. Try keyword matching from activity text
  const activityLower = activity.toLowerCase();
  for (const [keyword, emoji] of Object.entries(KEYWORD_EMOJIS)) {
    if (activityLower.includes(keyword)) {
      return emoji;
    }
  }

  // 4. Try category emojis as fallback
  for (const [keyword, emoji] of Object.entries(CATEGORY_EMOJIS)) {
    if (activityLower.includes(keyword)) {
      return emoji;
    }
  }

  // 5. Default fallback
  return CATEGORY_EMOJIS.default;
}

/**
 * Get emoji for featured pod category
 */
export function getFeaturedPodEmoji(category: string): string {
  return CATEGORY_EMOJIS[category.toLowerCase()] || CATEGORY_EMOJIS.default;
}
