import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {router} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {SafeAreaView} from 'react-native-safe-area-context';
import aiService from '../../services/aiService';
import {formatDistanceToNow} from 'date-fns';
import {auth, db} from '../../services/firebase';
import {collection, query, where, getDocs, doc, getDoc} from 'firebase/firestore';

interface SearchResultItem {
  messageId: string;
  conversationId: string;
  conversationName: string;
  text: string;
  sender: string;
  timestamp: number;
  score?: number;
  matchType: 'keyword' | 'semantic';
}

export default function SmartSearchScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const getConversationName = async (conversationId: string, userId: string): Promise<string> => {
    try {
      const convDoc = await getDoc(doc(db, 'conversations', conversationId));
      if (convDoc.exists()) {
        const convData = convDoc.data();
        
        if (convData.isGroup) {
          return convData.groupName || 'Group Chat';
        } else if (convData.participantDetails) {
          const names = Object.entries(convData.participantDetails)
            .filter(([id]) => id !== userId)
            .map(([, details]: [string, any]) => details.displayName)
            .filter(Boolean)
            .join(', ');
          return names || 'Direct Message';
        }
      }
    } catch (error) {
      console.error('Error fetching conversation name:', error);
    }
    return 'Unknown Conversation';
  };

  const performKeywordSearch = async (searchTerm: string, userId: string): Promise<SearchResultItem[]> => {
    try {
      console.log('Starting keyword search for:', searchTerm);
      // Get user's conversations
      const convsRef = collection(db, 'conversations');
      const convsQuery = query(
        convsRef,
        where('participants', 'array-contains', userId)
      );
      const convsSnapshot = await getDocs(convsQuery);
      console.log('Found conversations:', convsSnapshot.size);
      
      const allResults: SearchResultItem[] = [];
      
      // Search messages in each conversation
      for (const convDoc of convsSnapshot.docs) {
        const conversationId = convDoc.id;
        const convData = convDoc.data();
        const participantDetails = convData.participantDetails || {};
        
        const messagesRef = collection(db, `conversations/${conversationId}/messages`);
        const messagesSnapshot = await getDocs(messagesRef);
        console.log(`Conversation ${conversationId}: ${messagesSnapshot.size} messages`);
        
        const conversationName = await getConversationName(conversationId, userId);
        
        // Filter messages that contain the search term (case-insensitive)
        messagesSnapshot.docs.forEach(msgDoc => {
          const data = msgDoc.data();
          const text = data.text || '';
          
          // Skip messages deleted by this user
          const deletedBy = data.deletedBy || [];
          if (deletedBy.includes(userId)) {
            return;
          }
          
          if (text.toLowerCase().includes(searchTerm.toLowerCase())) {
            console.log('Found match:', text.substring(0, 50));
            
            // Get sender's display name from participant details
            const senderId = data.senderId;
            const senderName = participantDetails[senderId]?.displayName || data.senderName || 'Unknown';
            
            allResults.push({
              messageId: msgDoc.id,
              conversationId,
              conversationName,
              text,
              sender: senderName,
              timestamp: data.timestamp?.toMillis?.() || Date.now(),
              matchType: 'keyword',
            });
          }
        });
      }
      
      console.log('Total keyword results:', allResults.length);
      
      // Sort by relevance (exact matches first, then by recency)
      return allResults.sort((a, b) => {
        const aExact = a.text.toLowerCase() === searchTerm.toLowerCase();
        const bExact = b.text.toLowerCase() === searchTerm.toLowerCase();
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        return b.timestamp - a.timestamp;
      });
    } catch (error) {
      console.error('Keyword search error:', error);
      return [];
    }
  };

  const performSemanticSearch = async (searchTerm: string): Promise<SearchResultItem[]> => {
    try {
      console.log('Starting semantic search for:', searchTerm);
      const response = await aiService.smartSearch(searchTerm);
      console.log('Semantic search raw response:', response);
      
      const userId = auth.currentUser?.uid;
      if (!userId) return [];
      
      const results: SearchResultItem[] = [];
      
      for (const result of response.results) {
        console.log('Semantic result:', {
          messageId: result.messageId,
          score: result.score,
          text: result.text.substring(0, 50),
        });
        const conversationName = await getConversationName(result.conversationId, userId);
        results.push({
          ...result,
          conversationName,
          matchType: 'semantic',
        });
      }
      
      console.log('Total semantic results:', results.length);
      return results;
    } catch (error) {
      console.error('Semantic search error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      return [];
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    const userId = auth.currentUser?.uid;
    if (!userId) {
      Alert.alert('Error', 'You must be logged in to search');
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      // Perform both keyword and semantic search in parallel
      const [keywordResults, semanticResults] = await Promise.all([
        performKeywordSearch(searchQuery.trim(), userId),
        performSemanticSearch(searchQuery.trim()),
      ]);
      
      // Merge results, prioritizing keyword matches
      const mergedResults: SearchResultItem[] = [];
      const seenMessageIds = new Set<string>();
      
      // Add keyword results first
      keywordResults.forEach(result => {
        mergedResults.push(result);
        seenMessageIds.add(result.messageId);
      });
      
      // Add semantic results that aren't already in keyword results
      semanticResults.forEach(result => {
        if (!seenMessageIds.has(result.messageId)) {
          mergedResults.push(result);
        }
      });
      
      setResults(mergedResults);
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Error', 'Failed to search. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResultPress = (result: SearchResultItem) => {
    router.push(`/chat/${result.conversationId}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Smart Search</Text>
        <View style={{width: 24}} />
      </View>

      {/* Search Box */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search"
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            multiline
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.searchButton, !searchQuery.trim() && styles.searchButtonDisabled]}
          onPress={handleSearch}
          disabled={!searchQuery.trim() || loading}>
          {loading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.searchButtonText}>Search</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Results */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      ) : searched ? (
        results.length > 0 ? (
          <FlatList
            data={results}
            keyExtractor={(item) => `${item.messageId}-${item.matchType}`}
            contentContainerStyle={styles.resultsList}
            renderItem={({item}) => (
              <TouchableOpacity
                style={styles.resultCard}
                onPress={() => handleResultPress(item)}>
                <View style={styles.resultHeader}>
                  <View style={styles.resultHeaderLeft}>
                    <Text style={styles.resultSender}>{item.sender}</Text>
                    <Text style={styles.conversationName}>
                      in {item.conversationName}
                    </Text>
                    <Text style={styles.resultDate}>
                      {new Date(item.timestamp).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>
                  <View style={styles.badges}>
                    {item.matchType === 'keyword' && (
                      <View style={styles.keywordBadge}>
                        <Text style={styles.badgeText}>Exact</Text>
                      </View>
                    )}
                    {item.score !== undefined && (
                      <Text style={styles.resultScore}>
                        {Math.round(item.score * 100)}%
                      </Text>
                    )}
                  </View>
                </View>
                <Text style={styles.resultText} numberOfLines={4}>
                  {item.text}
                </Text>
              </TouchableOpacity>
            )}
          />
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyText}>No results found</Text>
            <Text style={styles.emptySubtext}>
              Try different keywords or phrases
            </Text>
          </View>
        )
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>💡</Text>
          <Text style={styles.emptyText}>Hybrid Search</Text>
          <Text style={styles.emptySubtext}>
            Search by exact keywords or meaning{'\n'}
            across all your conversations
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    gap: 8,
    alignItems: 'flex-start',
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    minHeight: 44,
  },
  searchIcon: {
    marginTop: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    maxHeight: 120,
    paddingTop: 0,
    paddingBottom: 0,
  },
  clearButton: {
    marginTop: 2,
  },
  searchButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
    height: 44,
  },
  searchButtonDisabled: {
    opacity: 0.5,
  },
  searchButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  resultsList: {
    padding: 16,
    gap: 12,
  },
  resultCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  resultHeaderLeft: {
    flex: 1,
  },
  resultSender: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  conversationName: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  resultDate: {
    fontSize: 12,
    color: '#999',
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  keywordBadge: {
    backgroundColor: '#34C759',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFF',
  },
  resultScore: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
  },
  resultText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
});
