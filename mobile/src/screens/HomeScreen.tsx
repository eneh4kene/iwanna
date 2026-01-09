import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, borderRadius, animation } from '../constants/theme';
import { useAuthStore } from '../store/authStore';
import { useWannaStore } from '../store/wannaStore';
import { FloatingMoodButton } from '../components/common/FloatingMoodButton';
import { PulsingButton } from '../components/common/PulsingButton';
import { RateLimitDots } from '../components/common/RateLimitDots';

const MOOD_EMOJIS = ['😎', '🤩', '🧠', '💬', '🎨', '🔥', '🌟', '✨'];

const WANNA_SUGGESTIONS = [
  'play football',
  'grab coffee',
  'go hiking',
  'watch a movie',
  'try that new restaurant',
  'hit the gym',
  'explore the city',
  'play basketball',
];

export const HomeScreen: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const createWanna = useWannaStore((state) => state.createWanna);
  const isCreating = useWannaStore((state) => state.isCreating);
  const remaining = useWannaStore((state) => state.remaining);

  const [text, setText] = useState('');
  const [selectedMood, setSelectedMood] = useState<string | undefined>();
  const [currentMoodIndex, setCurrentMoodIndex] = useState(0);
  const [animatedPlaceholder, setAnimatedPlaceholder] = useState('');
  const [currentSuggestionIndex, setCurrentSuggestionIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);
  const [showCursor, setShowCursor] = useState(true);

  // Breathing animation for button
  const buttonScale = useSharedValue(1);
  const buttonOpacity = useSharedValue(0.8);

  // Cursor blink effect
  useEffect(() => {
    if (text.length > 0) return; // Don't show cursor when user is typing

    const interval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 530); // Blink speed

    return () => clearInterval(interval);
  }, [text]);

  // Animated placeholder typing effect
  useEffect(() => {
    if (text.length > 0) {
      // User is typing, clear the animated placeholder
      setAnimatedPlaceholder('');
      return;
    }

    const currentSuggestion = WANNA_SUGGESTIONS[currentSuggestionIndex];
    let currentCharIndex = 0;
    let timeoutId: NodeJS.Timeout;

    const animate = () => {
      if (isTyping) {
        // Typing phase
        if (currentCharIndex <= currentSuggestion.length) {
          setAnimatedPlaceholder(currentSuggestion.slice(0, currentCharIndex));
          currentCharIndex++;
          timeoutId = setTimeout(animate, 80); // Typing speed
        } else {
          // Finished typing, wait then start deleting
          timeoutId = setTimeout(() => {
            setIsTyping(false);
            currentCharIndex = currentSuggestion.length;
            animate();
          }, 1500); // Pause before deleting
        }
      } else {
        // Deleting phase
        if (currentCharIndex >= 0) {
          setAnimatedPlaceholder(currentSuggestion.slice(0, currentCharIndex));
          currentCharIndex--;
          timeoutId = setTimeout(animate, 50); // Deleting speed (faster)
        } else {
          // Finished deleting, move to next suggestion
          timeoutId = setTimeout(() => {
            setIsTyping(true);
            setCurrentSuggestionIndex((prev) => (prev + 1) % WANNA_SUGGESTIONS.length);
          }, 500); // Pause before next suggestion
        }
      }
    };

    animate();

    return () => clearTimeout(timeoutId);
  }, [text, currentSuggestionIndex, isTyping]);

  useEffect(() => {
    if (text.length >= 3 && !isCreating) {
      // Start breathing animation
      buttonScale.value = withRepeat(
        withSequence(
          withTiming(1.02, { duration: 1500 }),
          withTiming(1.0, { duration: 1500 })
        ),
        -1,
        false
      );
      buttonOpacity.value = withTiming(1, { duration: 300 });
    } else {
      // Stop breathing
      buttonScale.value = withTiming(1);
      buttonOpacity.value = withTiming(0.8, { duration: 300 });
    }
  }, [text, isCreating]);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
    opacity: buttonOpacity.value,
  }));

  // Handle mood cycling
  const handleMoodCycle = () => {
    const nextIndex = (currentMoodIndex + 1) % MOOD_EMOJIS.length;
    setCurrentMoodIndex(nextIndex);
    setSelectedMood(MOOD_EMOJIS[nextIndex]);
  };

  // Calculate wannas used (for rate limit dots)
  const wannasUsed = user?.accountTier === 'anonymous'
    ? 5 - remaining
    : 0;
  const totalWannas = user?.accountTier === 'anonymous'
    ? 5
    : user?.accountTier === 'email'
    ? 10
    : 999;

  const handleSubmit = async () => {
    if (text.length < 3) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Tell us more', 'What do you wanna do? Be specific! 🌟');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await createWanna(text, selectedMood);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Clear form
      setText('');
      setSelectedMood(undefined);

      // Show success
      Alert.alert(
        'Finding your vibe! ✨',
        'We\'re looking for people nearby who feel the same way'
      );
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (error.message.includes('Rate limit')) {
        Alert.alert(
          'Daily limit reached',
          user?.accountTier === 'anonymous'
            ? 'You\'ve used your 5 wannas today. Upgrade to create more!'
            : 'Try again tomorrow!'
        );
      } else if (error.message.includes('Location')) {
        Alert.alert(
          'Location needed',
          'We need your location to find people nearby. Enable it in settings?'
        );
      } else {
        Alert.alert('Oops!', error.message || 'Something went wrong. Mind trying again?');
      }
    }
  };

  const firstName = user?.username.split('_')[0] || 'there';

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          {/* Header with rate limit dots */}
          <View style={styles.header}>
            <Text style={styles.greeting}>hey {firstName} 👋</Text>
            {user?.accountTier === 'anonymous' && (
              <RateLimitDots
                used={wannasUsed}
                total={totalWannas}
                tierName={user?.accountTier}
              />
            )}
          </View>

          {/* Input Section */}
          <View style={styles.inputSection}>
            <View style={styles.inputTile}>
              <View style={styles.inputRow}>
                <View style={styles.prefixPill}>
                  <Text style={styles.inputPrefix}>Iwanna</Text>
                </View>
                <View style={styles.inputWrapper}>
                  {text.length === 0 && (
                    <View style={styles.placeholderContainer}>
                      <Text style={styles.placeholderText}>{animatedPlaceholder}</Text>
                      <Text style={[styles.cursor, { opacity: showCursor ? 1 : 0 }]}>|</Text>
                    </View>
                  )}
                  <TextInput
                    style={styles.input}
                    placeholder=" "
                    placeholderTextColor={colors.text.tertiary}
                    value={text}
                    onChangeText={setText}
                    multiline
                    maxLength={200}
                    autoFocus
                    editable={!isCreating}
                  />
                </View>
              </View>

              {/* Floating Mood Button - positioned inside input tile */}
              {text.length > 0 && (
                <View style={styles.floatingMoodContainer}>
                  <FloatingMoodButton
                    selectedMood={selectedMood}
                    onPress={handleMoodCycle}
                  />
                </View>
              )}
            </View>

            {/* Character counter - only show when approaching limit */}
            {text.length >= 180 && (
              <Text style={[styles.charCount, text.length >= 190 && styles.charCountWarning]}>
                {text.length}/200
              </Text>
            )}
          </View>

          {/* Submit Button - only visible when text.length >= 3 */}
          {text.length >= 3 && (
            <PulsingButton
              title={isCreating ? 'finding your vibe...' : 'find your vibe'}
              onPress={handleSubmit}
              disabled={isCreating}
              style={styles.submitButton}
            />
          )}

          {/* Info hint - only show when no text */}
          {text.length === 0 && (
            <Text style={styles.info}>
              we'll match you with 2-4 people nearby who feel the same way ✨
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  header: {
    marginBottom: spacing.xxl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: typography.fontSize.lg,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
  },
  remaining: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    fontWeight: typography.fontWeight.medium,
  },
  inputSection: {
    marginBottom: spacing.lg,
  },
  inputTile: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.primary + '20',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    minHeight: 120,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  prefixPill: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.md,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary + '30',
    alignSelf: 'flex-start',
  },
  inputPrefix: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary,
    lineHeight: typography.fontSize.lg * 1.5,
  },
  inputWrapper: {
    flex: 1,
    position: 'relative',
  },
  placeholderContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  placeholderText: {
    fontSize: typography.fontSize.lg,
    color: colors.text.tertiary,
    lineHeight: typography.fontSize.lg * 1.5,
  },
  input: {
    fontSize: typography.fontSize.lg,
    color: colors.text.primary,
    minHeight: 100,
    textAlignVertical: 'top',
    padding: 0,
    lineHeight: typography.fontSize.lg * 1.5,
  },
  cursor: {
    fontSize: typography.fontSize.lg,
    color: colors.text.tertiary,
    lineHeight: typography.fontSize.lg * 1.5,
    marginLeft: 2,
  },
  charCount: {
    textAlign: 'right',
    marginTop: spacing.sm,
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  charCountWarning: {
    color: colors.accentYellow,
  },
  floatingMoodContainer: {
    position: 'absolute',
    bottom: spacing.md,
    right: spacing.md,
  },
  submitButton: {
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  info: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: typography.lineHeight.normal * typography.fontSize.sm,
  },
});
