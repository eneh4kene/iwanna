import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SafeAreaView,
  ScrollView,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Linking,
  FlatList,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, typography, spacing, borderRadius, animation, shadows } from '../constants/theme';
import { usePodStore, Pod, PodMember } from '../store/podStore';
import { ChatMessage, Attachment, ImageAttachment, GifAttachment, EmojiAttachment } from '../services/chatService';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { EmojiPicker } from '../components/chat/EmojiPicker';
import { GifPicker } from '../components/chat/GifPicker';
import { useAuthStore } from '../store/authStore';
import { TypingIndicator } from '../components/common/TypingIndicator';

type RouteParams = {
  PodDetail: {
    podId: string;
  };
};

type NavigationProp = NativeStackNavigationProp<any>;

// Stable empty array to prevent unnecessary re-renders
const EMPTY_MESSAGES: ChatMessage[] = [];

/**
 * Parse and render message with highlighted @mentions
 */
const renderMessageWithMentions = (content: string, textStyle: any): React.ReactNode => {
  const mentionPattern = /@(\w+)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = mentionPattern.exec(content)) !== null) {
    const mentionStart = match.index;
    const mention = match[0]; // Full @mention
    const username = match[1]; // Just the username

    // Add text before mention
    if (mentionStart > lastIndex) {
      parts.push(
        <Text key={`text-${lastIndex}`} style={textStyle}>
          {content.slice(lastIndex, mentionStart)}
        </Text>
      );
    }

    // Add highlighted mention
    const isVibe = username.toLowerCase() === 'vibe';
    parts.push(
      <Text
        key={`mention-${mentionStart}`}
        style={[
          textStyle,
          styles.mentionText,
          isVibe && styles.mentionTextVibe,
        ]}
      >
        {mention}
      </Text>
    );

    lastIndex = mentionStart + mention.length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(
      <Text key={`text-${lastIndex}`} style={textStyle}>
        {content.slice(lastIndex)}
      </Text>
    );
  }

  return parts.length > 0 ? <Text style={textStyle}>{parts}</Text> : <Text style={textStyle}>{content}</Text>;
};

/**
 * Empty Chat State Component with Floating Animation
 */
const EmptyChatState: React.FC = () => {
  const floatY = useSharedValue(0);
  
  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  return (
    <View style={styles.emptyChatContainer}>
      <Animated.View style={animatedStyle}>
        <Text style={styles.emptyChatEmoji}>👋</Text>
      </Animated.View>
      <Text style={styles.emptyChatText}>no messages yet</Text>
      <Text style={styles.emptyChatHint}>say hi & see where the vibe takes you ✨</Text>
    </View>
  );
};

/**
 * Pulsing Live Indicator Component
 */
const LiveIndicator: React.FC = () => {
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(1);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.3, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.4, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const animatedPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  return (
    <View style={styles.liveIndicatorContainer}>
      <Animated.View style={[styles.liveIndicatorPulse, animatedPulseStyle]} />
      <View style={styles.liveIndicatorDot} />
      <Text style={styles.liveIndicatorText}>LIVE</Text>
    </View>
  );
};

/**
 * Member Card Component
 */
const MemberCard: React.FC<{
  member: PodMember;
  isCurrentUser: boolean;
  isConfirmed: boolean;
}> = ({
  member,
  isCurrentUser,
  isConfirmed,
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
      <View style={styles.memberAvatarContainer}>
        <View style={styles.memberAvatar}>
          <Text style={styles.memberAvatarText}>
            {member.username.charAt(0).toUpperCase()}
          </Text>
        </View>
        {isConfirmed && (
          <View style={styles.confirmedDot} />
        )}
      </View>
      <View style={styles.memberInfo}>
        <View style={styles.memberNameContainer}>
          <Text style={styles.memberName}>{member.username}</Text>
          {isConfirmed && (
            <Text style={styles.confirmedText}>✓ Here</Text>
          )}
        </View>
        {isCurrentUser && (
          <Text style={styles.memberBadge}>You</Text>
        )}
      </View>
    </Animated.View>
  );
};

/**
 * Chat Message Bubble Component with Entrance Animation
 */
