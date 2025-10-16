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
import { useUser } from '@clerk/clerk-expo';
import { Colors } from '../../constants/Colors';
import { Layout } from '../../constants/Layout';

interface ConversationMessage {
  id: string;
  senderId: string;
  senderType: 'user' | 'customer_care';
  message: string;
  timestamp: string;
  isRead: boolean;
}

const customerCareQuickReplies = [
  'I need help with my ride',
  'I was charged incorrectly',
  'I have a complaint',
  'I want to report an issue',
  'Thank you for your help',
];

export default function ConversationScreen({ navigation, route }: any) {
  const { ride: rawRide, issue } = route.params || {};
  const ride = rawRide ? { ...rawRide, rideId: rawRide.rideId || rawRide.id } : undefined;
  const { user } = useUser();
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isCustomerCareTyping, setIsCustomerCareTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Prevent back navigation
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.goBack();
      return true;
    });

    return () => backHandler.remove();
  }, [navigation]);

  // Initialize conversation with welcome message
  useEffect(() => {
    console.log('ConversationScreen - Route params:', route.params);
    console.log('ConversationScreen - Ride:', ride);
    console.log('ConversationScreen - Issue:', issue);
    
    const welcomeMessage: ConversationMessage = {
      id: 'welcome-1',
      senderId: 'customer-care',
      senderType: 'customer_care',
      message: getWelcomeMessage(),
      timestamp: new Date().toISOString(),
      isRead: true,
    };
    setMessages([welcomeMessage]);
  }, [issue, ride, user]);

  const getWelcomeMessage = () => {
    const rideInfo = ride ? ` (Ride ID: ${ride.id || ride.rideId || 'Unknown'})` : '';
    const name = (user?.firstName || user?.fullName || '').trim();
    const greeting = `Hi ${name || 'there'}, welcome to Roqet support.`;
    
    switch (issue) {
      case 'charged_higher_than_estimated':
        return `${greeting} I see you're concerned about being charged more than the estimated fare${rideInfo}. I'm here to help you resolve this issue. Could you please provide more details about your ride?`;
      case 'cancellation_fee':
        return `${greeting} I understand you were charged a cancellation fee${rideInfo}. I'll look into this for you. Could you tell me what happened before the ride was cancelled?`;
      case 'charged_without_ride':
        return `${greeting} I’m really sorry to hear you were charged even though you didn’t take the ride${rideInfo}. I’ll help you get this sorted. Could you share any details (time, location, and what happened) so I can investigate right away?`;
      case 'general_inquiry':
        return `${greeting} How can I assist you today${rideInfo}?`;
      default:
        return `${greeting} How can I assist you today${rideInfo}?`;
    }
  };

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      const userMessage: ConversationMessage = {
        id: `user-${Date.now()}`,
        senderId: 'user',
        senderType: 'user',
        message: newMessage.trim(),
        timestamp: new Date().toISOString(),
        isRead: true,
      };

      setMessages(prev => [...prev, userMessage]);
      setNewMessage('');

      // Simulate customer care response
      setTimeout(() => {
        setIsCustomerCareTyping(true);
        setTimeout(() => {
          const response = getCustomerCareResponse(newMessage.trim());
          const careMessage: ConversationMessage = {
            id: `care-${Date.now()}`,
            senderId: 'customer-care',
            senderType: 'customer_care',
            message: response,
            timestamp: new Date().toISOString(),
            isRead: false,
          };
          setMessages(prev => [...prev, careMessage]);
          setIsCustomerCareTyping(false);
        }, 2000);
      }, 1000);
    }
  };

  const getCustomerCareResponse = (userMessage: string) => {
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes('charged') || lowerMessage.includes('fare') || lowerMessage.includes('money')) {
      return "I understand your concern about the fare. Let me check your ride details and help you resolve this billing issue. Can you confirm the ride date and amount you were charged?";
    } else if (lowerMessage.includes('complaint') || lowerMessage.includes('problem')) {
      return "I'm sorry to hear about your experience. Please provide more details about the issue, and I'll do my best to help you resolve it.";
    } else if (lowerMessage.includes('help')) {
      return "I'm here to help! Please let me know what specific assistance you need, and I'll guide you through the process.";
    } else if (lowerMessage.includes('thank')) {
      return "You're very welcome! Is there anything else I can help you with today?";
    } else {
      return "Thank you for your message. I'm reviewing your request and will provide you with the best possible assistance. Please give me a moment to check your account details.";
    }
  };

  const handleQuickReply = (reply: string) => {
    setNewMessage(reply);
    handleSendMessage();
  };

  const renderMessage = ({ item }: { item: ConversationMessage }) => {
    const isUser = item.senderType === 'user';
    
    return (
      <View style={[styles.messageContainer, isUser ? styles.userMessage : styles.customerCareMessage]}>
        <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.customerCareBubble]}>
          <Text style={[styles.messageText, isUser ? styles.userText : styles.customerCareText]}>
            {item.message}
          </Text>
          <Text style={[styles.timestamp, isUser ? styles.userTimestamp : styles.customerCareTimestamp]}>
            {formatTimestamp(item.timestamp)}
          </Text>
        </View>
      </View>
    );
  };

  const renderTypingIndicator = () => {
    if (!isCustomerCareTyping) return null;
    
    return (
      <View style={[styles.messageContainer, styles.customerCareMessage]}>
        <View style={[styles.messageBubble, styles.customerCareBubble]}>
          <View style={styles.typingIndicator}>
            <View style={styles.typingDot} />
            <View style={styles.typingDot} />
            <View style={styles.typingDot} />
          </View>
        </View>
      </View>
    );
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

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
          <Text style={styles.customerCareName}>Customer Care</Text>
          <Text style={styles.customerCareStatus}>
            {isCustomerCareTyping ? 'Typing...' : 'Online'}
          </Text>
        </View>
        <TouchableOpacity style={styles.infoButton}>
          <Ionicons name="information-circle-outline" size={24} color={Colors.primary} />
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
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Starting conversation...</Text>
          </View>
        }
      />

      {/* Quick Replies */}
      <View style={styles.quickRepliesContainer}>
        <FlatList
          data={customerCareQuickReplies}
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
            placeholder="Type your message..."
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendButton, newMessage.trim() ? styles.sendButtonActive : styles.sendButtonInactive]}
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
    padding: Layout.spacing.sm,
    marginRight: Layout.spacing.sm,
  },
  headerInfo: {
    flex: 1,
  },
  customerCareName: {
    fontSize: Layout.fontSize.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  customerCareStatus: {
    fontSize: Layout.fontSize.sm,
    color: Colors.success,
    marginTop: 2,
  },
  infoButton: {
    padding: Layout.spacing.sm,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: Layout.spacing.md,
  },
  messageContainer: {
    marginBottom: Layout.spacing.sm,
  },
  userMessage: {
    alignItems: 'flex-end',
  },
  customerCareMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
    borderRadius: Layout.borderRadius.lg,
  },
  userBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  customerCareBubble: {
    backgroundColor: Colors.gray100,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: Layout.fontSize.md,
    lineHeight: 20,
  },
  userText: {
    color: Colors.white,
  },
  customerCareText: {
    color: Colors.text,
  },
  timestamp: {
    fontSize: Layout.fontSize.xs,
    marginTop: 4,
  },
  userTimestamp: {
    color: Colors.white,
    opacity: 0.8,
  },
  customerCareTimestamp: {
    color: Colors.textSecondary,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.textSecondary,
    marginHorizontal: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Layout.spacing.xl,
  },
  emptyText: {
    fontSize: Layout.fontSize.md,
    color: Colors.textSecondary,
  },
  quickRepliesContainer: {
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingVertical: Layout.spacing.sm,
  },
  quickRepliesContent: {
    paddingHorizontal: Layout.spacing.md,
  },
  quickReplyButton: {
    backgroundColor: Colors.gray100,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
    borderRadius: Layout.borderRadius.full,
    marginRight: Layout.spacing.sm,
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
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Layout.borderRadius.full,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
    marginRight: Layout.spacing.sm,
    maxHeight: 100,
    fontSize: Layout.fontSize.md,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonActive: {
    backgroundColor: Colors.primary,
  },
  sendButtonInactive: {
    backgroundColor: Colors.gray200,
  },
});
