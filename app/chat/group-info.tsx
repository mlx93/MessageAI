import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Alert } from 'react-native';
import { useLocalSearchParams, router, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { getConversation, hideConversation } from '../../services/conversationService';
import { useAuth } from '../../store/AuthContext';
import Animated, { FadeIn } from 'react-native-reanimated';
import AnimatedButton from '../../components/AnimatedButton';

export default function GroupInfoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const { user } = useAuth();
  const [conversation, setConversation] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  
  useEffect(() => {
    loadGroupInfo();
  }, [id]);

  useEffect(() => {
    // Set navigation header - empty title, show back button
    navigation.setOptions({
      title: '', // Empty title - we show custom header in the content
      headerBackTitleVisible: false,
      headerBackTitle: '',
      presentation: 'card', // Force card presentation (not modal)
      headerLeft: () => (
        <View style={{ marginLeft: 8 }}>
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={{ 
              width: 32, 
              height: 32, 
              borderRadius: 16, 
              backgroundColor: '#fff',
              justifyContent: 'center', 
              alignItems: 'center' 
            }}
          >
            <Ionicons name="chevron-back" size={20} color="#007AFF" />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [conversation, navigation]);
  
  const loadGroupInfo = async () => {
    const conv = await getConversation(id);
    if (!conv) return;
    
    setConversation(conv);
    
    // Convert participantDetails to array
    const participantArray = Object.entries(conv.participantDetails).map(([uid, details]: [string, any]) => ({
      uid,
      ...details
    }));
    setParticipants(participantArray);
  };
  
  const handleViewContact = (participantId: string) => {
    // Pass the group ID so contact-info knows to come back here
    router.push(`/chat/contact-info?userId=${participantId}&fromGroupId=${id}`);
  };
  
  const handleHideConversation = () => {
    if (!user) return;
    
    Alert.alert(
      'Hide Conversation',
      'Hide this conversation? You\'ll still receive messages if someone replies.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Hide',
          style: 'destructive',
          onPress: async () => {
            try {
              await hideConversation(id, user.uid);
              // Navigate back to Messages list
              router.replace('/(tabs)');
            } catch (error) {
              Alert.alert('Error', 'Failed to hide conversation');
            }
          }
        }
      ]
    );
  };
  
  if (!conversation) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }
  
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.container}>
      {/* Group Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.title}>{conversation.type === 'group' ? 'Group Info' : 'Contact Info'}</Text>
          <Text style={styles.subtitle}>{participants.length} participants</Text>
        </View>
      </View>
      
      {/* Participants List */}
      <FlatList
        data={participants}
        keyExtractor={(item) => item.uid}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.participantRow}
            onPress={() => handleViewContact(item.uid)}
          >
            <View style={styles.avatar}>
              {item.photoURL ? (
                <Image source={{ uri: item.photoURL }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarInitials}>{item.initials}</Text>
              )}
            </View>
            <View style={styles.participantInfo}>
              <Text style={styles.participantName}>{item.displayName}</Text>
              {item.uid === user?.uid && (
                <Text style={styles.youLabel}>You</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListFooterComponent={
          conversation.type === 'group' ? (
            <AnimatedButton 
              style={styles.hideButton}
              onPress={handleHideConversation}
              hapticStyle="Medium"
            >
              <Text style={styles.hideButtonText}>Hide Conversation</Text>
            </AnimatedButton>
          ) : null
        }
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    backgroundColor: '#FFF',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
    width: '100%',
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    width: '100%',
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarInitials: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 17,
    fontWeight: '400',
  },
  youLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginLeft: 64,
  },
  hideButton: {
    backgroundColor: '#FFF',
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    marginTop: 20,
  },
  hideButtonText: {
    fontSize: 17,
    color: '#FF9500', // Orange instead of red (less destructive)
    fontWeight: '600',
  },
});

