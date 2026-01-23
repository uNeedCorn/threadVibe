/**
 * Content Features Extraction
 *
 * 從貼文內容提取特徵，用於分析
 */

export interface ContentFeatures {
  char_count: number;
  has_emoji: boolean;
  emoji_count: number;
  hashtag_count: number;
  hashtags: string[];
  has_link: boolean;
  mention_count: number;
  mentions: string[];
}

// Emoji regex pattern (covers most common emoji ranges)
// Note: This is a simplified pattern, full emoji detection is very complex
const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2300}-\u{23FF}\u{2B50}\u{2934}-\u{2935}\u{3030}\u{303D}\u{3297}\u{3299}]/gu;

// Hashtag pattern (supports Chinese characters)
const HASHTAG_REGEX = /#([\w\u4e00-\u9fff\u3400-\u4dbf]+)/g;

// Mention pattern
const MENTION_REGEX = /@([\w.]+)/g;

// URL pattern
const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;

/**
 * Extract content features from post text
 */
export function extractContentFeatures(text: string | null | undefined): ContentFeatures {
  // Handle null/empty text
  if (!text || text.trim() === '') {
    return {
      char_count: 0,
      has_emoji: false,
      emoji_count: 0,
      hashtag_count: 0,
      hashtags: [],
      has_link: false,
      mention_count: 0,
      mentions: [],
    };
  }

  // Extract emojis
  const emojiMatches = text.match(EMOJI_REGEX) || [];
  const emojiCount = emojiMatches.length;

  // Extract hashtags (unique, lowercase)
  const hashtagMatches: string[] = [];
  let hashtagMatch;
  const hashtagRegex = new RegExp(HASHTAG_REGEX.source, 'g');
  while ((hashtagMatch = hashtagRegex.exec(text)) !== null) {
    const tag = hashtagMatch[1].toLowerCase();
    if (!hashtagMatches.includes(tag)) {
      hashtagMatches.push(tag);
    }
  }

  // Extract mentions (unique, lowercase)
  const mentionMatches: string[] = [];
  let mentionMatch;
  const mentionRegex = new RegExp(MENTION_REGEX.source, 'g');
  while ((mentionMatch = mentionRegex.exec(text)) !== null) {
    const mention = mentionMatch[1].toLowerCase();
    if (!mentionMatches.includes(mention)) {
      mentionMatches.push(mention);
    }
  }

  // Check for URLs
  const hasLink = URL_REGEX.test(text);

  return {
    char_count: text.length,
    has_emoji: emojiCount > 0,
    emoji_count: emojiCount,
    hashtag_count: hashtagMatches.length,
    hashtags: hashtagMatches,
    has_link: hasLink,
    mention_count: mentionMatches.length,
    mentions: mentionMatches,
  };
}

/**
 * Convert ContentFeatures to database update object
 * (flattens the structure for Supabase update)
 */
export function contentFeaturesToDbUpdate(features: ContentFeatures): Record<string, unknown> {
  return {
    char_count: features.char_count,
    has_emoji: features.has_emoji,
    emoji_count: features.emoji_count,
    hashtag_count: features.hashtag_count,
    hashtags: features.hashtags,
    has_link: features.has_link,
    mention_count: features.mention_count,
    mentions: features.mentions,
  };
}
