import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SafeAreaView,
  ScrollView,
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
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, typography, spacing, borderRadius, animation, shadows } from '../constants/theme';
import { usePodStore, Pod, PodMember } from '../store/podStore';

type RouteParams = {
  PodDetail: {
    podId: string;
  };
};

type NavigationProp = NativeStackNavigationProp<any>;

/**
 * Member Card Component
 */
const MemberCard: React.FC<{ member: PodMember; isCurrentUser: boolean }> = ({
  member,
  isCurrentUser,
}) => {
  // Breathing animation
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.01, { duration: 1800 }),
        withTiming(1.0, { duration: 1800 })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.memberCard, animatedStyle]}>
      <View style={styles.memberAvatar}>
        <Text style={styles.memberAvatarText}>
          {member.username.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{member.username}</Text>
        {isCurrentUser && (
          <Text style={styles.memberBadge}>You</Text>
        )}
      </View>
    </Animated.View>
  );
};

/**
 * Action Button Component
 */
const ActionButton: React.FC<{
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'danger';
  disabled?: boolean;
}> = ({ title, onPress, variant = 'primary', disabled = false }) => {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!disabled) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.02, { duration: 1500 }),
          withTiming(1.0, { duration: 1500 })
        ),
        -1,
        false
      );
    }
  }, [disabled]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const backgroundColor =
    variant === 'danger' ? colors.error : colors.primary;

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.actionButton,
          { backgroundColor },
          pressed && styles.actionButtonPressed,
          disabled && styles.actionButtonDisabled,
        ]}
      >
        <Text style={styles.actionButtonText}>{title}</Text>
      </Pressable>
    </Animated.View>
  );
};

/**
 * Pod Detail Screen
 * Shows detailed information about a specific pod
 */
export const PodDetailScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProp<RouteParams, 'PodDetail'>>();
  const { podId } = route.params;

  const activePods = usePodStore((state) => state.activePods);
  const leavePod = usePodStore((state) => state.leavePod);
  const completePod = usePodStore((state) => state.completePod);

  const [pod, setPod] = useState<Pod | null>(null);

  // Find the pod from store
  useEffect(() => {
    const foundPod = activePods.find((p) => p.id === podId);
    setPod(foundPod || null);
  }, [podId, activePods]);

  // Calculate time remaining
  const getTimeRemaining = (): string => {
    if (!pod) return '';

    const expiresAt = new Date(pod.expiresAt);
    const now = new Date();
    const diffMs = expiresAt.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 0) return 'Expired';
    if (diffMins < 60) return `${diffMins} minutes`;

    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m`;
  };

  // Get time remaining percentage (for visual indicator)
  const getTimeRemainingPercentage = (): number => {
    if (!pod) return 0;

    const expiresAt = new Date(pod.expiresAt);
    const createdAt = new Date(pod.createdAt);
    const now = new Date();

    const totalDuration = expiresAt.getTime() - createdAt.getTime();
    const elapsed = now.getTime() - createdAt.getTime();

    const percentage = Math.max(0, Math.min(100, (1 - elapsed / totalDuration) * 100));
    return percentage;
  };

  // Get status color
  const getStatusColor = (): string => {
    if (!pod) return colors.text.tertiary;

    if (pod.status === 'forming') return colors.accentYellow;
    if (pod.status === 'active') return colors.accentGreen;
    if (pod.status === 'completed') return colors.success;
    return colors.text.tertiary;
  };

  // Handle leave pod
  const handleLeavePod = (): void => {
    Alert.alert(
      'Leave Pod?',
      'Are you sure you want to leave this pod? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            await leavePod(podId);
            navigation.goBack();
          },
        },
      ]
    );
  };

  // Handle complete pod
  const handleCompletePod = (): void => {
    Alert.alert(
      'Complete Pod?',
      'Mark this pod as successfully completed?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Complete',
          onPress: async () => {
            await completePod(podId);
          },
        },
      ]
    );
  };

  if (!pod) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Pod not found</Text>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor() + '20' }]}>
            <Text style={[styles.statusText, { color: getStatusColor() }]}>
              {pod.status}
            </Text>
          </View>

          <Text style={styles.activity}>{pod.activity}</Text>
          <Text style={styles.category}>{pod.category.replace(/_/g, ' ')}</Text>
        </View>

        {/* Time remaining */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Time Remaining</Text>
          <View style={styles.timeContainer}>
            <View style={styles.timeProgressBar}>
              <View
                style={[
                  styles.timeProgressFill,
                  {
                    width: `${getTimeRemainingPercentage()}%`,
                    backgroundColor: getStatusColor(),
                  },
                ]}
              />
            </View>
            <Text style={styles.timeText}>{getTimeRemaining()}</Text>
          </View>
        </View>

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Meeting Point</Text>
          <View style={styles.locationCard}>
            <Text style={styles.locationText}>
              📍 {pod.location.latitude.toFixed(4)}, {pod.location.longitude.toFixed(4)}
            </Text>
            <Text style={styles.locationHint}>
              Coordinates of your group's center point
            </Text>
          </View>
        </View>

        {/* Members */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Members ({pod.memberCount})
          </Text>
          {pod.members.map((member) => (
            <MemberCard
              key={member.userId}
              member={member}
              isCurrentUser={false} // TODO: Compare with actual user ID from auth store
            />
          ))}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {pod.status === 'active' && (
            <ActionButton
              title="Complete Pod"
              onPress={handleCompletePod}
              variant="primary"
            />
          )}

          {(pod.status === 'forming' || pod.status === 'active') && (
            <ActionButton
              title="Leave Pod"
              onPress={handleLeavePod}
              variant="danger"
            />
          )}
        </View>
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

  scrollContent: {
    padding: spacing.lg,
  },

  header: {
    marginBottom: spacing.xl,
  },

  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
  },

  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  activity: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },

  category: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    textTransform: 'capitalize',
  },

  section: {
    marginBottom: spacing.xl,
  },

  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },

  timeContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },

  timeProgressBar: {
    height: 8,
    backgroundColor: colors.text.disabled + '30',
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },

  timeProgressFill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },

  timeText: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textAlign: 'center',
  },

  locationCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },

  locationText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },

  locationHint: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.regular,
    color: colors.text.secondary,
  },

  memberCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.sm,
  },

  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },

  memberAvatarText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },

  memberInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  memberName: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },

  memberBadge: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary,
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  actions: {
    marginTop: spacing.md,
    gap: spacing.md,
  },

  actionButton: {
    height: 56,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
  },

  actionButtonPressed: {
    opacity: 0.8,
  },

  actionButtonDisabled: {
    opacity: 0.5,
  },

  actionButtonText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
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
    marginBottom: spacing.lg,
  },

  backButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },

  backButtonText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
});
