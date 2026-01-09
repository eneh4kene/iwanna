import React, { useEffect } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, borderRadius, shadows } from '../../constants/theme';
import { getActivityEmoji } from '../../utils/activityEmojis';

interface StoryCircleProps {
  activity: string;
  category?: string;
  timeRemaining: string;
  hasNewMessage?: boolean;
  isUrgent?: boolean;
  onPress: () => void;
}

/**
 * Story Circle Component
 * Instagram-style circular pod preview
 * Shows activity emoji/icon with gradient border
 */
export const StoryCircle: React.FC<StoryCircleProps> = ({
  activity,
  category,
  timeRemaining,
  hasNewMessage = false,
  isUrgent = false,
  onPress,
}) => {
  const scale = useSharedValue(1);

  useEffect(() => {
    // Breathing animation
    scale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1500 }),
        withTiming(1.0, { duration: 1500 })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  // Get gradient colors based on state
  const getGradientColors = (): [string, string] => {
    if (hasNewMessage) {
      return [colors.accentGreen, colors.accentGreen]; // Green for new message
    }
    if (isUrgent) {
      return [colors.error, colors.error]; // Red for urgent
    }
    return [colors.primary, colors.primaryDark]; // Purple for normal
  };

  // Get activity emoji using smart mapper
  const getActivityDisplay = (): string => {
    return getActivityEmoji(activity, category);
  };

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <Pressable onPress={handlePress} style={({ pressed }) => [pressed && styles.pressed]}>
        <LinearGradient
          colors={getGradientColors()}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBorder}
        >
          <View style={styles.innerCircle}>
            <Text style={styles.emoji}>{getActivityDisplay()}</Text>
          </View>
        </LinearGradient>

        {/* Timer badge */}
        <View style={[styles.timeBadge, isUrgent && styles.timeBadgeUrgent]}>
          <Text style={[styles.timeText, isUrgent && styles.timeTextUrgent]}>
            {timeRemaining}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginRight: spacing.md,
  },

  pressed: {
    opacity: 0.7,
  },

  gradientBorder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },

  innerCircle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
  },

  emoji: {
    fontSize: 32,
  },

  timeBadge: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
    ...shadows.sm,
  },

  timeBadgeUrgent: {
    backgroundColor: colors.error + '20',
  },

  timeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },

  timeTextUrgent: {
    color: colors.error,
  },
});
