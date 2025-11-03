import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
} from 'react-native-reanimated';
import { colors, typography, spacing, borderRadius, animation } from '../constants/theme';
import { useAuthStore } from '../store/authStore';

export const RecoveryPhraseScreen: React.FC = () => {
  const recoveryPhrase = useAuthStore((state) => state.recoveryPhrase);
  const username = useAuthStore((state) => state.user?.username);
  const clearRecoveryPhrase = useAuthStore((state) => state.clearRecoveryPhrase);

  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // Animations
  const phraseOpacity = useSharedValue(0);
  const phraseScale = useSharedValue(0.95);
  const buttonOpacity = useSharedValue(0);

  useEffect(() => {
    // Fade in phrase
    phraseOpacity.value = withDelay(300, withSpring(1, animation.spring.gentle));
    phraseScale.value = withDelay(300, withSpring(1, animation.spring.gentle));

    // Fade in button after phrase
    buttonOpacity.value = withDelay(800, withSpring(1, animation.spring.gentle));
  }, []);

  const phraseStyle = useAnimatedStyle(() => ({
    opacity: phraseOpacity.value,
    transform: [{ scale: phraseScale.value }],
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
  }));

  const handleCopy = async () => {
    if (!recoveryPhrase) return;

    await Clipboard.setStringAsync(recoveryPhrase);
    setCopied(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    setTimeout(() => setCopied(false), 3000);
  };

  const handleConfirm = () => {
    if (!confirmed) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

      Alert.alert(
        'Are you sure?',
        'Have you saved your recovery phrase? You won\'t be able to see it again.',
        [
          {
            text: 'Not yet',
            style: 'cancel',
          },
          {
            text: 'Yes, I saved it',
            onPress: () => {
              setConfirmed(true);
              clearRecoveryPhrase();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              // Navigation handled by AppNavigator when recoveryPhrase is cleared
            },
          },
        ]
      );
    }
  };

  if (!recoveryPhrase) {
    return null;
  }

  const words = recoveryPhrase.split(' ');

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.emoji}>🔐</Text>
          <Text style={styles.title}>Save Your Recovery Phrase</Text>
          <Text style={styles.subtitle}>
            This is the ONLY way to recover your account. Keep it safe!
          </Text>
        </View>

        <Animated.View style={[styles.phraseContainer, phraseStyle]}>
          <View style={styles.phraseGrid}>
            {words.map((word, index) => (
              <View key={index} style={styles.wordChip}>
                <Text style={styles.wordNumber}>{index + 1}</Text>
                <Text style={styles.word}>{word}</Text>
              </View>
            ))}
          </View>

          <Pressable
            style={[styles.copyButton, copied && styles.copyButtonSuccess]}
            onPress={handleCopy}
          >
            <Text style={styles.copyButtonText}>
              {copied ? '✓ Copied!' : 'Copy to clipboard'}
            </Text>
          </Pressable>
        </Animated.View>

        <View style={styles.warnings}>
          <View style={styles.warningItem}>
            <Text style={styles.warningIcon}>⚠️</Text>
            <Text style={styles.warningText}>
              Anyone with this phrase can access your account
            </Text>
          </View>
          <View style={styles.warningItem}>
            <Text style={styles.warningIcon}>📝</Text>
            <Text style={styles.warningText}>
              Write it down on paper and store it safely
            </Text>
          </View>
          <View style={styles.warningItem}>
            <Text style={styles.warningIcon}>🚫</Text>
            <Text style={styles.warningText}>
              Never share it or save it in photos/notes
            </Text>
          </View>
        </View>

        <Animated.View style={buttonStyle}>
          <Pressable style={styles.button} onPress={handleConfirm}>
            <Text style={styles.buttonText}>I've saved it safely</Text>
          </Pressable>
        </Animated.View>

        <Text style={styles.usernameHint}>
          Your username: <Text style={styles.username}>{username}</Text>
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  emoji: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.fontSize.md,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: typography.lineHeight.normal * typography.fontSize.md,
  },
  phraseContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  phraseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  wordChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    minWidth: '30%',
  },
  wordNumber: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginRight: spacing.xs,
    fontWeight: typography.fontWeight.medium,
  },
  word: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
  },
  copyButton: {
    backgroundColor: colors.primary + '30',
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  copyButtonSuccess: {
    backgroundColor: colors.success + '30',
    borderColor: colors.success,
  },
  copyButtonText: {
    color: colors.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  warnings: {
    marginBottom: spacing.xl,
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  warningIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  warningText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: typography.lineHeight.normal * typography.fontSize.sm,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  buttonText: {
    color: colors.text.primary,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  usernameHint: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  username: {
    color: colors.text.primary,
    fontWeight: typography.fontWeight.semibold,
  },
});
