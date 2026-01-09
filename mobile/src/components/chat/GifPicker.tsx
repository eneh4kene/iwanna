import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, TextInput, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { colors, typography, spacing, borderRadius } from '../../constants/theme';

interface GifPickerProps {
  onSelectGif: (gifUrl: string, gifId?: string) => void;
}

interface GifItem {
  id: string;
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
}

// Placeholder - will integrate with Giphy API
const TRENDING_GIFS: GifItem[] = [
  {
    id: '1',
    url: 'https://media.giphy.com/media/3o7aCTPPm4OHfRLSH6/giphy.gif',
    thumbnailUrl: 'https://media.giphy.com/media/3o7aCTPPm4OHfRLSH6/giphy_s.gif',
    width: 480,
    height: 270,
  },
  {
    id: '2',
    url: 'https://media.giphy.com/media/l0MYC0LajbaPoEADu/giphy.gif',
    thumbnailUrl: 'https://media.giphy.com/media/l0MYC0LajbaPoEADu/giphy_s.gif',
    width: 480,
    height: 270,
  },
  {
    id: '3',
    url: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif',
    thumbnailUrl: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy_s.gif',
    width: 480,
    height: 270,
  },
];

export const GifPicker: React.FC<GifPickerProps> = ({ onSelectGif }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [gifs, setGifs] = useState<GifItem[]>(TRENDING_GIFS);
  const [isLoading, setIsLoading] = useState(false);

  // TODO: Integrate with Giphy API
  // useEffect(() => {
  //   if (searchQuery) {
  //     searchGifs(searchQuery);
  //   } else {
  //     fetchTrendingGifs();
  //   }
  // }, [searchQuery]);

  const handleSelectGif = (gif: GifItem): void => {
    onSelectGif(gif.url, gif.id);
  };

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <TextInput
        style={styles.searchInput}
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search GIFs..."
        placeholderTextColor={colors.text.disabled}
      />

      {/* GIF Grid */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={gifs}
          numColumns={2}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleSelectGif(item)}
              style={({ pressed }) => [
                styles.gifItem,
                pressed && styles.gifItemPressed,
              ]}
            >
              <Image
                source={{ uri: item.thumbnailUrl }}
                style={styles.gifThumbnail}
                contentFit="cover"
              />
            </Pressable>
          )}
          contentContainerStyle={styles.gifGrid}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  gifGrid: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  gifItem: {
    flex: 1,
    aspectRatio: 1,
    margin: spacing.xs,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  gifItemPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  gifThumbnail: {
    width: '100%',
    height: '100%',
  },
});

