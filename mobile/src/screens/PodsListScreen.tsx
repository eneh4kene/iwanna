import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { colors, typography, spacing, borderRadius, animation, shadows } from '../constants/theme';
import { usePodStore, Pod } from '../store/podStore';
import { StoryCircle } from '../components/pods/StoryCircle';
import { OverlappingAvatars, AvatarMember } from '../components/pods/OverlappingAvatars';
import { FeaturedPodsSlider } from '../components/FeaturedPodsSlider';

type NavigationProp = NativeStackNavigationProp<any>;

/**
 * Enhanced Pod Card Component
 * Clean card with overlapping avatars and last message preview
 */
const PodCard: React.FC<{ pod: Pod; onPress: () => void }> = ({ pod, onPress }) => {
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.3);

  // Calculate time remaining in minutes
  const getMinutesRemaining = (): number => {
    const expiresAt = new Date(pod.expiresAt);
    const now = new Date();
    const diffMs = expiresAt.getTime() - now.getTime();
    return Math.floor(diffMs / 60000);
  };

  // Calculate time remaining display
  const getTimeRemaining = (): string => {
    const diffMins = getMinutesRemaining();

    if (diffMins < 0) return 'Expired';
    if (diffMins < 60) return `${diffMins}m`;

    const hours = Math.floor(diffMins / 60);
    return `${hours}h`;
  };

  // Check if urgent (< 30 minutes)
  const isUrgent = getMinutesRemaining() < 30 && getMinutesRemaining() > 0;

  useEffect(() => {
    if (isUrgent) {
      // Urgent pulsing animation
      scale.value = withRepeat(
        withSequence(
          withSpring(1.03, { damping: 10 }),
          withSpring(1.0, { damping: 10 })
        ),
        -1,
        false
      );

      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(1.0, { duration: 800 }),
          withTiming(0.3, { duration: 800 })
        ),
        -1,
        false
      );
    } else {
      // Normal breathing animation
      scale.value = withRepeat(
        withSequence(
          withTiming(1.01, { duration: 1500 }),
          withTiming(1.0, { duration: 1500 })
        ),
        -1,
        false
      );
    }
  }, [isUrgent]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: isUrgent ? glowOpacity.value * 0.5 : 0,
  }));

  // Convert pod members to avatar format
  const avatarMembers: AvatarMember[] = pod.members.map(m => ({
    id: m.userId,
    username: m.username,
  }));

  return (
    <Animated.View style={[animatedStyle, glowStyle]}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.podCard,
          pressed && styles.podCardPressed,
          isUrgent && styles.podCardUrgent,
        ]}
      >
        {/* Urgent warning */}
        {isUrgent && (
          <View style={styles.urgentBadge}>
            <Text style={styles.urgentText}>⚠️ almost up!</Text>
          </View>
        )}

        {/* Activity name */}
        <Text style={styles.activity}>{pod.activity}</Text>

        {/* Avatars + Time inline */}
        <View style={styles.metaRow}>
          <OverlappingAvatars
            members={avatarMembers}
            maxVisible={3}
            size="small"
          />
          <Text style={[styles.timeText, isUrgent && styles.timeTextUrgent]}>
            • {getTimeRemaining()}
          </Text>
        </View>

        {/* Last message preview (placeholder for now) */}
        {pod.status === 'active' && (
          <Text style={styles.lastMessage} numberOfLines={1}>
            tap to open chat
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
};

/**
 * Empty State Component
 */
const EmptyState: React.FC = () => {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 2000 }),
        withTiming(1.0, { duration: 2000 })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.emptyContainer}>
      <Animated.Text style={[styles.emptyEmoji, animatedStyle]}>
        ✨
      </Animated.Text>
      <Text style={styles.emptyTitle}>No active pods yet</Text>
      <Text style={styles.emptySubtitle}>
        Create a wanna to find your vibe
      </Text>
    </View>
  );
};

/**
 * Pods List Screen
 * Displays user's active pods with real-time updates
 */
