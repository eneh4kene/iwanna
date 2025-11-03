import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
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
import { colors, typography, spacing, borderRadius, animation, shadows } from '../constants/theme';
import { usePodStore, Pod } from '../store/podStore';

type NavigationProp = NativeStackNavigationProp<any>;

/**
 * Pod Card Component
 * Displays individual pod with breathing animation
 */
const PodCard: React.FC<{ pod: Pod; onPress: () => void }> = ({ pod, onPress }) => {
  // Breathing animation
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.01, { duration: 1500 }),
        withTiming(1.0, { duration: 1500 })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Calculate time remaining
  const getTimeRemaining = (): string => {
    const expiresAt = new Date(pod.expiresAt);
    const now = new Date();
    const diffMs = expiresAt.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 0) return 'Expired';
    if (diffMins < 60) return `${diffMins}m left`;

    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m left`;
  };

  // Get status color
  const getStatusColor = (): string => {
    if (pod.status === 'forming') return colors.accentYellow;
    if (pod.status === 'active') return colors.accentGreen;
    if (pod.status === 'completed') return colors.success;
    return colors.text.tertiary;
  };

  // Get status text
  const getStatusText = (): string => {
    if (pod.status === 'forming') return 'Forming';
    if (pod.status === 'active') return 'Active';
    if (pod.status === 'completed') return 'Completed';
    return 'Expired';
  };

  return (
    <Animated.View style={[animatedStyle]}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.podCard,
          pressed && styles.podCardPressed,
        ]}
      >
        {/* Status badge */}
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor() + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor() }]}>
            {getStatusText()}
          </Text>
        </View>

        {/* Activity */}
        <Text style={styles.activity}>{pod.activity}</Text>

        {/* Category */}
        <Text style={styles.category}>{pod.category.replace(/_/g, ' ')}</Text>

        {/* Members and time */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Members</Text>
            <Text style={styles.metaValue}>{pod.memberCount}</Text>
          </View>

          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Time Left</Text>
            <Text style={styles.metaValue}>{getTimeRemaining()}</Text>
          </View>
        </View>
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
  const fetchActivePods = usePodStore((state) => state.fetchActivePods);
  const connectSocket = usePodStore((state) => state.connectSocket);

  const [refreshing, setRefreshing] = useState(false);

  // Fetch pods on mount
  useEffect(() => {
    fetchActivePods();
    connectSocket();
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

  // Render pod item
  const renderPodItem = ({ item }: { item: Pod }): JSX.Element => (
    <PodCard pod={item} onPress={() => handlePodPress(item)} />
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Your Pods</Text>
        <Text style={styles.headerSubtitle}>
          {activePods.length} active {activePods.length === 1 ? 'pod' : 'pods'}
        </Text>
      </View>

      {/* Error message */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
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
    marginBottom: spacing.xs,
  },

  headerSubtitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.regular,
    color: colors.text.secondary,
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
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },

  category: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.md,
    textTransform: 'capitalize',
  },

  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.text.disabled + '30',
  },

  metaItem: {
    flex: 1,
  },

  metaLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  metaValue: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
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