const ChatMessageBubble: React.FC<{
  message: ChatMessage;
  isCurrentUser: boolean;
  onLongPress?: (message: ChatMessage) => void;
  onReplyContextPress?: (messageId: string) => void; // Callback to scroll to referenced message
  isGroupStart?: boolean; // First message in a group
  isGroupEnd?: boolean; // Last message in a group
  showTimestamp?: boolean; // Show timestamp on this message
}> = ({ message, isCurrentUser, onLongPress, onReplyContextPress, isGroupStart = true, isGroupEnd = true, showTimestamp = true }) => {
  const isSystemMessage = message.messageType === 'system';
  const isAiMessage = message.messageType === 'ai';

  // Entrance animation
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(10);

  useEffect(() => {
    opacity.value = withSpring(1, animation.spring.gentle);
    translateY.value = withSpring(0, animation.spring.gentle);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  // System messages (confirmation notifications)
  if (isSystemMessage) {
    return (
      <View style={styles.systemMessageContainer}>
        <Text style={styles.systemMessageText}>{message.content}</Text>
      </View>
    );
  }

  // AI assistant messages (@vibe)
  if (isAiMessage) {
    return (
      <Animated.View style={[styles.aiMessageContainer, animatedStyle]}>
        <Pressable
          onLongPress={() => onLongPress?.(message)}
          delayLongPress={400}
        >
          <LinearGradient
            colors={['rgba(255, 200, 100, 0.1)', 'rgba(255, 150, 50, 0.05)']}
            style={styles.aiMessageBubble}
          >
            {/* Reply context indicator for @vibe's replies */}
            {message.replyTo && (
              <Pressable
                onPress={() => onReplyContextPress?.(message.replyTo!.messageId)}
                style={({ pressed }) => [
                  styles.replyContext,
                  styles.replyContextAi,
                  pressed && styles.replyContextPressed,
                ]}
              >
                <View style={styles.replyContextBar} />
                <View style={styles.replyContextContent}>
                  <Text style={[styles.replyContextUsername, styles.replyContextUsernameAi]}>
                    replied to {message.replyTo.username === (useAuthStore.getState().user?.username) ? 'you' : `@${message.replyTo.username}`}
                  </Text>
                  <Text
                    style={[styles.replyContextText, styles.replyContextTextAi]}
                    numberOfLines={1}
                  >
                    {message.replyTo.content}
                  </Text>
                </View>
              </Pressable>
            )}

            <View style={styles.aiMessageHeader}>
              <Text style={styles.aiMessageIcon}>✨</Text>
              <Text style={styles.aiMessageUsername}>@vibe</Text>
            </View>
            <View style={styles.aiMessageContentRow}>
              <Text style={styles.aiMessageText}>{message.content}</Text>
              <Text style={styles.aiMessageTime}>
                {new Date(message.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    );
  }

  // Regular user messages
  const messageTextStyle = [
    styles.messageText,
    isCurrentUser ? styles.messageTextUser : styles.messageTextOther,
  ];

  const renderAttachment = (attachment: Attachment, index: number) => {
    switch (attachment.type) {
      case 'image':
        return (
          <View key={index} style={styles.attachmentContainer}>
            <Image
              source={{ uri: attachment.url }}
              style={styles.attachmentImage}
              contentFit="cover"
              transition={200}
            />
          </View>
        );
      case 'gif':
        return (
          <View key={index} style={styles.attachmentContainer}>
            <Image
              source={{ uri: attachment.url }}
              style={styles.attachmentGif}
              contentFit="contain"
              transition={200}
            />
          </View>
        );
      case 'emoji':
        return (
          <Text key={index} style={styles.attachmentEmoji}>
            {attachment.emoji}
          </Text>
        );
      default:
        return null;
    }
  };

  return (
    <Animated.View
      style={[
        styles.messageBubbleContainer,
        isCurrentUser ? styles.messageBubbleRight : styles.messageBubbleLeft,
        animatedStyle,
      ]}
    >
      <Pressable
        onLongPress={() => onLongPress?.(message)}
        delayLongPress={400}
        style={[
          styles.messageBubble,
          isCurrentUser ? styles.messageBubbleUser : styles.messageBubbleOther,
          // Adjust spacing for grouped messages
          !isGroupStart && styles.messageBubbleGrouped,
        ]}
      >
        {/* Show username only on first message in group for other users */}
        {!isCurrentUser && isGroupStart && (
          <Text style={styles.messageUsername}>{message.username}</Text>
        )}

        {/* Reply context indicator */}
        {message.replyTo && (
          <Pressable
            onPress={() => onReplyContextPress?.(message.replyTo!.messageId)}
            style={({ pressed }) => [
              styles.replyContext,
              pressed && styles.replyContextPressed,
            ]}
          >
            <View style={styles.replyContextBar} />
            <View style={styles.replyContextContent}>
              <Text style={styles.replyContextUsername}>
                replied to {message.replyTo.username === (useAuthStore.getState().user?.username) ? 'you' : `@${message.replyTo.username}`}
              </Text>
              <Text
                style={[
                  styles.replyContextText,
                  isCurrentUser && styles.replyContextTextUser,
                ]}
                numberOfLines={1}
              >
                {message.replyTo.content}
              </Text>
            </View>
          </Pressable>
        )}

        {/* Render attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <View style={styles.attachmentsContainer}>
            {message.attachments.map((attachment, index) => renderAttachment(attachment, index))}
          </View>
        )}

        {/* Render text content if present */}
        <View style={styles.messageContentRow}>
          <View style={styles.messageTextContainer}>
            {message.content && message.content.trim() && (
              renderMessageWithMentions(message.content, messageTextStyle)
            )}
          </View>

          {/* Show timestamp inline at bottom-right corner (only on last message in group) */}
          {showTimestamp && isGroupEnd && (
            <Text style={[
              styles.messageTimeInline,
              isCurrentUser ? styles.messageTimeUser : styles.messageTimeOther,
            ]}>
              {new Date(message.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
};

/**
 * Animated Send Button Component with Glow Effect
 */
const AnimatedSendButton: React.FC<{
  onPress: () => void;
  disabled: boolean;
  hasContent: boolean;
}> = ({ onPress, disabled, hasContent }) => {
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(hasContent ? 0.3 : 0);

  useEffect(() => {
    if (hasContent && !disabled) {
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.5, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 1500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    } else {
      glowOpacity.value = 0;
    }
  }, [hasContent, disabled]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => {
        scale.value = withSpring(0.95, animation.spring.gentle);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, animation.spring.gentle);
      }}
      style={({ pressed }) => [
        styles.sendButton,
        pressed && styles.sendButtonPressed,
        disabled && styles.sendButtonDisabled,
      ]}
    >
      <Animated.View style={[styles.sendButtonGlow, glowStyle]} />
      <Animated.View style={animatedStyle}>
        <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
      </Animated.View>
    </Pressable>
  );
};

/**
 * Animated Plus/Close Button Component - Toggles between + and ×
 */
const AnimatedPlusButton: React.FC<{
  onPress: () => void;
  isActive: boolean;
}> = ({ onPress, isActive }) => {
  const rotation = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    // Toggle rotation: 0deg = plus, 45deg = close
    rotation.value = withSpring(isActive ? 45 : 0, animation.spring.gentle);
  }, [isActive]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
    opacity: opacity.value,
  }));

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.attachButton,
        pressed && styles.attachButtonPressed,
        isActive && styles.attachButtonActive,
      ]}
    >
      <Animated.View style={animatedStyle}>
        <Ionicons name="add" size={22} color={colors.text.primary} />
      </Animated.View>
    </Pressable>
  );
};

