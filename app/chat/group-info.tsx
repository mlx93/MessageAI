import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Alert } from 'react-native';
import { useLocalSearchParams, router, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { getConversation, leaveConversation } from '../../services/conversationService';
import { useAuth } from '../../store/AuthContext';

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
    // Set navigation header
    navigation.setOptions({
      title: conversation?.type === 'group' ? 'Group Info' : 'Contact Info',
      headerBackTitleVisible: false,
      headerBackTitle: '',
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
    router.push(`/chat/contact-info?userId=${participantId}`);
  };
  
  const handleLeaveGroup = () => {
    if (!user) return;
    
    Alert.alert(
      'Leave Group',
      'Are you sure you want to leave this group?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveConversation(id, user.uid);
              // Navigate back to Messages list
              router.replace('/(tabs)');
            } catch (error) {
              Alert.alert('Error', 'Failed to leave group');
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
    <View style={styles.container}>
      {/* Group Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{conversation.type === 'group' ? 'Group Info' : 'Contact Info'}</Text>
        <Text style={styles.subtitle}>{participants.length} participants</Text>
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
      />
      
      {/* Leave Group Button (only for groups) */}
      {conversation.type === 'group' && (
        <TouchableOpacity 
          style={styles.leaveButton}
          onPress={handleLeaveGroup}
        >
          <Text style={styles.leaveButtonText}>Leave Group</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    backgroundColor: '#FFF',
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
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
  leaveButton: {
    backgroundColor: '#FFF',
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    marginTop: 20,
  },
  leaveButtonText: {
    fontSize: 17,
    color: '#FF3B30',
    fontWeight: '600',
  },
});

