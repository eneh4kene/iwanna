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
 * Animated Backdrop Component
 */
const BackdropAnimated: React.FC<{
  opacity: Animated.SharedValue<number>;
  onPress: () => void;
}> = ({ opacity, onPress }) => {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.backdrop, animatedStyle]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onPress} />
    </Animated.View>
  );
};

/**
 * Animated Attachment Menu Component
 */
const AttachmentMenuAnimated: React.FC<{
  translateY: Animated.SharedValue<number>;
  opacity: Animated.SharedValue<number>;
  onClose: () => void;
  pod: Pod | null;
  handleOpenInMaps: () => void;
  handleTakePhoto: () => Promise<void>;
  handlePickImage: () => Promise<void>;
  setShowGifPicker: (show: boolean) => void;
  setShowEmojiPicker: (show: boolean) => void;
}> = ({
  translateY,
  opacity,
  onClose,
  pod,
  handleOpenInMaps,
  handleTakePhoto,
  handlePickImage,
  setShowGifPicker,
  setShowEmojiPicker,
}) => {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.attachmentMenuContainer, animatedStyle]}>
      <Pressable
        onPress={() => {
          onClose();
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
        style={({ pressed }) => [
          styles.attachmentMenuItem,
          pressed && styles.attachmentMenuItemPressed,
        ]}
      >
        <View style={styles.attachmentMenuItemIcon}>
          <Ionicons name="camera-outline" size={22} color={colors.primary} />
        </View>
        <View style={styles.attachmentMenuItemContent}>
          <Text style={styles.attachmentMenuItemTitle}>Photo</Text>
          <Text style={styles.attachmentMenuItemSubtitle}>Camera or library</Text>
        </View>
      </Pressable>

      {/* Location option - moved into menu */}
      {pod?.location && (
        <Pressable
          onPress={() => {
            onClose();
            handleOpenInMaps();
          }}
          style={({ pressed }) => [
            styles.attachmentMenuItem,
            pressed && styles.attachmentMenuItemPressed,
          ]}
        >
          <View style={styles.attachmentMenuItemIcon}>
            <Ionicons name="location-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.attachmentMenuItemContent}>
            <Text style={styles.attachmentMenuItemTitle}>Location</Text>
            <Text style={styles.attachmentMenuItemSubtitle}>Open in Maps</Text>
          </View>
        </Pressable>
      )}

      <Pressable
        onPress={() => {
          onClose();
          setShowGifPicker(true);
        }}
        style={({ pressed }) => [
          styles.attachmentMenuItem,
          pressed && styles.attachmentMenuItemPressed,
        ]}
      >
        <View style={styles.attachmentMenuItemIcon}>
          <Ionicons name="play-circle-outline" size={22} color={colors.primary} />
        </View>
        <View style={styles.attachmentMenuItemContent}>
          <Text style={styles.attachmentMenuItemTitle}>GIF</Text>
          <Text style={styles.attachmentMenuItemSubtitle}>Search GIFs</Text>
        </View>
      </Pressable>

      <Pressable
        onPress={() => {
          onClose();
          setShowEmojiPicker(true);
        }}
        style={({ pressed }) => [
          styles.attachmentMenuItem,
          pressed && styles.attachmentMenuItemPressed,
        ]}
      >
        <View style={styles.attachmentMenuItemIcon}>
          <Ionicons name="happy-outline" size={22} color={colors.primary} />
        </View>
        <View style={styles.attachmentMenuItemContent}>
          <Text style={styles.attachmentMenuItemTitle}>Emoji</Text>
          <Text style={styles.attachmentMenuItemSubtitle}>Choose emoji</Text>
        </View>
      </Pressable>
    </Animated.View>
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
 * Chat Message Bubble Component
 */
const ChatMessageBubble: React.FC<{
  message: ChatMessage;
  isCurrentUser: boolean;
}> = ({ message, isCurrentUser }) => {
  const isSystemMessage = message.messageType === 'system';
  const isAiMessage = message.messageType === 'ai';

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
      <View style={styles.aiMessageContainer}>
        <LinearGradient
          colors={['rgba(255, 200, 100, 0.1)', 'rgba(255, 150, 50, 0.05)']}
          style={styles.aiMessageBubble}
        >
          <View style={styles.aiMessageHeader}>
            <Text style={styles.aiMessageIcon}>✨</Text>
            <Text style={styles.aiMessageUsername}>@vibe</Text>
          </View>
          <Text style={styles.aiMessageText}>{message.content}</Text>
          <Text style={styles.aiMessageTime}>
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </LinearGradient>
      </View>
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
    <View
      style={[
        styles.messageBubbleContainer,
        isCurrentUser ? styles.messageBubbleRight : styles.messageBubbleLeft,
      ]}
    >
      <View
        style={[
          styles.messageBubble,
          isCurrentUser ? styles.messageBubbleUser : styles.messageBubbleOther,
        ]}
      >
        {!isCurrentUser && (
          <Text style={styles.messageUsername}>{message.username}</Text>
        )}
        
        {/* Render attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <View style={styles.attachmentsContainer}>
            {message.attachments.map((attachment, index) => renderAttachment(attachment, index))}
          </View>
        )}
        
        {/* Render text content if present */}
        {message.content && message.content.trim() && (
          renderMessageWithMentions(message.content, messageTextStyle)
        )}
        
        <View style={styles.messageTimeContainer}>
          <Text style={[
            styles.messageTime,
            isCurrentUser ? styles.messageTimeUser : styles.messageTimeOther,
          ]}>
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
    </View>
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
  const [isConfirming, setIsConfirming] = useState(false);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [isTyping, setIsTyping] = useState(false); // Someone else is typing

  const chatListRef = useRef<FlatList>(null);
  
  // Animation values for attachment menu slide-up
  const attachmentMenuTranslateY = useSharedValue(300);
  const attachmentMenuOpacity = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);

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

  // Animate attachment menu
  useEffect(() => {
    if (showAttachmentMenu) {
      attachmentMenuTranslateY.value = withSpring(0, animation.spring.gentle);
      attachmentMenuOpacity.value = withTiming(1, { duration: animation.duration.normal });
      backdropOpacity.value = withTiming(1, { duration: animation.duration.normal });
    } else {
      attachmentMenuTranslateY.value = withSpring(300, animation.spring.gentle);
      attachmentMenuOpacity.value = withTiming(0, { duration: animation.duration.fast });
      backdropOpacity.value = withTiming(0, { duration: animation.duration.fast });
    }
  }, [showAttachmentMenu]);

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
    
    // Clear input and attachments immediately
    setMessageInput('');
    setAttachments([]);
    
    await sendMessage(podId, messageContent, messageAttachments);
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
    <View style={styles.emptyChatContainer}>
      <Text style={styles.emptyChatEmoji}>👋</Text>
      <Text style={styles.emptyChatText}>no messages yet</Text>
      <Text style={styles.emptyChatHint}>say hi & see where the vibe takes you ✨</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Clean Header */}
      <View style={styles.modernHeader}>
        {/* Left: Avatars */}
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

        {/* Center: Activity & Timer */}
        <View style={styles.headerCenter}>
          <Text style={styles.modernActivity}>{pod.activity}</Text>
          <View style={styles.timerRow}>
            {pod.status === 'active' && (
              <View style={styles.liveDot} />
            )}
            <Text style={[styles.modernTimer, { color: getTimerColor() }]}>
              {getTimeRemaining()}
            </Text>
          </View>
        </View>

        {/* Right: Menu */}
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
          renderItem={({ item }) => (
            <ChatMessageBubble
              message={item}
              isCurrentUser={item.userId === userId}
            />
          )}
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
            {/* Backdrop overlay with animation */}
            {showAttachmentMenu && <BackdropAnimated opacity={backdropOpacity} onPress={() => setShowAttachmentMenu(false)} />}

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
              {/* Integrated Attachment Button inside input */}
              <View style={styles.inputWrapper}>
                {!messageInput.trim() && attachments.length === 0 && (
                  <Pressable
                    onPress={() => setShowAttachmentMenu(!showAttachmentMenu)}
                    style={({ pressed }) => [
                      styles.attachButtonIntegrated,
                      pressed && styles.attachButtonIntegratedPressed,
                    ]}
                  >
                    <Ionicons name="add-outline" size={20} color={colors.text.tertiary} />
                  </Pressable>
                )}
                
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

              <Pressable
                onPress={handleSendMessage}
                disabled={(!messageInput.trim() && attachments.length === 0) || isSendingMessage}
                style={({ pressed }) => [
                  styles.sendButton,
                  pressed && styles.sendButtonPressed,
                  ((!messageInput.trim() && attachments.length === 0) || isSendingMessage) && styles.sendButtonDisabled,
                ]}
              >
                <Ionicons 
                  name="arrow-up" 
                  size={18} 
                  color={((!messageInput.trim() && attachments.length === 0) || isSendingMessage) ? colors.text.disabled : '#FFFFFF'} 
                />
              </Pressable>
            </View>

            {/* Modern Attachment Menu - Slide Up Animation */}
            {showAttachmentMenu && pod && (
              <AttachmentMenuAnimated
                translateY={attachmentMenuTranslateY}
                opacity={attachmentMenuOpacity}
                onClose={() => setShowAttachmentMenu(false)}
                pod={pod}
                handleOpenInMaps={handleOpenInMaps}
                handleTakePhoto={handleTakePhoto}
                handlePickImage={handlePickImage}
                setShowGifPicker={setShowGifPicker}
                setShowEmojiPicker={setShowEmojiPicker}
              />
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

  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    alignItems: 'center',
    marginHorizontal: spacing.md,
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
    fontSize: 64,
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
    marginVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center', // Center the message
  },

  aiMessageBubble: {
    backgroundColor: colors.primary + '10', // Subtle purple tint (10% opacity)
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    maxWidth: '85%',
    alignItems: 'center', // Center content inside bubble
    ...shadows.sm,
  },

  aiMessageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },

  aiMessageIcon: {
    fontSize: 18, // Sparkle emoji size
    marginRight: spacing.xs,
  },

  aiMessageUsername: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary,
    letterSpacing: 0.3,
  },

  aiMessageText: {
    fontSize: 14, // Slightly smaller than human messages (16px)
    fontWeight: typography.fontWeight.regular,
    color: colors.text.primary,
    lineHeight: 14 * 1.5,
    textAlign: 'center', // Center text
    fontStyle: 'italic', // Differentiate from human messages
  },

  aiMessageTime: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.regular,
    color: colors.text.tertiary,
    marginTop: spacing.sm,
  },

  messageBubbleContainer: {
    marginVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    width: '100%',
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
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
    marginBottom: spacing.xs,
  },

  messageText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.regular,
    lineHeight: typography.fontSize.md * 1.4,
    marginBottom: spacing.xs,
  },

  messageTextUser: {
    color: '#FFFFFF',
  },

  messageTextOther: {
    color: colors.text.primary,
  },

  messageTimeContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.xs / 2,
  },

  messageTime: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.regular,
    marginTop: spacing.xs / 2,
  },

  messageTimeUser: {
    color: 'rgba(255, 255, 255, 0.75)',
  },

  messageTimeOther: {
    color: colors.text.tertiary,
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
    borderRadius: borderRadius.full,
    paddingLeft: spacing.md,
    paddingRight: spacing.md,
    minHeight: 44,
  },

  attachButtonIntegrated: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.xs,
  },

  attachButtonIntegratedPressed: {
    opacity: 0.6,
    transform: [{ scale: 0.95 }],
  },

  chatInput: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.regular,
    color: colors.text.primary,
    maxHeight: 100,
    minHeight: 20,
  },

  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  sendButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
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

  attachmentMenuContainer: {
    position: 'absolute',
    bottom: 80,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.sm,
    ...shadows.lg,
    borderWidth: 1,
    borderColor: colors.surfaceHover,
    zIndex: 1000,
    elevation: 10,
  },

  attachmentMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },

  attachmentMenuItemPressed: {
    backgroundColor: colors.surfaceHover,
  },

  attachmentMenuItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },

  attachmentMenuItemContent: {
    flex: 1,
  },

  attachmentMenuItemTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: 2,
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

  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10, 10, 15, 0.6)',
    zIndex: 998,
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