export const PodsListScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();

  const activePods = usePodStore((state) => state.activePods);
  const isLoading = usePodStore((state) => state.isLoading);
  const error = usePodStore((state) => state.error);

  // Location state for featured pods
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const fetchActivePods = usePodStore((state) => state.fetchActivePods);
  const connectSocket = usePodStore((state) => state.connectSocket);

  const [refreshing, setRefreshing] = useState(false);

  // Fetch pods on mount
  useEffect(() => {
    fetchActivePods();
    connectSocket();

    // Get user location for featured pods
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          setUserLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        }
      } catch (error) {
        console.error('Error getting location:', error);
      }
    })();
  }, []);

  // Handle refresh
  const handleRefresh = async (): Promise<void> => {
    setRefreshing(true);
    await fetchActivePods();
    setRefreshing(false);
  };

  // Handle pod press
  const handlePodPress = (pod: Pod): void => {
    navigation.navigate('PodDetail', { podId: pod.id });
  };

  // Calculate time remaining for story circle
  const getStoryTimeRemaining = (pod: Pod): string => {
    const expiresAt = new Date(pod.expiresAt);
    const now = new Date();
    const diffMs = expiresAt.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 60) return `${diffMins}m`;
    const hours = Math.floor(diffMins / 60);
    return `${hours}h`;
  };

  // Check if urgent
  const isUrgentPod = (pod: Pod): boolean => {
    const expiresAt = new Date(pod.expiresAt);
    const now = new Date();
    const diffMins = Math.floor((expiresAt.getTime() - now.getTime()) / 60000);
    return diffMins < 30 && diffMins > 0;
  };

  // Render pod item
  const renderPodItem = ({ item }: { item: Pod }) => (
    <PodCard pod={item} onPress={() => handlePodPress(item)} />
  );

  // Render story circle
  const renderStoryCircle = (pod: Pod) => (
    <StoryCircle
      key={pod.id}
      activity={pod.activity}
      category={pod.category}
      timeRemaining={getStoryTimeRemaining(pod)}
      hasNewMessage={false} // TODO: Connect to actual new message state
      isUrgent={isUrgentPod(pod)}
      onPress={() => handlePodPress(pod)}
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header - simplified */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {activePods.length === 0 ? 'no active vibes' : 'your vibes'}
        </Text>
      </View>

      {/* Error message */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Featured Pods Slider */}
      {userLocation && (
        <FeaturedPodsSlider
          latitude={userLocation.latitude}
          longitude={userLocation.longitude}
        />
      )}

      {/* Story Circles - horizontal scroll */}
      {activePods.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.storiesContainer}
          contentContainerStyle={styles.storiesContent}
        >
          {activePods.map(renderStoryCircle)}
        </ScrollView>
      )}

      {/* Pods list */}
      <FlatList
        data={activePods}
        renderItem={renderPodItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          activePods.length === 0 && styles.listContentEmpty,
        ]}
        ListEmptyComponent={!isLoading && !refreshing ? <EmptyState /> : null}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },

  headerTitle: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },

  storiesContainer: {
    maxHeight: 120,
    marginBottom: spacing.md,
  },

  storiesContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },

  errorContainer: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.error + '20',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.error + '40',
  },

  errorText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.error,
    textAlign: 'center',
  },

  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },

  listContentEmpty: {
    flexGrow: 1,
  },

  podCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.md,
  },

  podCardPressed: {
    backgroundColor: colors.surfaceHover,
  },

  podCardUrgent: {
    borderWidth: 2,
    borderColor: colors.error,
    shadowColor: colors.error,
  },

  urgentBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.error + '20',
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
  },

  urgentText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.error,
  },

  activity: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  timeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.tertiary,
  },

  timeTextUrgent: {
    color: colors.error,
    fontWeight: typography.fontWeight.bold,
  },

  lastMessage: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.regular,
    color: colors.text.tertiary,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },

  emptyEmoji: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },

  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },

  emptySubtitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.regular,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: typography.lineHeight.relaxed * typography.fontSize.md,
  },
});
