import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, shadows } from '../../constants/theme';

export interface AvatarMember {
  id: string;
  username: string;
}

interface OverlappingAvatarsProps {
  members: AvatarMember[];
  maxVisible?: number;
  size?: 'small' | 'medium' | 'large';
  showCount?: boolean;
}

/**
 * Overlapping Avatars Component
 * Displays member avatars with negative margin overlap
 * Shows overflow count badge
 */
export const OverlappingAvatars: React.FC<OverlappingAvatarsProps> = ({
  members,
  maxVisible = 3,
  size = 'small',
  showCount = true,
}) => {
  const sizeMap = {
    small: 32,
    medium: 40,
    large: 64,
  };

  const avatarSize = sizeMap[size];
  const fontSize = size === 'large' ? typography.fontSize.xl : size === 'medium' ? typography.fontSize.md : typography.fontSize.xs;
  const overlapMargin = size === 'large' ? -16 : size === 'medium' ? -12 : -8;

  const visibleMembers = members.slice(0, maxVisible);
  const overflowCount = Math.max(0, members.length - maxVisible);

  return (
    <View style={styles.container}>
      {visibleMembers.map((member, index) => (
        <View
          key={member.id}
          style={[
            styles.avatar,
            {
              width: avatarSize,
              height: avatarSize,
              borderRadius: avatarSize / 2,
            },
            index > 0 && { marginLeft: overlapMargin },
          ]}
        >
          <Text style={[styles.avatarText, { fontSize }]}>
            {member.username.charAt(0).toUpperCase()}
          </Text>
        </View>
      ))}

      {showCount && overflowCount > 0 && (
        <View
          style={[
            styles.avatar,
            styles.overflowBadge,
            {
              width: avatarSize,
              height: avatarSize,
              borderRadius: avatarSize / 2,
              marginLeft: overlapMargin,
            },
          ]}
        >
          <Text style={[styles.avatarText, { fontSize }]}>+{overflowCount}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  avatar: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.background,
    ...shadows.md,
  },

  avatarText: {
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },

  overflowBadge: {
    backgroundColor: colors.text.disabled,
  },
});
