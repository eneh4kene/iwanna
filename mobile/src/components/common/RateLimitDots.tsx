import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, borderRadius, shadows } from '../../constants/theme';

interface RateLimitDotsProps {
  used: number;
  total: number;
  tierName?: string;
}

/**
 * Rate Limit Dots Component
 * Gamified progress indicator showing wannas remaining
 * Tap to see explanation tooltip
 */
export const RateLimitDots: React.FC<RateLimitDotsProps> = ({
  used,
  total,
  tierName = 'anonymous',
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const scale = useSharedValue(1);

  const remaining = total - used;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSpring(1.1, { damping: 10 });
    setTimeout(() => {
      scale.value = withSpring(1.0, { damping: 10 });
    }, 100);
    setShowTooltip(true);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <>
      <Animated.View style={animatedStyle}>
        <Pressable onPress={handlePress} style={styles.container}>
          {Array.from({ length: total }).map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index < used ? styles.dotUsed : styles.dotRemaining,
              ]}
            >
              <Text style={styles.dotIcon}>
                {index < used ? '⚡️' : '🔒'}
              </Text>
            </View>
          ))}
        </Pressable>
      </Animated.View>

      {/* Tooltip Modal */}
      <Modal
        visible={showTooltip}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTooltip(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowTooltip(false)}
        >
          <View style={styles.tooltip}>
            <Text style={styles.tooltipTitle}>
              {remaining} more vibe{remaining !== 1 ? 's' : ''} to unlock today!
            </Text>
            <Text style={styles.tooltipText}>
              {tierName === 'anonymous'
                ? 'Upgrade your account to create more wannas daily'
                : 'Your daily wannas will reset tomorrow'}
            </Text>
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },

  dot: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },

  dotUsed: {
    opacity: 1,
  },

  dotRemaining: {
    opacity: 0.4,
  },

  dotIcon: {
    fontSize: 16,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 60,
    paddingRight: spacing.lg,
  },

  tooltip: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    maxWidth: 280,
    ...shadows.lg,
  },

  tooltipTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },

  tooltipText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.regular,
    color: colors.text.secondary,
    lineHeight: typography.lineHeight.relaxed * typography.fontSize.sm,
  },
});
