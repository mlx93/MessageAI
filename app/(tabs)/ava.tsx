import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Animated,
  Alert,
  PanResponder,
} from 'react-native';
import {router, useFocusEffect} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {SafeAreaView} from 'react-native-safe-area-context';
import avaChatHistory, {AvaChatSession} from '../../services/avaChatHistory';
import {formatDistanceToNow} from 'date-fns';
import {useCallback} from 'react';

// Swipeable Session Card Component
const SwipeableSessionCard = ({ 
  session, 
  onPress, 
  onDelete 
}: { 
  session: AvaChatSession; 
  onPress: (session: AvaChatSession) => void; 
  onDelete: (session: AvaChatSession) => void; 
}) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const [isSwipeOpen, setIsSwipeOpen] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only respond to horizontal swipes
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 10;
      },
      onPanResponderMove: (evt, gestureState) => {
        // Only allow left swipes (negative dx)
        if (gestureState.dx < 0) {
          translateX.setValue(Math.max(gestureState.dx, -80));
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx < -40) {
          // Swipe left to reveal delete button
          Animated.spring(translateX, {
            toValue: -80,
            useNativeDriver: true,
          }).start();
          setIsSwipeOpen(true);
        } else {
          // Snap back to original position
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
          setIsSwipeOpen(false);
        }
      },
    })
  ).current;

  const handlePress = () => {
    if (isSwipeOpen) {
      // Close swipe if open
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
      setIsSwipeOpen(false);
    } else {
      onPress(session);
    }
  };

  return (
    <View style={styles.swipeContainer}>
      {/* Delete Button - Hidden by default */}
      <View style={[
        styles.deleteButton,
        { opacity: isSwipeOpen ? 1 : 0 }
      ]}>
        <TouchableOpacity
          style={styles.deleteButtonContent}
          onPress={() => onDelete(session)}>
          <Ionicons name="trash" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>
      
      <Animated.View
        style={[
          styles.swipeContent,
          {
            transform: [{ translateX }],
          },
        ]}
        {...panResponder.panHandlers}>
        <TouchableOpacity
          style={styles.recentCard}
          onPress={handlePress}>
          <View style={styles.recentCardContent}>
            <View style={styles.recentCardHeader}>
              <Text style={styles.recentCardTitle} numberOfLines={1}>
                {session.title}
              </Text>
              <Text style={styles.recentCardTime}>
                {formatDistanceToNow(session.updatedAt, {addSuffix: true})}
              </Text>
            </View>
            <Text style={styles.recentCardMessage} numberOfLines={2}>
              {session.lastMessage}
            </Text>
            <View style={styles.recentCardFooter}>
              <Text style={styles.recentCardCount}>
                {session.messageCount} messages
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#999" />
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

export default function AvaAssistant() {
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSessions, setRecentSessions] = useState<AvaChatSession[]>([]);

  useEffect(() => {
    loadRecentSessions();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRecentSessions();
    }, [])
  );

  const loadRecentSessions = async () => {
    try {
      const sessions = await avaChatHistory.getRecentChatSessions(5);
      setRecentSessions(sessions);
    } catch (error) {
      console.error('Error loading recent sessions:', error);
    }
  };

  const handleChatWithAva = () => {
    if (searchQuery.trim()) {
      router.push({
        pathname: '/ava/chat',
        params: {initialQuery: searchQuery.trim()},
      });
      setSearchQuery(''); // Clear the input after navigation
    } else {
      router.push('/ava/chat');
    }
  };

  const handleRecentSessionPress = (session: AvaChatSession) => {
    router.push({
      pathname: '/ava/chat',
      params: {sessionId: session.id},
    });
  };

  const handleDeleteSession = async (session: AvaChatSession) => {
    Alert.alert(
      'Delete Chat Session',
      `Are you sure you want to delete "${session.title}"? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await avaChatHistory.deleteChatSession(session.id);
              // Refresh the sessions list
              await loadRecentSessions();
            } catch (error) {
              console.error('Error deleting session:', error);
              Alert.alert('Error', 'Failed to delete chat session. Please try again.');
            }
          },
        },
      ]
    );
  };

  const features = [
    {
      icon: '🔍',
      title: 'Smart Search',
      description: 'Search across all conversations semantically',
      route: '/ava/search',
      color: '#007AFF',
    },
    {
      icon: '✅',
      title: 'Action Items',
      description: 'View all pending tasks and assignments',
      route: '/ava/action-items',
      color: '#34C759',
    },
    {
      icon: '📌',
      title: 'Decisions',
      description: 'Track team decisions and agreements',
      route: '/ava/decisions',
      color: '#FF9500',
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hey there! 👋</Text>
          <Text style={styles.title}>I'm Ava</Text>
          <Text style={styles.subtitle}>Your AI assistant for MessageAI</Text>
        </View>
      </View>

      {/* Chat with Ava Button */}
      <View style={styles.chatButtonContainer}>
        <TouchableOpacity style={styles.chatButton} onPress={handleChatWithAva}>
          <View style={styles.chatButtonContent}>
            <View style={styles.chatButtonHeader}>
              <Text style={styles.chatButtonTitle}>Chat with Ava</Text>
              <Ionicons name="arrow-forward" size={20} color="#AF52DE" />
            </View>
            <View style={styles.chatInputContainer}>
              <TextInput
                style={styles.chatInput}
                placeholder="Ask Ava anything..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleChatWithAva}
                returnKeyType="send"
                multiline={false}
              />
              <TouchableOpacity
                style={[styles.sendIconButton, !searchQuery.trim() && styles.sendIconButtonDisabled]}
                onPress={handleChatWithAva}
                disabled={!searchQuery.trim()}>
                <Ionicons
                  name="send"
                  size={16}
                  color={searchQuery.trim() ? '#AF52DE' : '#CCC'}
                />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {/* Features Grid */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>What can I help you with?</Text>

        <View style={styles.featuresGrid}>
          {features.map((feature, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.featureCard, {borderLeftColor: feature.color}]}
              onPress={() => router.push(feature.route as any)}>
              <View style={styles.featureHeader}>
                <Text style={styles.featureIcon}>{feature.icon}</Text>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </View>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureDescription}>
                {feature.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent Activity */}
        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {recentSessions.length > 0 ? (
            recentSessions.map((session) => (
              <SwipeableSessionCard
                key={session.id}
                session={session}
                onPress={handleRecentSessionPress}
                onDelete={handleDeleteSession}
              />
            ))
          ) : (
            <View style={styles.recentCard}>
              <Ionicons name="time-outline" size={20} color="#666" />
              <Text style={styles.recentText}>
                Your recent AI interactions will appear here
              </Text>
            </View>
          )}
        </View>

        {/* Tips */}
        <View style={styles.tipsSection}>
          <Text style={styles.sectionTitle}>💡 Tips</Text>
          <View style={styles.tipCard}>
            <Text style={styles.tipText}>
              • Ask me to summarize any conversation{'\n'}
              • I automatically detect priority messages{'\n'}
              • Search using natural language{'\n'}
              • I'll proactively suggest meeting times
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  greeting: {
    fontSize: 16,
    color: '#666',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000',
    marginTop: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  chatButtonContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFF',
  },
  chatButton: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  chatButtonContent: {
    padding: 20,
  },
  chatButtonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  chatButtonTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  chatInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    paddingVertical: 4,
  },
  sendIconButton: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: '#F0F8FF',
  },
  sendIconButtonDisabled: {
    backgroundColor: '#F8F9FA',
  },
  content: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginTop: 24,
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  featuresGrid: {
    paddingHorizontal: 20,
    gap: 16,
  },
  featureCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  featureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureIcon: {
    fontSize: 32,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  recentSection: {
    marginTop: 16,
    marginBottom: 16,
  },
  recentCard: {
    backgroundColor: '#FFF',
    marginHorizontal: 20,
    marginBottom: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  recentCardContent: {
    padding: 16,
  },
  recentCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recentCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },
  recentCardTime: {
    fontSize: 12,
    color: '#999',
  },
  recentCardMessage: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  recentCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recentCardCount: {
    fontSize: 12,
    color: '#999',
  },
  recentText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
  },
  swipeContainer: {
    position: 'relative',
    marginHorizontal: 20,
    marginBottom: 8,
  },
  swipeContent: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  deleteButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  deleteButtonContent: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tipsSection: {
    marginBottom: 32,
  },
  tipCard: {
    backgroundColor: '#F0F8FF',
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#007AFF20',
  },
  tipText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
  },
});

