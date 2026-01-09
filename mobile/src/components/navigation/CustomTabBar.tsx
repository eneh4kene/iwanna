import React from 'react';
import { View, Pressable, StyleSheet, Platform, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../constants/theme';
import { usePodStore } from '../../store/podStore';

/**
 * Animated Tab Button
 */
interface TabButtonProps {
  active: boolean;
  icon: 'home' | 'pods';
  label: string;
  badge?: number;
  onPress: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({ active, icon, label, badge, onPress }) => {
  const scale = useSharedValue(1);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Subtle tap animation
    scale.value = withSpring(0.95, { damping: 15 });
    setTimeout(() => {
      scale.value = withSpring(1, { damping: 15 });
    }, 100);

    onPress();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Icon names
  const iconName = icon === 'home'
    ? (active ? 'home' : 'home-outline')
    : (active ? 'people' : 'people-outline');

  return (
    <Pressable onPress={handlePress} style={styles.tabButton}>
      <Animated.View style={[styles.tabContent, animatedStyle]}>
        <View style={styles.iconWrapper}>
          <Ionicons
            name={iconName as any}
            size={24}
            color={active ? colors.text.primary : colors.text.tertiary}
          />
          {/* Badge */}
          {badge !== undefined && badge > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.label, active && styles.labelActive]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
};

/**
 * Custom Tab Bar Component
 */
export const CustomTabBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  // Get active pods count directly from store for reactive badge updates
  const activePods = usePodStore((state) => state.activePods);
  const activePodsCount = activePods.length;

  return (
    <View style={styles.container}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        // Determine icon type and label
        const icon = route.name === 'HomeTab' ? 'home' : 'pods';
        const label = route.name === 'HomeTab' ? 'home' : 'vibes';

        // Get badge count - use store directly for PodsTab, fallback to options for others
        const badge = route.name === 'PodsTab' 
          ? (activePodsCount > 0 ? activePodsCount : undefined)
          : (options.tabBarBadge as number | undefined);

        return (
          <TabButton
            key={route.key}
            active={isFocused}
            icon={icon}
            label={label}
            badge={badge}
            onPress={onPress}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    paddingBottom: Platform.OS === 'ios' ? spacing.lg : spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.surface + '40',
  },

  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },

  tabContent: {
    alignItems: 'center',
    gap: 0,
  },

  iconWrapper: {
    position: 'relative',
  },

  label: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.tertiary,
    marginTop: 2,
  },

  labelActive: {
    color: colors.text.primary,
    fontWeight: typography.fontWeight.semibold,
  },

  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },

  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.background,
  },
});
