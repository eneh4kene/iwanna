import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SafeAreaView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, borderRadius, animation, shadows } from '../constants/theme';
import { usePodStore } from '../store/podStore';

type RouteParams = {
  PodMatched: {
    podId: string;
  };
};

type NavigationProp = NativeStackNavigationProp<any>;

/**
 * Sparkling Star Component
 */
const SparklingStar: React.FC<{ delay: number; size: number; top: string; left: string }> = ({
  delay,
  size,
  top,
  left,
}) => {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0);
  const rotate = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 800, easing: Easing.ease }),
          withTiming(0, { duration: 800, easing: Easing.ease })
        ),
        -1,
        false
      )
    );

    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withSpring(1, { damping: 10, stiffness: 100 }),
          withSpring(0, { damping: 10, stiffness: 100 })
        ),
        -1,
        false
      )
    );

    rotate.value = withDelay(
      delay,
      withRepeat(
        withTiming(360, { duration: 2000, easing: Easing.linear }),
        -1,
        false
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { scale: scale.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  return (
    <Animated.Text
      style={[
        styles.sparkle,
        {
          fontSize: size,
          top,
          left,
        },
        animatedStyle,
      ]}
    >
      ✨
    </Animated.Text>
  );
};

/**
 * Pod Matched Screen
 * Celebration screen when user gets matched into a pod
 */
export const PodMatchedScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProp<RouteParams, 'PodMatched'>>();
  const { podId } = route.params;

  const activePods = usePodStore((state) => state.activePods);
  const pod = activePods.find((p) => p.id === podId);

  // Animations
  const emojiScale = useSharedValue(0);
  const emojiOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(20);
  const cardOpacity = useSharedValue(0);
  const cardTranslateY = useSharedValue(30);
  const buttonScale = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    // Haptic feedback on mount
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Glow animation
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 1500 }),
        withTiming(0.1, { duration: 1500 })
      ),
      -1,
      false
    );

    // Sequence of animations
    // 1. Emoji appears with bounce
    emojiOpacity.value = withTiming(1, { duration: 300 });
    emojiScale.value = withSpring(1, { damping: 8, stiffness: 100 });

    // 2. Title fades in and slides up
    setTimeout(() => {
      titleOpacity.value = withTiming(1, { duration: 500 });
      titleTranslateY.value = withSpring(0, { damping: 15, stiffness: 90 });
    }, 300);

    // 3. Card fades in and slides up
    setTimeout(() => {
      cardOpacity.value = withTiming(1, { duration: 500 });
      cardTranslateY.value = withSpring(0, { damping: 15, stiffness: 90 });
    }, 600);

    // 4. Button appears with bounce
    setTimeout(() => {
      buttonOpacity.value = withTiming(1, { duration: 300 });
      buttonScale.value = withSpring(1, { damping: 10, stiffness: 100 });
    }, 900);

    // Start breathing animation for button after it appears
    setTimeout(() => {
      buttonScale.value = withRepeat(
        withSequence(
          withTiming(1.03, { duration: 1500 }),
          withTiming(1.0, { duration: 1500 })
        ),
        -1,
        false
      );
    }, 1200);
  }, []);

  const emojiAnimatedStyle = useAnimatedStyle(() => ({
    opacity: emojiOpacity.value,
    transform: [{ scale: emojiScale.value }],
  }));

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardTranslateY.value }],
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ scale: buttonScale.value }],
  }));

  const glowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  // Handle view pod
  const handleViewPod = (): void => {
    navigation.navigate('PodDetail', { podId });
  };

  if (!pod) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Pod not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Background glow */}
      <Animated.View style={[styles.glow, glowAnimatedStyle]} />

      {/* Sparkling stars */}
      <SparklingStar delay={0} size={24} top="15%" left="10%" />
      <SparklingStar delay={200} size={32} top="20%" left="80%" />
      <SparklingStar delay={400} size={20} top="35%" left="15%" />
      <SparklingStar delay={600} size={28} top="40%" left="85%" />
      <SparklingStar delay={800} size={24} top="60%" left="10%" />
      <SparklingStar delay={1000} size={32} top="65%" left="75%" />
      <SparklingStar delay={1200} size={20} top="80%" left="20%" />
      <SparklingStar delay={1400} size={28} top="85%" left="80%" />

      <View style={styles.content}>
        {/* Celebration emoji */}
        <Animated.Text style={[styles.emoji, emojiAnimatedStyle]}>
          🎉
        </Animated.Text>

        {/* Title */}
        <Animated.View style={titleAnimatedStyle}>
          <Text style={styles.title}>You've been matched!</Text>
          <Text style={styles.subtitle}>
            Found {pod.memberCount} {pod.memberCount === 1 ? 'person' : 'people'} who feel the same way
          </Text>
        </Animated.View>

        {/* Pod info card */}
        <Animated.View style={[styles.card, cardAnimatedStyle]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{pod.activity}</Text>
            <View style={styles.memberBadge}>
              <Text style={styles.memberBadgeText}>
                {pod.memberCount} {pod.memberCount === 1 ? 'member' : 'members'}
              </Text>
            </View>
          </View>

          <Text style={styles.category}>{pod.category.replace(/_/g, ' ')}</Text>

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Status</Text>
              <Text style={styles.infoValue}>
                {pod.status === 'forming' ? 'Forming' : 'Active'}
              </Text>
            </View>

            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Expires</Text>
              <Text style={styles.infoValue}>
                {new Date(pod.expiresAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* CTA Button */}
        <Animated.View style={[styles.buttonContainer, buttonAnimatedStyle]}>
          <Pressable
            onPress={handleViewPod}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.buttonText}>View Pod Details</Text>
          </Pressable>
        </Animated.View>

        {/* Dismiss hint */}
        <Animated.View style={titleAnimatedStyle}>
          <Text style={styles.dismissHint}>
            This pod expires in 3 hours
          </Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  glow: {
    position: 'absolute',
    top: '20%',
    left: '10%',
    right: '10%',
    height: 300,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    opacity: 0.2,
    transform: [{ scaleX: 2 }],
    zIndex: 0,
  },

  sparkle: {
    position: 'absolute',
    zIndex: 1,
  },

  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    zIndex: 2,
  },

  emoji: {
    fontSize: 80,
    marginBottom: spacing.xl,
  },

  title: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },

  subtitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.regular,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
    lineHeight: typography.lineHeight.relaxed * typography.fontSize.md,
  },

  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    ...shadows.lg,
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },

  cardTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    flex: 1,
  },

  memberBadge: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },

  memberBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  category: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    textTransform: 'capitalize',
    marginBottom: spacing.md,
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.text.disabled + '30',
  },

  infoItem: {
    flex: 1,
  },

  infoLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },

  infoValue: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },

  buttonContainer: {
    width: '100%',
  },

  button: {
    height: 56,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
  },

  buttonPressed: {
    backgroundColor: colors.primaryDark,
  },

  buttonText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },

  dismissHint: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.regular,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing.lg,
  },

  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },

  errorText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
});
