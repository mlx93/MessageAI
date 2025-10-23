import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { getConversation } from '../../services/conversationService';
import { useAuth } from '../../store/AuthContext';
import Avatar from '../../components/Avatar';
import { Ionicons } from '@expo/vector-icons';

interface Participant {
  uid: string;
  displayName: string;
  initials: string;
  photoURL: string | null;
}

export default function GroupInfoScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(true);
  const conversationId = id as string;

  useEffect(() => {
    loadGroupInfo();
  }, [conversationId]);

  const loadGroupInfo = async () => {
    try {
      const conversation = await getConversation(conversationId);
      if (conversation) {
        // Extract participants
        const participantList: Participant[] = conversation.participants
          .filter(uid => uid !== user?.uid) // Don't show current user
          .map(uid => ({
            uid,
            displayName: conversation.participantDetails[uid]?.displayName || 'Unknown',
            initials: conversation.participantDetails[uid]?.initials || '??',
            photoURL: conversation.participantDetails[uid]?.photoURL || null,
          }));

        setParticipants(participantList);

        // Generate group name
        const names = participantList
          .slice(0, 3)
          .map(p => p.displayName.split(' ')[0])
          .join(', ');
        setGroupName(names + (participantList.length > 3 ? '...' : ''));
      }
    } catch (error) {
      console.error('Failed to load group info:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleParticipantPress = (participantId: string) => {
    router.push(`/contact/${participantId}`);
  };

  const renderParticipant = ({ item }: { item: Participant }) => (
    <TouchableOpacity
      style={styles.participantRow}
      onPress={() => handleParticipantPress(item.uid)}
      activeOpacity={0.7}
    >
      <Avatar
        photoURL={item.photoURL}
        initials={item.initials}
        size={50}
      />
      <Text style={styles.participantName}>{item.displayName}</Text>
      <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen 
          options={{
            title: 'Group Info',
            headerBackTitle: '',
          }}
        />
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{
          title: 'Group Info',
          headerBackTitle: '',
        }}
      />
      <View style={styles.header}>
        <Text style={styles.groupName}>{groupName}</Text>
        <Text style={styles.participantCount}>
          {participants.length + 1} {participants.length === 0 ? 'participant' : 'participants'}
        </Text>
      </View>

      <FlatList
        data={participants}
        keyExtractor={(item) => item.uid}
        renderItem={renderParticipant}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
    alignItems: 'center',
  },
  groupName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  participantCount: {
    fontSize: 14,
    color: '#8E8E93',
  },
  list: {
    paddingTop: 8,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  participantName: {
    flex: 1,
    fontSize: 17,
    color: '#000',
    marginLeft: 12,
  },
  separator: {
    height: 1,
    backgroundColor: '#E8E8E8',
    marginLeft: 78, // Align with text (50px avatar + 12px margin + 16px padding)
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 100,
    fontSize: 16,
    color: '#999',
  },
});

