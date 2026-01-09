import React, { useEffect } from 'react';
import { Pressable, Text, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing, borderRadius, shadows } from '../../constants/theme';

interface PulsingButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}

/**
 * Pulsing Button Component
 * Gradient button with breathing animation and glow effect
 * Used for primary CTAs
 */
export const PulsingButton: React.FC<PulsingButtonProps> = ({
  title,
  onPress,
  disabled = false,
  style,
}) => {
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.6);

  useEffect(() => {
    if (!disabled) {
      // Breathing animation
      scale.value = withRepeat(
        withSequence(
          withTiming(1.02, { duration: 1500 }),
          withTiming(1.0, { duration: 1500 })
        ),
        -1,
        false
      );

      // Pulsing glow
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(1.0, { duration: 1500 }),
          withTiming(0.6, { duration: 1500 })
        ),
        -1,
        false
      );
    }
  }, [disabled]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    shadowOpacity: glowOpacity.value * 0.5,
  }));

  return (
    <Animated.View style={[styles.container, animatedStyle, style]}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          disabled && styles.buttonDisabled,
        ]}
      >
        <LinearGradient
          colors={
            disabled
              ? [colors.text.disabled, colors.text.disabled]
              : [colors.primary, colors.primaryDark]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <Text style={[styles.text, disabled && styles.textDisabled]}>
            {title}
          </Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 20,
    elevation: 8,
  },

  button: {
    height: 56,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },

  buttonPressed: {
    opacity: 0.9,
  },

  buttonDisabled: {
    opacity: 0.5,
  },

  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  text: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },

  textDisabled: {
    color: colors.text.secondary,
  },
});
