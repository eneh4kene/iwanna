/**
 * Featured Pods Slider Component
 * Horizontal carousel of featured pods (WhatsApp-story style)
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useFeaturedPodStore } from '../store/featuredPodStore';
import { FeaturedPodCard } from './FeaturedPodCard';
import { colors, spacing, typography } from '../constants/theme';
import { RootStackParamList } from '../navigation/types';

type NavigationProp = StackNavigationProp<RootStackParamList>;

interface FeaturedPodsSliderProps {
  latitude: number;
  longitude: number;
}

export const FeaturedPodsSlider: React.FC<FeaturedPodsSliderProps> = ({ latitude, longitude }) => {
  const navigation = useNavigation<NavigationProp>();
  const { nearbyFeaturedPods, isLoading, fetchNearbyFeaturedPods } = useFeaturedPodStore();

  // Fetch nearby featured pods on mount
  useEffect(() => {
    if (latitude && longitude) {
      fetchNearbyFeaturedPods(latitude, longitude);
    }
  }, [latitude, longitude]);

  // Navigate to featured pod detail
  const handlePodPress = (featuredPodId: string) => {
    navigation.navigate('FeaturedPodDetail', { featuredPodId });
  };

  // Loading state
  if (isLoading && nearbyFeaturedPods.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.loadingText}>Finding featured events nearby...</Text>
      </View>
    );
  }

  // No featured pods
  if (!isLoading && nearbyFeaturedPods.length === 0) {
    return null; // Hide slider if no featured pods
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Featured Today</Text>
        <Text style={styles.headerEmoji}>✨</Text>
      </View>

      {/* Horizontal Scroll View */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        decelerationRate="fast"
        snapToInterval={140 + spacing.sm} // Card width + margin
        snapToAlignment="start"
      >
        {nearbyFeaturedPods.map((featuredPod) => (
          <FeaturedPodCard
            key={featuredPod.id}
            featuredPod={featuredPod}
            onPress={() => handlePodPress(featuredPod.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  headerEmoji: {
    fontSize: 20,
    marginLeft: spacing.xs,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  loadingText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.regular,
    color: colors.text.secondary,
    marginLeft: spacing.sm,
  },
});
