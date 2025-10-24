import { View, Text, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import { useLocalSearchParams, router, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { getUserProfile } from '../../services/authService';
import { createOrGetConversation } from '../../services/conversationService';
import { useAuth } from '../../store/AuthContext';
import { formatPhoneNumber } from '../../utils/phoneFormat';
import Animated, { FadeIn } from 'react-native-reanimated';
import AnimatedButton from '../../components/AnimatedButton';

export default function ContactInfoScreen() {
  const { userId, fromGroupId } = useLocalSearchParams<{ userId: string; fromGroupId?: string }>();
  const navigation = useNavigation();
  const { user } = useAuth();
  const [contact, setContact] = useState<any>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  
  useEffect(() => {
    loadContact();
  }, [userId]);

  useEffect(() => {
    // Set navigation header
    navigation.setOptions({
      title: 'Contact Info',
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
  }, [navigation, fromGroupId]);
  
  const loadContact = async () => {
    const profile = await getUserProfile(userId);
    setContact(profile);
  };
  
  const handleStartChat = async () => {
    if (isNavigating || !user) return;
    setIsNavigating(true);
    
    try {
      const conversationId = await createOrGetConversation([user.uid, userId], user.uid);
      router.replace(`/chat/${conversationId}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to start conversation');
      setIsNavigating(false);
    }
  };
  
  if (!contact) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }
  
  const isCurrentUser = userId === user?.uid;
  
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.container}>
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.avatarLarge}>
          {contact.photoURL ? (
            <Image source={{ uri: contact.photoURL }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarInitials}>{contact.initials}</Text>
          )}
        </View>
        <Text style={styles.name}>{contact.displayName}</Text>
        {contact.isOnline && (
          <View style={styles.onlineContainer}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>Online</Text>
          </View>
        )}
      </View>
      
      {/* Info Rows */}
      <View style={styles.infoSection}>
        {contact.email && (
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={24} color="#007AFF" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{contact.email}</Text>
            </View>
          </View>
        )}
        
        {contact.phoneNumber && (
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={24} color="#007AFF" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>{formatPhoneNumber(contact.phoneNumber)}</Text>
            </View>
          </View>
        )}
      </View>
      
      {/* Actions */}
      {!isCurrentUser && (
        <View style={styles.actionsSection}>
          <AnimatedButton 
            style={styles.actionButton}
            onPress={handleStartChat}
            disabled={isNavigating}
            hapticStyle="Medium"
          >
            <Ionicons name="chatbubble-outline" size={24} color="#FFF" />
            <Text style={styles.actionButtonText}>
              {isNavigating ? 'Opening...' : 'Send Message'}
            </Text>
          </AnimatedButton>
        </View>
      )}
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
    paddingVertical: 40,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  avatarLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarInitials: {
    fontSize: 36,
    fontWeight: '600',
    color: '#FFF',
  },
  name: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  onlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CD964',
    marginRight: 6,
  },
  onlineText: {
    fontSize: 14,
    color: '#4CD964',
  },
  infoSection: {
    backgroundColor: '#FFF',
    marginTop: 20,
    paddingHorizontal: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  infoTextContainer: {
    marginLeft: 16,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 17,
    color: '#000',
  },
  actionsSection: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  actionButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  actionButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFF',
    marginLeft: 8,
  },
});

