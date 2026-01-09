/**
 * Featured Pod Detail Screen
 * Full detail view of a featured/sponsored pod
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Pressable,
  Image,
} from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFeaturedPodStore } from '../store/featuredPodStore';
import { colors, spacing, borderRadius, typography, shadows } from '../constants/theme';
import { RootStackParamList } from '../navigation/types';

type Props = StackScreenProps<RootStackParamList, 'FeaturedPodDetail'>;

export const FeaturedPodDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { featuredPodId } = route.params;
  const {
    currentFeaturedPod,
    isLoading,
    isJoining,
    isLeaving,
    fetchFeaturedPodById,
    joinFeaturedPod,
    leaveFeaturedPod,
  } = useFeaturedPodStore();

  const [isConfirming, setIsConfirming] = useState(false);

  // Fetch pod details on mount
  useEffect(() => {
    fetchFeaturedPodById(featuredPodId);
  }, [featuredPodId]);

  // Handle join
  const handleJoin = async () => {
    try {
      await joinFeaturedPod(featuredPodId);
      Alert.alert('Success', 'You joined this event!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to join event');
    }
  };

  // Handle leave
  const handleLeave = async () => {
    Alert.alert('Leave Event', 'Are you sure you want to leave this event?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            await leaveFeaturedPod(featuredPodId);
            Alert.alert('Left Event', 'You have left this event');
            navigation.goBack();
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to leave event');
          }
        },
      },
    ]);
  };

  // Loading state
  if (isLoading && !currentFeaturedPod) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading event details...</Text>
      </View>
    );
  }

  // Error state
  if (!currentFeaturedPod) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={colors.text.disabled} />
        <Text style={styles.errorText}>Event not found</Text>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const pod = currentFeaturedPod;

  // Format times
  const startsAt = new Date(pod.startsAt);
  const expiresAt = new Date(pod.expiresAt);
  const startTime = startsAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const endTime = expiresAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  // Calculate progress
  const percentFull = (pod.currentCount / pod.maxCapacity) * 100;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Hero Image */}
        {pod.imageUrl && (
          <View style={styles.heroImageContainer}>
            <Image source={{ uri: pod.imageUrl }} style={styles.heroImage} />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.7)']}
              style={styles.heroGradient}
            />
          </View>
        )}

        {/* Content */}
        <View style={styles.content}>
          {/* Title */}
          <Text style={styles.title}>{pod.title}</Text>

          {/* Venue Name */}
          <View style={styles.venueRow}>
            <Ionicons name="business-outline" size={18} color={colors.text.secondary} />
            <Text style={styles.venueText}>{pod.venue.name}</Text>
          </View>

          {/* Time */}
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={20} color={colors.primary} />
            <Text style={styles.infoText}>
              {startTime} - {endTime}
            </Text>
          </View>

          {/* Location */}
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={20} color={colors.primary} />
            <Text style={styles.infoText}>{pod.locationName}</Text>
          </View>

          {/* Capacity */}
          <View style={styles.capacitySection}>
            <View style={styles.capacityHeader}>
              <Ionicons name="people" size={20} color={colors.primary} />
              <Text style={styles.capacityText}>
                {pod.currentCount} / {pod.maxCapacity} people
              </Text>
            </View>
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { width: `${Math.min(percentFull, 100)}%` }]} />
            </View>
            {percentFull >= 80 && (
              <Text style={styles.hotText}>🔥 Filling up fast!</Text>
            )}
          </View>

          {/* Description */}
          {pod.description && (
            <View style={styles.descriptionSection}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.descriptionText}>{pod.description}</Text>
            </View>
          )}

          {/* Members (if joined) */}
          {pod.isUserMember && pod.members.length > 0 && (
            <View style={styles.membersSection}>
              <Text style={styles.sectionTitle}>Going ({pod.members.length})</Text>
              {pod.members.slice(0, 10).map((member, index) => (
                <View key={index} style={styles.memberRow}>
                  <Ionicons name="person-circle-outline" size={24} color={colors.text.secondary} />
                  <Text style={styles.memberName}>@{member.username}</Text>
                  {member.hasConfirmedArrival && (
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                  )}
                </View>
              ))}
              {pod.members.length > 10 && (
                <Text style={styles.moreText}>+{pod.members.length - 10} more</Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Action Button */}
      <View style={styles.actionContainer}>
        {pod.isUserMember ? (
          <Pressable
            onPress={handleLeave}
            disabled={isLeaving}
            style={({ pressed }) => [
              styles.leaveButton,
              pressed && styles.buttonPressed,
              isLeaving && styles.buttonDisabled,
            ]}
          >
            {isLeaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="exit-outline" size={20} color="#FFFFFF" />
                <Text style={styles.leaveButtonText}>Leave Event</Text>
              </>
            )}
          </Pressable>
        ) : (
          <Pressable
            onPress={handleJoin}
            disabled={isJoining || pod.currentCount >= pod.maxCapacity}
            style={({ pressed }) => [
              styles.joinButton,
              pressed && styles.buttonPressed,
              (isJoining || pod.currentCount >= pod.maxCapacity) && styles.buttonDisabled,
            ]}
          >
            {isJoining ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
                <Text style={styles.joinButtonText}>
                  {pod.currentCount >= pod.maxCapacity ? 'Event Full' : 'Join Event'}
                </Text>
              </>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: spacing.xl * 2,
  },
  heroImageContainer: {
    width: '100%',
    height: 200,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  content: {
    padding: spacing.md,
  },
  title: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  venueText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginLeft: spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  infoText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.regular,
    color: colors.text.primary,
    marginLeft: spacing.sm,
    flex: 1,
  },
  capacitySection: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
  },
  capacityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  capacityText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: colors.surfaceHover,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
  },
  hotText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.error,
    marginTop: spacing.xs,
  },
  descriptionSection: {
    marginTop: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  descriptionText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.regular,
    color: colors.text.secondary,
    lineHeight: typography.fontSize.md * 1.5,
  },
  membersSection: {
    marginTop: spacing.md,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  memberName: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.regular,
    color: colors.text.primary,
    marginLeft: spacing.sm,
    flex: 1,
  },
  moreText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.regular,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  actionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadows.md,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  joinButtonText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: '#FFFFFF',
    marginLeft: spacing.xs,
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.error,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  leaveButtonText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: '#FFFFFF',
    marginLeft: spacing.xs,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.regular,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  errorText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  backButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
  },
  backButtonText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: '#FFFFFF',
  },
});
