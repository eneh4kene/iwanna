import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  Keyboard,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, borderRadius, shadows } from '../constants/theme';
import { usePodStore, Pod } from '../store/podStore';

type RouteParams = {
  PostPodFeedback: {
    podId: string;
  };
};

type NavigationProp = NativeStackNavigationProp<any>;

interface EmojiReaction {
  emoji: string;
  label: string;
  rating: number; // 1-5 star equivalent
}

const REACTIONS: EmojiReaction[] = [
  { emoji: '🔥', label: 'it was fire', rating: 5 },
  { emoji: '😊', label: 'good time', rating: 4 },
  { emoji: '😐', label: 'just ok', rating: 2 },
  { emoji: '👎', label: 'not great', rating: 1 },
];

/**
 * Emoji Reaction Button
 */
const EmojiButton: React.FC<{
  reaction: EmojiReaction;
  onPress: () => void;
}> = ({ reaction, onPress }) => {
  const scale = useSharedValue(1);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Bounce animation
    scale.value = withSequence(
      withSpring(1.3, { damping: 10 }),
      withSpring(1.0, { damping: 10 })
    );

    setTimeout(onPress, 200); // Delay to show animation
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable onPress={handlePress} style={styles.emojiButton}>
        <Text style={styles.emoji}>{reaction.emoji}</Text>
        <Text style={styles.emojiLabel}>{reaction.label}</Text>
      </Pressable>
    </Animated.View>
  );
};

/**
 * Post-Pod Feedback Screen
 * Bottom sheet with emoji reactions for quick feedback
 */
export const PostPodFeedbackScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProp<RouteParams, 'PostPodFeedback'>>();
  const { podId } = route.params;

  const activePods = usePodStore((state) => state.activePods);
  const submitFeedback = usePodStore((state) => state.submitFeedback);

  const [pod, setPod] = useState<Pod | null>(null);
  const [selectedReaction, setSelectedReaction] = useState<EmojiReaction | null>(null);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const slideAnim = useSharedValue(300);
  const overlayOpacity = useSharedValue(0);

  // Find the pod from store
  useEffect(() => {
    const foundPod = activePods.find((p) => p.id === podId);
    setPod(foundPod || null);
  }, [podId, activePods]);

  // Slide up animation on mount
  useEffect(() => {
    slideAnim.value = withSpring(0, { damping: 20 });
    overlayOpacity.value = withTiming(1, { duration: 300 });
  }, []);

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideAnim.value }],
  }));

  const animatedOverlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value * 0.5,
  }));

  // Handle reaction selection
  const handleReactionPress = async (reaction: EmojiReaction): Promise<void> => {
    setSelectedReaction(reaction);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Auto-submit if no note is needed
    if (!showNoteInput) {
      await submitReaction(reaction, undefined);
    }
  };

  // Submit feedback
  const submitReaction = async (reaction: EmojiReaction, note?: string): Promise<void> => {
    setIsSubmitting(true);

    try {
      await submitFeedback(
        podId,
        true, // Showed up (implied by giving reaction)
        reaction.rating,
        note || undefined
      );

      // Show success and dismiss
      slideAnim.value = withTiming(300, { duration: 200 });
      overlayOpacity.value = withTiming(0, { duration: 200 });

      setTimeout(() => {
        navigation.navigate('Home');
      }, 250);
    } catch (error) {
      Alert.alert('Oops', 'Failed to submit. Try again?');
      setIsSubmitting(false);
    }
  };

  // Handle adding note
  const handleAddNote = () => {
    Keyboard.dismiss();
    if (selectedReaction) {
      submitReaction(selectedReaction, comment.trim());
    }
  };

  // Handle skip
  const handleSkip = (): void => {
    slideAnim.value = withTiming(300, { duration: 200 });
    overlayOpacity.value = withTiming(0, { duration: 200 });
    setTimeout(() => navigation.navigate('Home'), 250);
  };

  // Handle backdrop press
  const handleBackdropPress = (): void => {
    handleSkip();
  };

  if (!pod) {
    return null; // Don't show anything if pod not found
  }

  return (
    <Modal transparent visible animationType="none">
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={handleBackdropPress}>
        <Animated.View style={[styles.overlay, animatedOverlayStyle]} />
      </Pressable>

      {/* Bottom Sheet */}
      <Animated.View style={[styles.sheet, animatedSheetStyle]}>
        {/* Handle bar */}
        <View style={styles.handleBar} />

        {/* Title */}
        <Text style={styles.title}>how was it?</Text>

        {/* Emoji Reactions */}
        {!showNoteInput && (
          <View style={styles.reactionsContainer}>
            {REACTIONS.map((reaction) => (
              <EmojiButton
                key={reaction.emoji}
                reaction={reaction}
                onPress={() => handleReactionPress(reaction)}
              />
            ))}
          </View>
        )}

        {/* Note Input (if adding note) */}
        {showNoteInput && selectedReaction && (
          <View style={styles.noteSection}>
            <Text style={styles.noteLabel}>add a note? (optional)</Text>
            <TextInput
              style={styles.noteInput}
              value={comment}
              onChangeText={setComment}
              placeholder="anything else to share?"
              placeholderTextColor={colors.text.tertiary}
              multiline
              maxLength={200}
              autoFocus
            />
            <Text style={styles.characterCount}>{comment.length}/200</Text>

            <Pressable
              onPress={handleAddNote}
              style={styles.submitNoteButton}
              disabled={isSubmitting}
            >
              <Text style={styles.submitNoteText}>
                {isSubmitting ? 'submitting...' : 'done'}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Add note option (if reaction selected but no note shown yet) */}
        {selectedReaction && !showNoteInput && (
          <Pressable onPress={() => setShowNoteInput(true)} style={styles.addNoteButton}>
            <Text style={styles.addNoteText}>+ add a note</Text>
          </Pressable>
        )}

        {/* Skip button */}
        <Pressable onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipButtonText}>skip for now</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
  },

  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.md,
    ...shadows.lg,
  },

  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: colors.text.disabled,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },

  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },

  reactionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },

  emojiButton: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary + '20',
    ...shadows.sm,
  },

  emoji: {
    fontSize: 40,
    marginBottom: spacing.xs,
  },

  emojiLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    textAlign: 'center',
  },

  noteSection: {
    marginBottom: spacing.lg,
  },

  noteLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },

  noteInput: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.regular,
    color: colors.text.primary,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: colors.primary + '20',
  },

  characterCount: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.regular,
    color: colors.text.tertiary,
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },

  submitNoteButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    ...shadows.md,
  },

  submitNoteText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },

  addNoteButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },

  addNoteText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary,
  },

  skipButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },

  skipButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.tertiary,
  },
});