/**
 * Animated Attachment Menu Component (Bottom Sheet Style)
 */
const AnimatedAttachmentMenu: React.FC<{
  onClose: () => void;
  onPhotoPress: () => void;
  onGifPress: () => void;
  onEmojiPress: () => void;
  onLocationPress?: () => void;
}> = ({ onClose, onPhotoPress, onGifPress, onEmojiPress, onLocationPress }) => {
  const translateY = useSharedValue(-20);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.95);

  useEffect(() => {
    translateY.value = withSpring(0, animation.spring.gentle);
    opacity.value = withTiming(1, { duration: animation.duration.fast });
    scale.value = withSpring(1, animation.spring.gentle);
  }, []);

  const menuStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  const menuItems = [
    {
      icon: 'camera-outline' as const,
      title: 'Photo',
      subtitle: 'Camera or library',
      onPress: onPhotoPress,
    },
    {
      icon: 'film-outline' as const,
      title: 'GIF',
      subtitle: 'Search GIFs',
      onPress: onGifPress,
    },
    {
      icon: 'happy-outline' as const,
      title: 'Emoji',
      subtitle: 'Choose emoji',
      onPress: onEmojiPress,
    },
  ];

  if (onLocationPress) {
    menuItems.push({
      icon: 'camera-outline' as const, // Using camera icon as fallback since location-outline not in type
      title: 'Location',
      subtitle: 'Share location',
      onPress: onLocationPress,
    });
  }

  return (
    <Animated.View style={[styles.attachmentMenuContainer, menuStyle]}>
      {menuItems.map((item, index) => (
        <Pressable
          key={item.title}
          onPress={() => {
            item.onPress();
          }}
          style={({ pressed }) => [
            styles.attachmentMenuItem,
            pressed && styles.attachmentMenuItemPressed,
            index < menuItems.length - 1 && styles.attachmentMenuItemBorder,
          ]}
        >
          <View style={styles.attachmentMenuItemIcon}>
            <Ionicons name={item.icon} size={20} color={colors.primary} />
          </View>
          <View style={styles.attachmentMenuItemContent}>
            <Text style={styles.attachmentMenuItemTitle}>{item.title}</Text>
            <Text style={styles.attachmentMenuItemSubtitle}>{item.subtitle}</Text>
          </View>
        </Pressable>
      ))}
    </Animated.View>
  );
};

/**
 * Action Button Component
 */
