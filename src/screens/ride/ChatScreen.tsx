
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { Layout } from '../../constants/Layout';
import { 
  sendChatMessage, 
  getChatHistory, 
  markMessagesAsRead, 
  sendTypingStart, 
  sendTypingStop,
  onChatMessage,
  onChatHistory,
  onTypingIndicator,
  onMessagesRead
} from '../../utils/socket';
import { useAuth } from '@clerk/clerk-expo';
import { getUserIdFromJWT } from '../../utils/jwtDecoder';
import { useChatNotifications } from '../../utils/chatNotificationHelper';

interface ChatMessage {
  id: string;
  rideId: string;
  senderId: string;
  senderType: 'user' | 'driver';
  message: string;
  timestamp: string;
  isRead: boolean;
}

const quickReplies = [
  'I need help with my ride',
  'I was charged incorrectly',
  'I have a complaint',
  'Thank you for your help',
];

export default function ChatScreen({ navigation, route }: any) {
  const { ride, driver } = route.params;
  const { getToken, isLoaded } = useAuth();
  const { sendChatNotificationToCurrentUser } = useChatNotifications();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isDriverTyping, setIsDriverTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const rideId = ride?.rideId || '';

  // Prevent back navigation during ride chat
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Allow going back to the previous ride screen (LiveTracking or RideInProgress)
      navigation.goBack();
      return true; // Prevent default back behavior
    });

    return () => backHandler.remove();
  }, [navigation]);

  // Get user ID from JWT when component mounts
  useEffect(() => {
    const getUserId = async () => {
      if (isLoaded) {
        try {
          const id = await getUserIdFromJWT(getToken);
          console.log('🔑 Got user ID from JWT:', id);
          setUserId(id);
        } catch (error) {
          console.error('❌ Error getting user ID from JWT:', error);
          // Try to get from route params as fallback
          const fallbackId = route.params?.userId || 'user123';
          console.log('🔄 Using fallback user ID:', fallbackId);
          setUserId(fallbackId);
          
          // Show error to user if it's a critical error
          if (error instanceof Error && error.message.includes('No token available')) {
            Alert.alert(
              'Authentication Error',
              'Unable to get user information. Please try logging in again.',
              [
                { text: 'OK', onPress: () => navigation.navigate('Login') }
              ]
            );
          }
        }
      }
    };

    getUserId();
  }, [isLoaded, getToken, route.params, navigation]);

  console.log('🔍 ChatScreen Debug:', {
    routeParams: route.params,
    ride,
    driver,
    userId,
    rideId,
    isLoaded
  });

  // Add more detailed debugging
  useEffect(() => {
    console.log('🔍 ChatScreen Mount Debug:', {
      routeParams: route.params,
      ride: ride,
      rideId: ride?.rideId,
      driver: driver,
      userId: userId,
      isLoaded: isLoaded
    });
  }, [route.params, userId, isLoaded]);

  useEffect(() => {
    // Wait for auth to be loaded and userId to be set
    if (!isLoaded) {
      console.log('⏳ Waiting for auth to load...');
      return;
    }

    if (!userId) {
      console.log('⏳ Waiting for user ID to be set...');
      return;
    }

    if (!rideId) {
      console.error('❌ Missing ride ID:', { rideId });
      Alert.alert('Error', 'Missing ride information');
      navigation.goBack();
      return;
    }

    console.log('✅ All data available, setting up chat:', { userId, rideId });

    // Set up chat event listeners
    const cleanupListeners = () => {
      // Clean up typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    };

    onChatMessage((message) => {
      console.log('💬 Received chat message:', message);
      setMessages(prev => [...prev, message]);
      
      // Send push notification for incoming messages from driver
      if (message.senderType === 'driver') {
        console.log('🔔 Sending high-priority chat notification for incoming message from pilot');
        
        // Send notification immediately with high priority
        sendChatNotificationToCurrentUser({
          rideId: message.rideId,
          senderId: message.senderId,
          senderName: driver?.name || 'Pilot',
          message: message.message,
          messageType: 'text',
          priority: 'high',
          sound: 'default',
          badge: 1
        }).then(success => {
          if (success) {
            console.log('✅ High-priority chat notification sent successfully');
          } else {
            console.log('❌ Failed to send high-priority chat notification');
          }
        }).catch(error => {
          console.error('❌ Error sending high-priority chat notification:', error);
        });
        
        // Mark message as read
        markMessagesAsRead({
          rideId: message.rideId,
          readerId: userId,
          readerType: 'user'
        });
      }
    });

    onChatHistory((data) => {
      console.log('📚 Received chat history:', data);
      if (data && data.messages) {
        console.log(`✅ Loaded ${data.messages.length} messages from chat history`);
        setMessages(data.messages);
      } else {
        console.log('ℹ️ No messages in chat history');
        setMessages([]);
      }
      setIsLoading(false);
    });

    onTypingIndicator((data) => {
      console.log('⌨️ Typing indicator:', data);
      if (data.senderType === 'driver') {
        setIsDriverTyping(data.isTyping);
      }
    });

    onMessagesRead((data) => {
      console.log('👁️ Messages read:', data);
      // Update read status for messages
      setMessages(prev => prev.map(msg => ({
        ...msg,
        isRead: msg.senderType === 'user' ? true : msg.isRead
      })));
    });

    // Load chat history
    loadChatHistory();

    return cleanupListeners;
  }, [userId, rideId, isLoaded, navigation]);

  const loadChatHistory = () => {
    if (userId && rideId) {
      console.log('📥 Loading chat history for ride:', rideId);
      getChatHistory({
        rideId: rideId,
        requesterId: userId,
        requesterType: 'user'
      });
      
      // Set a timeout in case chat history doesn't load
      setTimeout(() => {
        if (isLoading) {
          console.log('⚠️ Chat history load timeout - stopping loading state');
          setIsLoading(false);
        }
      }, 10000); // 10 seconds timeout
    } else {
      console.error('❌ Cannot load chat history - missing userId or rideId:', { userId, rideId });
      setIsLoading(false);
    }
  };

  const handleSendMessage = () => {
    if (newMessage.trim() && userId && rideId) {
      const messageData = {
        rideId: rideId,
        senderId: userId,
        senderType: 'user' as const,
        message: newMessage.trim()
      };

      sendChatMessage(messageData);
      setNewMessage('');
      
      // Stop typing indicator
      sendTypingStop({
        rideId: rideId,
        senderId: userId,
        senderType: 'user'
      });
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }
  };

  const handleQuickReply = (reply: string) => {
    setNewMessage(reply);
    handleSendMessage();
  };

  const handleTyping = (text: string) => {
    setNewMessage(text);
    
    // Send typing start
    if (text.length === 1 && userId && rideId) {
      sendTypingStart({
        rideId: rideId,
        senderId: userId,
        senderType: 'user'
      });
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set new timeout for typing stop
    typingTimeoutRef.current = setTimeout(() => {
      if (userId && rideId) {
        sendTypingStop({
          rideId: rideId,
          senderId: userId,
          senderType: 'user'
        });
      }
    }, 1000) as unknown as NodeJS.Timeout;
  };

  // Format timestamp to readable format
  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffInMs = now.getTime() - date.getTime();
      const diffInMins = Math.floor(diffInMs / 60000);
      
      if (diffInMins < 1) return 'Just now';
      if (diffInMins < 60) return `${diffInMins}m ago`;
      
      const hours = date.getHours();
      const mins = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      
      return `${displayHours}:${mins.toString().padStart(2, '0')} ${ampm}`;
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return timestamp;
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <View
      style={[
        styles.messageContainer,
        item.senderType === 'user' ? styles.userMessage : styles.driverMessage,
      ]}
    >
      <Text
        style={[
          styles.messageText,
          item.senderType === 'user' ? styles.userMessageText : styles.driverMessageText,
        ]}
      >
        {item.message}
      </Text>
      <View style={styles.messageFooter}>
        <Text
          style={[
            styles.timestamp,
            item.senderType === 'user' ? styles.userTimestamp : styles.driverTimestamp,
          ]}
        >
          {formatTimestamp(item.timestamp)}
        </Text>
        {item.senderType === 'user' && (
          <Ionicons 
            name={item.isRead ? "checkmark-done" : "checkmark"} 
            size={12} 
            color={item.isRead ? Colors.success : Colors.gray400} 
            style={styles.readIndicator}
          />
        )}
      </View>
    </View>
  );

  const renderTypingIndicator = () => {
    if (!isDriverTyping) return null;
    
    return (
      <View style={[styles.messageContainer, styles.driverMessage]}>
        <View style={styles.typingIndicator}>
          <View style={styles.typingDot} />
          <View style={styles.typingDot} />
          <View style={styles.typingDot} />
        </View>
      </View>
    );
  };

  // Show loading if auth is not loaded yet or user ID is not set
  if (!isLoaded || !userId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>
            {!isLoaded ? 'Loading chat...' : 'Getting user information...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.driverName}>{driver?.name || 'Pilot'}</Text>
          <Text style={styles.driverStatus}>
            {isDriverTyping ? 'Typing...' : 'Online'}
          </Text>
        </View>
        <TouchableOpacity style={styles.callButton}>
          <Ionicons name="call" size={24} color={Colors.primary} />
        </TouchableOpacity>
                 <TouchableOpacity 
           style={styles.testButton}
           onPress={() => {
             console.log('🧪 Testing chat notification...');
             // Use the last message from driver or a sample message
             const lastDriverMessage = messages
               .filter(msg => msg.senderType === 'driver')
               .pop();
             
             const testMessage = lastDriverMessage?.message || 'I\'m on my way to your pickup location';
             
                           sendChatNotificationToCurrentUser({
                rideId: rideId,
                senderId: 'test-pilot-123',
                senderName: driver?.name || 'Test Pilot',
                message: testMessage,
                messageType: 'text',
                priority: 'high',
                sound: 'default',
                badge: 1
              }).then(success => {
                console.log(success ? '✅ High-priority test notification sent' : '❌ High-priority test notification failed');
              });
           }}
         >
           <Ionicons name="notifications" size={20} color={Colors.success} />
         </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListFooterComponent={renderTypingIndicator}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading messages...</Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>Start a conversation with customer care</Text>
            </View>
          )
        }
      />

      {/* Quick Replies */}
      <View style={styles.quickRepliesContainer}>
        <FlatList
          data={quickReplies}
          horizontal
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.quickReplyButton}
              onPress={() => handleQuickReply(item)}
            >
              <Text style={styles.quickReplyText}>{item}</Text>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.quickRepliesContent}
        />
      </View>

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inputContainer}
      >
        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            placeholder="Type a message..."
            value={newMessage}
            onChangeText={handleTyping}
            multiline
            maxLength={500}
            onSubmitEditing={handleSendMessage}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              newMessage.trim() && styles.sendButtonActive,
            ]}
            onPress={handleSendMessage}
            disabled={!newMessage.trim()}
          >
            <Ionicons
              name="send"
              size={20}
              color={newMessage.trim() ? Colors.white : Colors.gray400}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical: Layout.spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backButton: {
    marginRight: Layout.spacing.md,
  },
  headerInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: Layout.fontSize.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  driverStatus: {
    fontSize: Layout.fontSize.sm,
    color: Colors.success,
  },
  callButton: {
    padding: Layout.spacing.sm,
  },
  testButton: {
    padding: Layout.spacing.sm,
    marginLeft: Layout.spacing.sm,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical: Layout.spacing.md,
  },
  messageContainer: {
    maxWidth: '80%',
    marginVertical: Layout.spacing.xs,
    padding: Layout.spacing.md,
    borderRadius: Layout.borderRadius.lg,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.primary,
    borderBottomRightRadius: Layout.borderRadius.sm,
  },
  driverMessage: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.white,
    borderBottomLeftRadius: Layout.borderRadius.sm,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  messageText: {
    fontSize: Layout.fontSize.md,
    lineHeight: 20,
  },
  userMessageText: {
    color: Colors.white,
  },
  driverMessageText: {
    color: Colors.text,
  },
  timestamp: {
    fontSize: Layout.fontSize.xs,
    marginTop: Layout.spacing.xs,
  },
  userTimestamp: {
    color: Colors.white,
    opacity: 0.8,
    textAlign: 'right',
  },
  driverTimestamp: {
    color: Colors.textSecondary,
  },
  quickRepliesContainer: {
    backgroundColor: Colors.white,
    paddingVertical: Layout.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  quickRepliesContent: {
    paddingHorizontal: Layout.spacing.lg,
  },
  quickReplyButton: {
    backgroundColor: Colors.gray50,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
    borderRadius: Layout.borderRadius.full,
    marginRight: Layout.spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickReplyText: {
    fontSize: Layout.fontSize.sm,
    color: Colors.text,
    fontWeight: '500',
  },
  inputContainer: {
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical: Layout.spacing.md,
  },
  textInput: {
    flex: 1,
    backgroundColor: Colors.gray50,
    borderRadius: Layout.borderRadius.lg,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
    fontSize: Layout.fontSize.md,
    color: Colors.text,
    maxHeight: 100,
    marginRight: Layout.spacing.sm,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.gray200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonActive: {
    backgroundColor: Colors.primary,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Layout.spacing.xs,
  },
  readIndicator: {
    marginLeft: Layout.spacing.xs,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Layout.spacing.xs,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.textSecondary,
    marginHorizontal: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Layout.spacing.lg,
  },
  loadingText: {
    fontSize: Layout.fontSize.md,
    color: Colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Layout.spacing.lg,
  },
  emptyText: {
    fontSize: Layout.fontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Layout.spacing.xs,
  },
  emptySubtext: {
    fontSize: Layout.fontSize.sm,
    color: Colors.textSecondary,
  },
});
