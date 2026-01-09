import React, { useEffect } from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, spacing, borderRadius, shadows } from '../../constants/theme';

interface FloatingMoodButtonProps {
  selectedMood?: string;
  onPress: () => void;
}

/**
 * Floating Mood Button Component
 * Circular button that displays selected emoji
 * Cycles through moods on tap
 */
export const FloatingMoodButton: React.FC<FloatingMoodButtonProps> = ({
  selectedMood,
  onPress,
}) => {
  const scale = useSharedValue(1);
  const rotate = useSharedValue(0);

  // Handle press animation
  const handlePress = () => {
    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Scale + rotate animation
    scale.value = withSequence(
      withSpring(0.8, { damping: 10 }),
      withSpring(1.2, { damping: 10 }),
      withSpring(1.0, { damping: 10 })
    );

    rotate.value = withSequence(
      withTiming(180, { duration: 200 }),
      withTiming(0, { duration: 0 }) // Reset rotation
    );

    onPress();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          selectedMood && styles.buttonSelected,
        ]}
      >
        <Text style={styles.emoji}>{selectedMood || '😊'}</Text>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
  },

  buttonPressed: {
    opacity: 0.8,
  },

  buttonSelected: {
    backgroundColor: colors.primary + '20',
    borderWidth: 2,
    borderColor: colors.primary,
  },

  emoji: {
    fontSize: 28,
  },
});
