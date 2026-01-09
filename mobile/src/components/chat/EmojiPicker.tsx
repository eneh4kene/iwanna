import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, TextInput } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../constants/theme';

interface EmojiPickerProps {
  onSelectEmoji: (emoji: string) => void;
}

// Popular emoji categories
const EMOJI_CATEGORIES = {
  recent: ['😀', '😂', '❤️', '🔥', '👍', '✨', '🎉', '💯'],
  smileys: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔'],
  gestures: ['👋', '🤚', '🖐', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏'],
  objects: ['⌚', '📱', '📲', '💻', '⌨️', '🖥', '🖨', '🖱', '🖲', '🕹', '🗜', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽', '🎞', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙', '🎚', '🎛'],
  symbols: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐'],
  flags: ['🏳️', '🏴', '🏁', '🚩', '🏳️‍🌈', '🏳️‍⚧️', '🇺🇳', '🇦🇫', '🇦🇽', '🇦🇱', '🇩🇿', '🇦🇸', '🇦🇩', '🇦🇴', '🇦🇮', '🇦🇶', '🇦🇬', '🇦🇷', '🇦🇲', '🇦🇼', '🇦🇺', '🇦🇹', '🇦🇿', '🇧🇸', '🇧🇭', '🇧🇩', '🇧🇧', '🇧🇾', '🇧🇪', '🇧🇿'],
};

const ALL_EMOJIS = [
  ...EMOJI_CATEGORIES.recent,
  ...EMOJI_CATEGORIES.smileys,
  ...EMOJI_CATEGORIES.gestures,
  ...EMOJI_CATEGORIES.objects,
  ...EMOJI_CATEGORIES.symbols,
];

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelectEmoji }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<keyof typeof EMOJI_CATEGORIES>('recent');

  const filteredEmojis = searchQuery
    ? ALL_EMOJIS.filter((emoji) => emoji.includes(searchQuery))
    : EMOJI_CATEGORIES[selectedCategory];

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <TextInput
        style={styles.searchInput}
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search emojis..."
        placeholderTextColor={colors.text.disabled}
      />

      {/* Category Tabs */}
      {!searchQuery && (
        <View style={styles.categoryTabs}>
          {(Object.keys(EMOJI_CATEGORIES) as Array<keyof typeof EMOJI_CATEGORIES>).map((category) => (
            <Pressable
              key={category}
              onPress={() => setSelectedCategory(category)}
              style={({ pressed }) => [
                styles.categoryTab,
                selectedCategory === category && styles.categoryTabActive,
                pressed && styles.categoryTabPressed,
              ]}
            >
              <Text style={[
                styles.categoryTabText,
                selectedCategory === category && styles.categoryTabTextActive,
              ]}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Emoji Grid */}
      <FlatList
        data={filteredEmojis}
        numColumns={8}
        keyExtractor={(item, index) => `${item}-${index}`}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onSelectEmoji(item)}
            style={({ pressed }) => [
              styles.emojiButton,
              pressed && styles.emojiButtonPressed,
            ]}
          >
            <Text style={styles.emojiText}>{item}</Text>
          </Pressable>
        )}
        contentContainerStyle={styles.emojiGrid}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  searchInput: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
  },
  categoryTabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  categoryTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
  },
  categoryTabActive: {
    backgroundColor: colors.primary,
  },
  categoryTabPressed: {
    opacity: 0.7,
  },
  categoryTabText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  categoryTabTextActive: {
    color: '#FFFFFF',
  },
  emojiGrid: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  emojiButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  emojiButtonPressed: {
    backgroundColor: colors.primary + '30',
  },
  emojiText: {
    fontSize: 24,
  },
});

