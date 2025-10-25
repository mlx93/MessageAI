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
          <Ionicons name="trash" size={18} color="#FFF" />
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
            <View style={styles.recentCardRow}>
              <View style={styles.recentCardLeft}>
                <Text style={styles.recentCardTitle} numberOfLines={1}>
                  {session.title}
                </Text>
                <Text style={styles.recentCardMessage} numberOfLines={1}>
                  {session.lastMessage}
                </Text>
              </View>
              <View style={styles.recentCardRight}>
                <Text style={styles.recentCardTime}>
                  {formatDistanceToNow(session.updatedAt, {addSuffix: true})}
                </Text>
                <Text style={styles.recentCardCount}>
                  {session.messageCount} msgs
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color="#999" />
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
          <Text style={styles.subtitle}>Your AI assistant for aiMessage</Text>
        </View>
      </View>

      {/* Chat with Ava Button */}
      <View style={styles.chatButtonContainer}>
        <TouchableOpacity style={styles.chatButton} onPress={handleChatWithAva}>
          <View style={styles.chatButtonContent}>
            <View style={styles.chatButtonHeader}>
              <Text style={styles.chatButtonTitle}>Chat with Ava</Text>
              <Ionicons name="arrow-forward" size={18} color="#AF52DE" />
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
                  size={14}
                  color={searchQuery.trim() ? '#AF52DE' : '#CCC'}
                />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {/* Features Grid */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.featuresGrid}>
          {features.map((feature, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.featureCard, {borderLeftColor: feature.color}]}
              onPress={() => router.push(feature.route as any)}>
              <View style={styles.featureContent}>
                <Text style={styles.featureIcon}>{feature.icon}</Text>
                <View style={styles.featureTextContent}>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureDescription}>
                    {feature.description}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#999" />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent Activity */}
        {recentSessions.length > 0 ? (
          <View style={styles.recentSection}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            {recentSessions.map((session) => (
              <SwipeableSessionCard
                key={session.id}
                session={session}
                onPress={handleRecentSessionPress}
                onDelete={handleDeleteSession}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyRecentSection}>
            <View style={styles.emptyRecentCard}>
              <Ionicons name="sparkles" size={14} color="#C7C7CC" />
              <Text style={styles.emptyRecentText}>
                Start a conversation with Ava to see your history here
              </Text>
            </View>
          </View>
        )}

        {/* Tips */}
        <View style={styles.tipsSection}>
          <View style={styles.tipCard}>
            <Ionicons name="bulb-outline" size={14} color="#007AFF" />
            <Text style={styles.tipText}>
              Ask me to summarize • Find action items • Search conversations • Track decisions
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
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  greeting: {
    fontSize: 16,
    color: '#666',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    marginTop: 2,
  },
  subtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  chatButtonContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFF',
  },
  chatButton: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  chatButtonContent: {
    padding: 14,
  },
  chatButtonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  chatButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  chatInput: {
    flex: 1,
    fontSize: 14,
    color: '#000',
    paddingVertical: 2,
  },
  sendIconButton: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: '#F0F8FF',
  },
  sendIconButtonDisabled: {
    backgroundColor: '#F8F9FA',
  },
  content: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginTop: 16,
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  featuresGrid: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 8,
  },
  featureCard: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 10,
    borderLeftWidth: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
    marginBottom: 6,
  },
  featureContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureTextContent: {
    flex: 1,
    marginLeft: 12,
  },
  featureIcon: {
    fontSize: 24,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  featureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recentSection: {
    marginTop: 12,
    marginBottom: 12,
  },
  emptyRecentSection: {
    marginTop: 12,
    marginBottom: 8,
  },
  emptyRecentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    gap: 8,
  },
  emptyRecentText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  recentCard: {
    backgroundColor: '#FFF',
    marginHorizontal: 20,
    marginBottom: 6,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  recentCardContent: {
    padding: 10,
  },
  recentCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recentCardLeft: {
    flex: 1,
  },
  recentCardRight: {
    marginRight: 8,
    alignItems: 'flex-end',
  },
  recentCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  recentCardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
  },
  recentCardTime: {
    fontSize: 10,
    color: '#999',
  },
  recentCardMessage: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  recentCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recentCardCount: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  recentText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
  },
  swipeContainer: {
    position: 'relative',
    marginHorizontal: 20,
    marginBottom: 6,
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
    marginTop: 8,
    marginBottom: 16,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    marginHorizontal: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  tipText: {
    flex: 1,
    fontSize: 11,
    color: '#007AFF',
    lineHeight: 14,
  },
});

