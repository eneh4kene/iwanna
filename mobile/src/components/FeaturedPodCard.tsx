/**
 * Featured Pod Card Component
 * Card shown in horizontal slider carousel
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { FeaturedPodWithVenue } from '../types/featuredPods';
import { colors, spacing, borderRadius, typography, shadows } from '../constants/theme';

interface FeaturedPodCardProps {
  featuredPod: FeaturedPodWithVenue;
  onPress: () => void;
}

export const FeaturedPodCard: React.FC<FeaturedPodCardProps> = ({ featuredPod, onPress }) => {
  // Format time
  const startsAt = new Date(featuredPod.startsAt);
  const timeString = startsAt.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  // Calculate "X hours away" or "X min away"
  const now = new Date();
  const minutesAway = Math.floor((startsAt.getTime() - now.getTime()) / 60000);
  const hoursAway = Math.floor(minutesAway / 60);

  let timeLabel = '';
  if (minutesAway < 0) {
    timeLabel = 'now';
  } else if (minutesAway < 60) {
    timeLabel = `${minutesAway}m`;
  } else {
    timeLabel = `${hoursAway}h`;
  }

  // Category emoji mapping
  const categoryEmoji: Record<string, string> = {
    food_social: '☕',
    sports: '⚽',
    entertainment: '🎤',
    conversation: '💬',
    outdoor: '🌳',
    fitness: '💪',
    creative: '🎨',
    music: '🎵',
    nightlife: '🌙',
  };

  const emoji = categoryEmoji[featuredPod.category] || '✨';

  // Sponsor tier badge color
  const tierColors =
    featuredPod.sponsorTier === 'premium'
      ? { start: '#FFD700', end: '#FFA500' } // Gold
      : featuredPod.sponsorTier === 'boost'
        ? { start: '#FF6B9D', end: '#C06C84' } // Pink
        : { start: '#667eea', end: '#764ba2' }; // Purple (featured)

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
    >
      <LinearGradient colors={[tierColors.start, tierColors.end]} style={styles.card}>
        {/* Venue logo/image overlay */}
        {featuredPod.imageUrl && (
          <Image source={{ uri: featuredPod.imageUrl }} style={styles.backgroundImage} blurRadius={2} />
        )}

        {/* Gradient overlay for text readability */}
        <LinearGradient
          colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']}
          style={styles.overlay}
        />

        {/* Content */}
        <View style={styles.content}>
          {/* Category emoji */}
          <View style={styles.emojiContainer}>
            <Text style={styles.emoji}>{emoji}</Text>
          </View>

          {/* Title */}
          <Text style={styles.title} numberOfLines={2}>
            {featuredPod.title}
          </Text>

          {/* Time */}
          <View style={styles.timeRow}>
            <Ionicons name="time-outline" size={14} color="#FFFFFF" />
            <Text style={styles.timeText}>
              {timeString} • {timeLabel}
            </Text>
          </View>

          {/* Attendee count */}
          <View style={styles.countRow}>
            <Ionicons name="people" size={16} color="#FFFFFF" />
            <Text style={styles.countText}>
              {featuredPod.currentCount}
            </Text>
            {featuredPod.currentCount >= featuredPod.maxCapacity * 0.8 && (
              <Text style={styles.hotLabel}>🔥</Text>
            )}
          </View>

          {/* Distance */}
          {featuredPod.distanceMiles && (
            <View style={styles.distanceRow}>
              <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.8)" />
              <Text style={styles.distanceText}>
                {featuredPod.distanceMiles < 1
                  ? `${(featuredPod.distanceMiles * 5280).toFixed(0)} ft`
                  : `${featuredPod.distanceMiles.toFixed(1)} mi`}
              </Text>
            </View>
          )}

          {/* Sponsor tier badge */}
          {featuredPod.sponsorTier === 'premium' && (
            <View style={styles.tierBadge}>
              <Text style={styles.tierBadgeText}>⭐</Text>
            </View>
          )}
        </View>
      </LinearGradient>
    </Pressable>
  );
};

const CARD_WIDTH = 140;
const CARD_HEIGHT = 180;

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    marginRight: spacing.sm,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  card: {
    flex: 1,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.md,
  },
  backgroundImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  content: {
    flex: 1,
    padding: spacing.sm,
    justifyContent: 'space-between',
  },
  emojiContainer: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: borderRadius.full,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 20,
  },
  title: {
    fontSize: 14,
    fontWeight: typography.fontWeight.bold,
    color: '#FFFFFF',
    lineHeight: 14 * 1.3,
    marginTop: spacing.xs,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  timeText: {
    fontSize: 12,
    fontWeight: typography.fontWeight.medium,
    color: '#FFFFFF',
    marginLeft: spacing.xs / 2,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs / 2,
  },
  countText: {
    fontSize: 14,
    fontWeight: typography.fontWeight.bold,
    color: '#FFFFFF',
    marginLeft: spacing.xs / 2,
  },
  hotLabel: {
    fontSize: 12,
    marginLeft: spacing.xs / 2,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs / 2,
  },
  distanceText: {
    fontSize: 11,
    fontWeight: typography.fontWeight.regular,
    color: 'rgba(255, 255, 255, 0.8)',
    marginLeft: spacing.xs / 2,
  },
  tierBadge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    backgroundColor: 'rgba(255, 215, 0, 0.3)',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.xs / 2,
    paddingVertical: 2,
  },
  tierBadgeText: {
    fontSize: 12,
  },
});