const ActionButton: React.FC<{
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'danger' | 'success';
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
    variant === 'danger'
      ? colors.error
      : variant === 'success'
      ? colors.accentGreen
      : colors.primary;

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

  // Store selectors (optimized to only re-render when relevant data changes)
  const activePods = usePodStore((state) => state.activePods);
  const leavePod = usePodStore((state) => state.leavePod);
  const completePod = usePodStore((state) => state.completePod);
  const chatMessages = usePodStore((state) => state.chatMessages[podId] || EMPTY_MESSAGES);
  const fetchChatMessages = usePodStore((state) => state.fetchChatMessages);
  const sendMessage = usePodStore((state) => state.sendMessage);
  const confirmArrival = usePodStore((state) => state.confirmArrival);
  const isSendingMessage = usePodStore((state) => state.isSendingMessage[podId] || false);

  const user = useAuthStore((state) => state.user);
  const userId = user?.id;

  const [pod, setPod] = useState<Pod | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null); // Message being replied to
  const [isConfirming, setIsConfirming] = useState(false);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [isTyping, setIsTyping] = useState(false); // Someone else is typing

  const chatListRef = useRef<FlatList>(null);

  // Find the pod from store
  useEffect(() => {
    const foundPod = activePods.find((p) => p.id === podId);
    setPod(foundPod || null);
  }, [podId, activePods]);

  // Fetch chat messages when screen loads
  useEffect(() => {
    fetchChatMessages(podId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [podId]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatMessages.length > 0 && chatListRef.current) {
      setTimeout(() => {
        chatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [chatMessages.length]);

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

  // Get minutes remaining (for timer color logic)
  const getMinutesRemaining = (): number => {
    if (!pod) return 0;

    const expiresAt = new Date(pod.expiresAt);
    const now = new Date();
    const diffMs = expiresAt.getTime() - now.getTime();
    return Math.floor(diffMs / 60000);
  };

  // Get timer color based on urgency
  const getTimerColor = (): string => {
    const minutes = getMinutesRemaining();

    if (minutes < 0) return colors.text.disabled; // Expired
    if (minutes < 30) return colors.error; // Red for urgent (< 30 min)
    if (minutes < 60) return colors.accentYellow; // Yellow for moderate (30-60 min)
    return colors.accentGreen; // Green for plenty of time (> 60 min)
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

  // Handle send message
  const handleSendMessage = async (): Promise<void> => {
    const trimmedMessage = messageInput.trim();
    if ((!trimmedMessage && attachments.length === 0) || isSendingMessage) return;

    const messageContent = trimmedMessage || '';
    const messageAttachments = [...attachments];
    const replyToId = replyingTo?.id;

    // Clear input, attachments, and reply state immediately
    setMessageInput('');
    setAttachments([]);
    setReplyingTo(null);

    await sendMessage(podId, messageContent, messageAttachments, replyToId);
  };

  // Handle long-press to reply
  const handleReply = (message: ChatMessage): void => {
    // Don't reply to system messages
    if (message.messageType === 'system') return;

    setReplyingTo(message);
    // Focus input (handled automatically by the reply bar being visible)
  };

  // Cancel reply
  const cancelReply = (): void => {
    setReplyingTo(null);
  };

  // Handle tapping reply context to scroll to original message
  const handleReplyContextPress = (messageId: string): void => {
    const messageIndex = chatMessages.findIndex(m => m.id === messageId);
    if (messageIndex !== -1 && chatListRef.current) {
      try {
        // Scroll to the message
        chatListRef.current.scrollToIndex({
          index: messageIndex,
          animated: true,
          viewPosition: 0.5, // Center the message on screen
        });
      } catch (error) {
        // Fallback: If scrollToIndex fails (e.g., message not rendered yet),
        // use scrollToOffset as a backup
        console.log('scrollToIndex failed, message might not be rendered yet:', error);
        // Could implement a fallback here if needed
      }
    }
  };

  // Handle image picker
  const handlePickImage = async (): Promise<void> => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'We need access to your photos to send images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        // For now, add as local attachment - will upload when sending
        const imageAttachment: ImageAttachment = {
          type: 'image',
          url: asset.uri,
          width: asset.width,
          height: asset.height,
        };
        setAttachments([...attachments, imageAttachment]);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  // Handle camera
  const handleTakePhoto = async (): Promise<void> => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'We need access to your camera to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const imageAttachment: ImageAttachment = {
          type: 'image',
          url: asset.uri,
          width: asset.width,
          height: asset.height,
        };
        setAttachments([...attachments, imageAttachment]);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  // Handle emoji selection
  const handleSelectEmoji = (emoji: string): void => {
    const emojiAttachment: EmojiAttachment = {
      type: 'emoji',
      emoji,
    };
    setAttachments([...attachments, emojiAttachment]);
    setShowEmojiPicker(false);
  };

  // Handle GIF selection (placeholder - will integrate Giphy API)
  const handleSelectGif = (gifUrl: string, gifId?: string): void => {
    const gifAttachment: GifAttachment = {
      type: 'gif',
      url: gifUrl,
      gifId,
    };
    setAttachments([...attachments, gifAttachment]);
    setShowGifPicker(false);
  };

  // Remove attachment
  const handleRemoveAttachment = (index: number): void => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  // Handle confirm arrival
  const handleConfirmArrival = async (): Promise<void> => {
    if (isConfirming) return;

    setIsConfirming(true);
    try {
      await confirmArrival(podId);
    } catch (error) {
      Alert.alert('Error', 'Failed to confirm arrival. Please try again.');
    } finally {
      setIsConfirming(false);
    }
  };

  // Handle open in maps
  const handleOpenInMaps = (): void => {
    if (!pod?.location) return;

    const { latitude, longitude } = pod.location;
    const label = pod.meetingPlaceName || 'Meeting Point';

    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${latitude},${longitude}`,
      android: `geo:0,0?q=${latitude},${longitude}(${label})`,
    });

    if (url) {
      Linking.openURL(url).catch(() => {
        Alert.alert('Error', 'Could not open maps');
      });
    }
  };

  // Check if current user has confirmed
  const hasConfirmed = pod?.confirmedUserIds?.includes(userId || '') || false;

  // Get available mentions (@vibe + pod members)
  const getMentionSuggestions = (): Array<{ id: string; username: string; isAI: boolean }> => {
    const suggestions = [{ id: 'vibe', username: 'vibe', isAI: true }];

    if (pod?.members) {
      pod.members.forEach((member) => {
        if (member.userId !== userId) {
          suggestions.push({ id: member.userId, username: member.username, isAI: false });
        }
      });
    }

    return suggestions.filter((s) =>
      s.username.toLowerCase().includes(mentionQuery.toLowerCase())
    );
  };

  // Handle message input change (detect @mentions)
  const handleMessageInputChange = (text: string): void => {
    setMessageInput(text);

    // Check if user is typing a mention
    const cursorPosition = text.length; // Simplified: assume cursor is at end
    const textBeforeCursor = text.slice(0, cursorPosition);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');

    if (lastAtSymbol !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtSymbol + 1);

      // Check if there's no space after @
      if (!textAfterAt.includes(' ')) {
        setMentionQuery(textAfterAt);
        setMentionStartIndex(lastAtSymbol);
        setShowMentionSuggestions(true);
        return;
      }
    }

    // Hide suggestions if no @ or space after @
    setShowMentionSuggestions(false);
    setMentionQuery('');
    setMentionStartIndex(-1);
  };

  // Handle selecting a mention
  const handleSelectMention = (username: string): void => {
    if (mentionStartIndex === -1) return;

    const before = messageInput.slice(0, mentionStartIndex);
    const after = messageInput.slice(messageInput.length);
    const newText = `${before}@${username} ${after}`;

    setMessageInput(newText);
    setShowMentionSuggestions(false);
    setMentionQuery('');
    setMentionStartIndex(-1);
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

  // Handle menu press (three dots)
  const handleMenuPress = (): void => {
    const options = [];

    if (pod.status === 'active') {
      options.push({
        text: 'Mark Complete',
        onPress: handleCompletePod,
      });
    }

    if (pod.status === 'forming' || pod.status === 'active') {
      options.push({
        text: 'Leave Pod',
        onPress: handleLeavePod,
        style: 'destructive' as const,
      });
    }

    options.push({
      text: 'Cancel',
      style: 'cancel' as const,
    });

    Alert.alert('Pod Options', undefined, options);
  };

  // Render header content for FlatList
  const renderHeader = () => null;

  // Render footer content for FlatList
  const renderFooter = () => (
    <View style={styles.footerSpacer} />
  );

  // Render empty chat state
  const renderEmptyChat = () => (
    <EmptyChatState />
  );

  // Helper function to determine if messages should be grouped
  const shouldGroupMessages = (current: ChatMessage, previous: ChatMessage | null): boolean => {
    if (!previous) return false;
    if (current.messageType === 'system' || current.messageType === 'ai') return false;
    if (previous.messageType === 'system' || previous.messageType === 'ai') return false;
    if (current.userId !== previous.userId) return false;

    // Check time difference (group if within 2 minutes)
    const currentTime = new Date(current.createdAt).getTime();
    const previousTime = new Date(previous.createdAt).getTime();
    const diffMinutes = (currentTime - previousTime) / 1000 / 60;

    return diffMinutes <= 2;
  };

  // Helper function to get grouping info for a message
  const getMessageGroupInfo = (index: number): { isGroupStart: boolean; isGroupEnd: boolean } => {
    const message = chatMessages[index];
    if (!message) return { isGroupStart: true, isGroupEnd: true };

    const previousMessage = index > 0 ? chatMessages[index - 1] : null;
    const nextMessage = index < chatMessages.length - 1 ? chatMessages[index + 1] : null;

    const groupedWithPrevious = shouldGroupMessages(message, previousMessage);
    const groupedWithNext = nextMessage ? shouldGroupMessages(nextMessage, message) : false;

    return {
      isGroupStart: !groupedWithPrevious,
      isGroupEnd: !groupedWithNext,
    };
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Clean Header */}
      <View style={styles.modernHeader}>
        {/* Left: Back Button */}
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [
            styles.backButtonHeader,
            pressed && styles.backButtonHeaderPressed,
          ]}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </Pressable>

        {/* Center: Avatars */}
        <View style={styles.avatarRow}>
          {pod.members.slice(0, 4).map((member, index) => (
            <View
              key={member.userId}
              style={[
                styles.miniAvatarContainer,
                index > 0 && { marginLeft: -8 },
              ]}
            >
              <View style={styles.miniAvatar}>
                <Text style={styles.miniAvatarText}>
                  {member.username.charAt(0).toUpperCase()}
                </Text>
              </View>
              {/* Active status indicator - green dot */}
              {pod.status === 'active' && (
                <View style={styles.activeStatusDot} />
              )}
            </View>
          ))}
          {pod.memberCount > 4 && (
            <View style={[styles.miniAvatar, { marginLeft: -8 }]}>
              <Text style={styles.miniAvatarText}>+{pod.memberCount - 4}</Text>
            </View>
          )}
        </View>

        {/* Right: Activity & Timer */}
        <View style={styles.headerCenter}>
          <Text style={styles.modernActivity} numberOfLines={1}>{pod.activity}</Text>
          <View style={styles.timerRow}>
            {pod.status === 'active' && (
              <View style={styles.liveDot} />
            )}
            <Text style={[styles.modernTimer, { color: getTimerColor() }]}>
              {getTimeRemaining()}
            </Text>
          </View>
        </View>

        {/* Far Right: Menu */}
        <Pressable
          onPress={handleMenuPress}
          style={({ pressed }) => [
            styles.menuButton,
            pressed && styles.menuButtonPressed,
          ]}
        >
          <Text style={styles.menuIcon}>•••</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={chatListRef}
          data={chatMessages}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => {
            const groupInfo = getMessageGroupInfo(index);
            return (
              <ChatMessageBubble
                message={item}
                isCurrentUser={item.userId === userId}
                onLongPress={handleReply}
                onReplyContextPress={handleReplyContextPress}
                isGroupStart={groupInfo.isGroupStart}
                isGroupEnd={groupInfo.isGroupEnd}
                showTimestamp={groupInfo.isGroupEnd}
              />
            );
          }}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmptyChat}
          contentContainerStyle={styles.chatList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            if (chatMessages.length > 0) {
              chatListRef.current?.scrollToEnd({ animated: true });
            }
          }}
          onScrollToIndexFailed={(info) => {
            // Handle scroll failure gracefully
            const wait = new Promise(resolve => setTimeout(resolve, 500));
            wait.then(() => {
              chatListRef.current?.scrollToIndex({
                index: info.index,
                animated: true,
                viewPosition: 0.5,
              });
            });
          }}
        />

        {/* Typing Indicator */}
        {isTyping && <TypingIndicator />}

        {/* Mention Suggestions Dropdown */}
        {showMentionSuggestions && (pod.status === 'forming' || pod.status === 'active') && (
          <View style={styles.mentionSuggestionsContainer}>
            <FlatList
              data={getMentionSuggestions()}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => handleSelectMention(item.username)}
                  style={({ pressed }) => [
                    styles.mentionSuggestion,
                    pressed && styles.mentionSuggestionPressed,
                  ]}
                >
                  <View style={styles.mentionSuggestionContent}>
                    {item.isAI ? (
                      <Text style={styles.mentionSuggestionIcon}>🤖</Text>
                    ) : (
                      <View style={styles.mentionSuggestionAvatar}>
                        <Text style={styles.mentionSuggestionAvatarText}>
                          {item.username.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.mentionSuggestionUsername}>
                      @{item.username}
                    </Text>
                    {item.isAI && (
                      <Text style={styles.mentionSuggestionLabel}>AI Assistant</Text>
                    )}
                  </View>
                </Pressable>
              )}
              style={styles.mentionSuggestionsList}
              keyboardShouldPersistTaps="handled"
            />
          </View>
        )}

        {/* Chat Input */}
        {(pod.status === 'forming' || pod.status === 'active') && (
          <>
            {/* Reply Indicator Bar */}
            {replyingTo && (
              <View style={styles.replyIndicatorContainer}>
                <View style={styles.replyIndicatorBar} />
                <View style={styles.replyIndicatorContent}>
                  <Text style={styles.replyIndicatorLabel}>
                    ↩ Replying to @{replyingTo.username}
                  </Text>
                  <Text style={styles.replyIndicatorPreview} numberOfLines={1}>
                    {replyingTo.content}
                  </Text>
                </View>
                <Pressable
                  onPress={cancelReply}
                  style={({ pressed }) => [
                    styles.replyIndicatorCloseButton,
                    pressed && styles.replyIndicatorCloseButtonPressed,
                  ]}
                >
                  <Ionicons name="close" size={18} color={colors.text.tertiary} />
                </Pressable>
              </View>
            )}

            {/* Attachment Preview */}
            {attachments.length > 0 && (
              <View style={styles.attachmentsPreviewContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {attachments.map((attachment, index) => (
                    <View key={index} style={styles.attachmentPreview}>
                      {attachment.type === 'image' && (
                        <>
                          <Image
                            source={{ uri: attachment.url }}
                            style={styles.attachmentPreviewImage}
                            contentFit="cover"
                          />
                          <Pressable
                            style={styles.attachmentRemoveButton}
                            onPress={() => handleRemoveAttachment(index)}
                          >
                            <Text style={styles.attachmentRemoveIcon}>×</Text>
                          </Pressable>
                        </>
                      )}
                      {attachment.type === 'gif' && (
                        <>
                          <Image
                            source={{ uri: attachment.thumbnailUrl || attachment.url }}
                            style={styles.attachmentPreviewImage}
                            contentFit="cover"
                          />
                          <Pressable
                            style={styles.attachmentRemoveButton}
                            onPress={() => handleRemoveAttachment(index)}
                          >
                            <Text style={styles.attachmentRemoveIcon}>×</Text>
                          </Pressable>
                        </>
                      )}
                      {attachment.type === 'emoji' && (
                        <View style={styles.attachmentPreviewEmoji}>
                          <Text style={styles.attachmentPreviewEmojiText}>{attachment.emoji}</Text>
                          <Pressable
                            style={styles.attachmentRemoveButton}
                            onPress={() => handleRemoveAttachment(index)}
                          >
                            <Text style={styles.attachmentRemoveIcon}>×</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={styles.chatInputContainer}>
              {/* Input Field with Plus Button Inside */}
              <View style={styles.inputWrapper}>
                {/* Plus Button Inside Input (Left Side) */}
                <AnimatedPlusButton
                  onPress={() => setShowAttachmentMenu(!showAttachmentMenu)}
                  isActive={showAttachmentMenu}
                />

                <TextInput
                  style={styles.chatInput}
                  value={messageInput}
                  onChangeText={handleMessageInputChange}
                  placeholder="say something..."
                  placeholderTextColor={colors.text.disabled}
                  multiline
                  maxLength={500}
                />
              </View>

              {/* Send Button */}
              <AnimatedSendButton
                onPress={handleSendMessage}
                disabled={(!messageInput.trim() && attachments.length === 0) || isSendingMessage}
                hasContent={!!messageInput.trim() || attachments.length > 0}
              />
            </View>

            {/* Attachment Menu Dropdown - Compact Above Input */}
            {showAttachmentMenu && (
              <>
                {/* Subtle backdrop - only covers input area */}
                <Pressable
                  style={styles.attachmentMenuBackdrop}
                  onPress={() => setShowAttachmentMenu(false)}
                />
                <AnimatedAttachmentMenu
                  onClose={() => setShowAttachmentMenu(false)}
                  onPhotoPress={() => {
                    setShowAttachmentMenu(false);
                    Alert.alert(
                      'Add Image',
                      'Choose an option',
                      [
                        { text: 'Camera', onPress: handleTakePhoto },
                        { text: 'Photo Library', onPress: handlePickImage },
                        { text: 'Cancel', style: 'cancel' },
                      ]
                    );
                  }}
                  onGifPress={() => {
                    setShowAttachmentMenu(false);
                    setShowGifPicker(true);
                  }}
                  onEmojiPress={() => {
                    setShowAttachmentMenu(false);
                    setShowEmojiPicker(true);
                  }}
                  onLocationPress={pod.location ? handleOpenInMaps : undefined}
                />
              </>
            )}

            {/* Emoji Picker */}
            {showEmojiPicker && (
              <View style={styles.emojiPickerContainer}>
                <EmojiPicker onSelectEmoji={handleSelectEmoji} />
              </View>
            )}

            {/* GIF Picker */}
            {showGifPicker && (
              <View style={styles.gifPickerContainer}>
                <GifPicker onSelectGif={handleSelectGif} />
              </View>
            )}
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Modern Clean Header
  modernHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
  },

  backButtonHeader: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },

  backButtonHeaderPressed: {
    opacity: 0.6,
  },

  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginHorizontal: spacing.sm,
  },

  miniAvatarContainer: {
    position: 'relative',
  },

  miniAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },

  activeStatusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accentGreen,
    borderWidth: 2,
    borderColor: colors.background,
  },

  miniAvatarText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },

  headerCenter: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },

  modernActivity: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs / 2,
  },

  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },

  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.error,
  },

  modernTimer: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.tertiary,
  },

  menuButton: {
    padding: spacing.sm,
  },

  menuButtonPressed: {
    opacity: 0.5,
  },

  menuIcon: {
    fontSize: typography.fontSize.lg,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 2,
  },

  header: {
    padding: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary + '20',
    ...shadows.lg,
  },

  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },

  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },

  headerButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },

  headerButtonPressed: {
    opacity: 0.5,
  },

  headerButtonText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.tertiary,
  },

  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },

  headerLeft: {
    flex: 1,
  },

  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },

  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  liveIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },

  liveIndicatorPulse: {
    position: 'absolute',
    left: 0,
    width: 12,
    height: 12,
    borderRadius: borderRadius.full,
    backgroundColor: colors.error,
  },

  liveIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: borderRadius.full,
    backgroundColor: colors.error,
  },

  liveIndicatorText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.error,
    letterSpacing: 1,
  },

  activity: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
    lineHeight: typography.fontSize.xxl * 1.2,
  },

  category: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.tertiary,
  },

  timeContainer: {
    alignItems: 'flex-end',
    minWidth: 80,
  },

  timeLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
  },

  timeText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },

  timeProgressBar: {
    width: '100%',
    height: 6,
    backgroundColor: colors.text.disabled + '20',
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },

  timeProgressFill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },

  section: {
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },

  sectionTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: spacing.md,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },

  // Meeting Point
  meetingPointCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    ...shadows.md,
  },

  meetingPointInfo: {
    marginBottom: spacing.lg,
  },

  meetingPlaceName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },

  meetingPlaceCoords: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.regular,
    color: colors.text.tertiary,
  },

  mapsButton: {
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    ...shadows.md,
  },

  mapsButtonPressed: {
    opacity: 0.8,
  },

  mapsButtonText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },

  // Confirmation
  confirmationStatus: {
    backgroundColor: colors.accentGreen + '20',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    alignItems: 'center',
  },

  confirmationText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.accentGreen,
  },

  confirmedBadge: {
    backgroundColor: colors.accentGreen + '20',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
  },

  confirmedBadgeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.accentGreen,
  },

  // Members
  memberCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.md,
  },

  memberAvatarContainer: {
    position: 'relative',
    marginRight: spacing.lg,
  },

  memberAvatar: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  memberAvatarText: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },

  confirmedDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: borderRadius.full,
    backgroundColor: colors.accentGreen,
    borderWidth: 3,
    borderColor: colors.background,
  },

  memberInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  memberNameContainer: {
    flex: 1,
  },

  memberName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },

  confirmedText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.accentGreen,
    marginTop: spacing.xs,
  },

  memberBadge: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
    backgroundColor: colors.primary + '30',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    letterSpacing: 0.5,
  },

  // Chat
  chatSection: {
    marginBottom: spacing.lg,
  },

  chatContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    minHeight: 200,
    maxHeight: 400,
    ...shadows.sm,
  },

  chatList: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    flexGrow: 1,
  },

  emptyChatContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
  },

  emptyChatEmoji: {
    fontSize: 56,
    marginBottom: spacing.lg,
  },

  emptyChatText: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },

  emptyChatHint: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.regular,
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: typography.fontSize.md * 1.5,
  },

  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: spacing.xs,
  },

  systemMessageText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.tertiary,
    fontStyle: 'italic',
  },

  // @vibe AI Message (centered, purple tint)
  aiMessageContainer: {
    marginVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
    alignItems: 'center', // Center the message
  },

  aiMessageBubble: {
    backgroundColor: colors.primary + '10', // Subtle purple tint (10% opacity)
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm,
    maxWidth: '85%',
    alignItems: 'center', // Center content inside bubble
    ...shadows.sm,
  },

  aiMessageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },

  aiMessageIcon: {
    fontSize: 16,
    marginRight: spacing.xs / 2,
  },

  aiMessageUsername: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary,
    letterSpacing: 0.3,
  },

  aiMessageContentRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },

  aiMessageText: {
    fontSize: 14,
    fontWeight: typography.fontWeight.regular,
    color: colors.text.primary,
    lineHeight: 14 * 1.4,
    textAlign: 'center',
    fontStyle: 'italic',
    flexShrink: 1,
  },

  aiMessageTime: {
    fontSize: 11,
    fontWeight: typography.fontWeight.regular,
    color: colors.text.disabled,
    marginLeft: spacing.xs,
    marginBottom: 1,
  },

  messageBubbleContainer: {
    marginVertical: 2,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    width: '100%',
  },

  messageBubbleGrouped: {
    marginTop: 1, // Tighter spacing for grouped messages
  },

  messageBubbleLeft: {
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    flex: 0,
  },

  messageBubbleRight: {
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    flex: 1,
    flexDirection: 'row',
  },

  messageBubble: {
    maxWidth: '75%',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs + 2,
    paddingBottom: spacing.xs,
    ...shadows.sm,
  },

  messageBubbleUser: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: borderRadius.sm,
  },

  messageBubbleOther: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.surfaceHover,
  },

  messageUsername: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.secondary,
    marginBottom: spacing.xs / 2,
  },

  messageContentRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
  },

  messageTextContainer: {
    flexShrink: 1,
  },

  messageText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.regular,
    lineHeight: typography.fontSize.md * 1.3,
  },

  messageTextUser: {
    color: '#FFFFFF',
  },

  messageTextOther: {
    color: colors.text.primary,
  },

  messageTimeInline: {
    fontSize: 11,
    fontWeight: typography.fontWeight.regular,
    marginLeft: spacing.xs,
    marginBottom: 1,
    alignSelf: 'flex-end',
  },

  messageTimeUser: {
    color: 'rgba(255, 255, 255, 0.6)',
  },

  messageTimeOther: {
    color: colors.text.disabled,
  },

  // Mention highlighting
  mentionText: {
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
    backgroundColor: colors.primary + '20',
    borderRadius: 4,
    paddingHorizontal: 4,
  },

  mentionTextVibe: {
    color: colors.primaryLight,
    backgroundColor: colors.primaryLight + '20',
  },

  // Reply Context (inside message bubble)
  replyContext: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
    paddingLeft: spacing.xs,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceHover + '40',
  },

  replyContextPressed: {
    opacity: 0.6,
  },

  replyContextBar: {
    width: 3,
    backgroundColor: colors.primary,
    borderRadius: 2,
    marginRight: spacing.xs,
  },

  replyContextContent: {
    flex: 1,
  },

  replyContextUsername: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
    marginBottom: 2,
  },

  replyContextText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.regular,
    color: colors.text.tertiary,
    fontStyle: 'italic',
  },

  replyContextTextUser: {
    color: 'rgba(255, 255, 255, 0.7)',
  },

  // Reply context styles for AI messages
  replyContextAi: {
    borderBottomColor: 'rgba(255, 200, 100, 0.3)',
  },

  replyContextUsernameAi: {
    color: 'rgba(255, 150, 50, 0.9)',
  },

  replyContextTextAi: {
    color: 'rgba(0, 0, 0, 0.5)',
  },

  // Reply Indicator (above input)
  replyIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceHover,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },

  replyIndicatorBar: {
    width: 3,
    height: 32,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },

  replyIndicatorContent: {
    flex: 1,
  },

  replyIndicatorLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary,
    marginBottom: 2,
  },

  replyIndicatorPreview: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.regular,
    color: colors.text.secondary,
  },

  replyIndicatorCloseButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceHover,
  },

  replyIndicatorCloseButtonPressed: {
    opacity: 0.6,
  },

  // Chat Input (Modern)
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.surface,
    gap: spacing.sm,
  },

  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.surfaceHover,
    paddingLeft: spacing.xs,
    paddingRight: spacing.sm,
    minHeight: 44,
  },

  attachButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.xs,
  },

  attachButtonPressed: {
    opacity: 0.6,
  },

  attachButtonActive: {
    backgroundColor: colors.primary + '15',
  },

  chatInput: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm + 2,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.regular,
    color: colors.text.primary,
    maxHeight: 100,
    minHeight: 36,
  },

  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.md,
    ...shadows.sm,
    overflow: 'hidden',
    position: 'relative',
  },

  sendButtonGlow: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: 32,
    backgroundColor: colors.primary,
  },

  sendButtonPressed: {
    opacity: 0.9,
  },

  sendButtonDisabled: {
    opacity: 0.3,
  },

  // Attachments
  attachmentsContainer: {
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },

  attachmentContainer: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },

  attachmentImage: {
    width: 200,
    height: 200,
    borderRadius: borderRadius.md,
  },

  attachmentGif: {
    width: 200,
    height: 200,
    borderRadius: borderRadius.md,
  },

  attachmentEmoji: {
    fontSize: 48,
    lineHeight: 48,
  },

  attachmentsPreviewContainer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceHover,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    maxHeight: 100,
  },

  attachmentPreview: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.md,
    marginRight: spacing.sm,
    position: 'relative',
    overflow: 'hidden',
  },

  attachmentPreviewImage: {
    width: '100%',
    height: '100%',
  },

  attachmentPreviewEmoji: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceHover,
  },

  attachmentPreviewEmojiText: {
    fontSize: 32,
  },

  attachmentRemoveButton: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },

  attachmentRemoveIcon: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: typography.fontWeight.bold,
    lineHeight: 14,
  },

  attachmentMenuBackdrop: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: 'transparent',
    zIndex: 997,
  },

  attachmentMenuContainer: {
    position: 'absolute',
    bottom: 56,
    left: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.xs,
    ...shadows.lg,
    borderWidth: 1,
    borderColor: colors.surfaceHover,
    zIndex: 998,
    elevation: 8,
    width: 280,
    alignSelf: 'flex-start',
  },

  attachmentMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    minHeight: 48,
  },

  attachmentMenuItemPressed: {
    backgroundColor: colors.surfaceHover,
  },

  attachmentMenuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceHover,
  },

  attachmentMenuItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },

  attachmentMenuItemContent: {
    flex: 1,
    marginLeft: spacing.xs,
  },

  attachmentMenuItemTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: 1,
  },

  attachmentMenuItemSubtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },

  emojiPickerContainer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceHover,
    maxHeight: 250,
    paddingVertical: spacing.md,
  },

  gifPickerContainer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceHover,
    maxHeight: 300,
    paddingVertical: spacing.md,
  },

  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 999,
  },

  // Mention Suggestions
  mentionSuggestionsContainer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.text.disabled + '20',
    maxHeight: 200,
    ...shadows.lg,
  },

  mentionSuggestionsList: {
    flexGrow: 0,
  },

  mentionSuggestion: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.text.disabled + '10',
  },

  mentionSuggestionPressed: {
    backgroundColor: colors.primary + '15',
  },

  mentionSuggestionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  mentionSuggestionIcon: {
    fontSize: typography.fontSize.xl,
  },

  mentionSuggestionAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary + '30',
    justifyContent: 'center',
    alignItems: 'center',
  },

  mentionSuggestionAvatarText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },

  mentionSuggestionUsername: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    flex: 1,
  },

  mentionSuggestionLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.regular,
    color: colors.text.secondary,
    fontStyle: 'italic',
  },

  // Footer spacer
  footerSpacer: {
    height: spacing.lg,
  },

  // Old action button styles (kept for ActionButton component used elsewhere)
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

  // Error
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
