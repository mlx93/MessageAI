import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import {router} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {SafeAreaView} from 'react-native-safe-area-context';
import aiService, {Decision} from '../../services/aiService';
import {format} from 'date-fns';
import {auth, db} from '../../services/firebase';
import {collection, getDocs, query, where} from 'firebase/firestore';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

export default function DecisionsScreen() {
  const [decisions, setDecisions] = useState<(Decision & {id: string})[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingProgress, setAnalyzingProgress] = useState(0);
  const [selectedDecisions, setSelectedDecisions] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    // First, get all conversations the user is part of (excluding hidden/deleted)
    const loadDecisionsForUser = async () => {
      try {
        const convsRef = collection(db, 'conversations');
        const convsQuery = query(
          convsRef,
          where('participants', 'array-contains', userId)
        );
        const convsSnapshot = await getDocs(convsQuery);
        
        // Filter out hidden/deleted conversations
        const convIds = new Set(
          convsSnapshot.docs
            .filter(doc => {
              const data = doc.data();
              // Exclude if deleted, or hidden/deleted by this user
              if (data.deleted || 
                  data.hiddenBy?.includes(userId) ||
                  data.deletedBy?.includes(userId)) {
                console.log(`Excluding hidden/deleted conversation from decisions: ${doc.id}`);
                return false;
              }
              return true;
            })
            .map(doc => doc.id)
        );
        
        console.log('User conversations loaded:', convIds.size);

        // Now subscribe to decisions with the conversation IDs ready
        const unsubscribe = aiService.getAllDecisions(userId).onSnapshot((snapshot: any) => {
          console.log('Raw decisions from Firestore:', snapshot.docs.length);
          
          if (snapshot.docs.length === 0) {
            console.log('No decisions found in Firestore');
            setDecisions([]);
            return;
          }
          
          const allDecisions = snapshot.docs.map((doc: any) => ({
            id: doc.id,
            ...doc.data(),
          }));
          
          // Debug logging
          console.log('All decisions before filtering:', allDecisions.length);
          if (allDecisions.length > 0) {
            console.log('Sample decision:', JSON.stringify(allDecisions[0], null, 2));
          }
          
          // Filter decisions to only show from user's conversations
          const items = allDecisions
            .filter((decision: Decision & {id: string}) => {
              // Only show decisions from user's conversations
              const inUserConv = convIds.has(decision.conversationId);
              if (!inUserConv) {
                console.log('Filtering out decision from non-user conversation:', decision.conversationId);
                return false;
              }
              return true;
            })
            .filter((decision: Decision & {id: string}) => {
              // Filter out any test data with generic names
              if (!decision.participants || !Array.isArray(decision.participants)) {
                console.log('Decision has no participants array:', decision.id);
                return true; // Keep decisions without participants
              }
              
              const genericNames = ['Alice', 'Bob', 'Charlie', 'Dave', 'Eve', 'Frank', 'Grace'];
              const hasGenericName = decision.participants.some(p => 
                genericNames.includes(p)
              );
              if (hasGenericName) {
                console.log('Filtering out test decision with generic names');
                return false;
              }
              return true;
            });
          
          console.log('Decisions after filtering test data:', items.length);
          setDecisions(items);
        });

        return unsubscribe;
      } catch (error) {
        console.error('Error loading user conversations:', error);
        return () => {};
      }
    };

    // Load and return the unsubscribe function
    let unsubscribePromise = loadDecisionsForUser();
    
    return () => {
      unsubscribePromise.then(unsub => unsub());
    };
  }, []);

  const handleAnalyze = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      Alert.alert('Error', 'You must be logged in to analyze conversations');
      return;
    }

    setAnalyzing(true);
    setAnalyzingProgress(0);
    try {
      // Get all user's conversations
      const convsRef = collection(db, 'conversations');
      const convsQuery = query(
        convsRef,
        where('participants', 'array-contains', userId)
      );
      const convsSnapshot = await getDocs(convsQuery);
      
      if (convsSnapshot.empty) {
        Alert.alert('Info', 'No conversations found to analyze');
        setAnalyzing(false);
        return;
      }

      // Extract decisions from each conversation (last 7 days by default)
      let totalExtracted = 0;
      let skippedConversations = 0;
      const totalConversations = convsSnapshot.docs.length;
      
      for (let i = 0; i < convsSnapshot.docs.length; i++) {
        const convDoc = convsSnapshot.docs[i];
        const convData = convDoc.data();
        
        // Skip deleted or hidden conversations
        if (convData.deleted || 
            convData.hiddenBy?.includes(userId) ||
            convData.deletedBy?.includes(userId)) {
          console.log(`⏭️ Skipping deleted/hidden conversation: ${convDoc.id}`);
          skippedConversations++;
          setAnalyzingProgress((i + 1) / totalConversations);
          continue;
        }
        
        try {
          console.log('Extracting decisions from conversation:', convDoc.id);
          const result = await aiService.extractDecisions(convDoc.id);
          if (result?.count > 0) {
            totalExtracted += result.count;
          }
          setAnalyzingProgress((i + 1) / totalConversations);
        } catch (error) {
          console.error('Error extracting decisions from', convDoc.id, error);
        }
      }

      Alert.alert(
        'Analysis Complete',
        `Found ${totalExtracted} new decision${totalExtracted !== 1 ? 's' : ''} from the last 7 days.${
          skippedConversations > 0 ? ` (${skippedConversations} conversation${skippedConversations !== 1 ? 's' : ''} skipped)` : ''
        }`
      );
    } catch (error) {
      console.error('Error analyzing conversations:', error);
      Alert.alert('Error', 'Failed to analyze conversations');
    } finally {
      setAnalyzing(false);
      setAnalyzingProgress(0);
    }
  };

  const handleDelete = async (decisionId: string) => {
    const result = await aiService.deleteDecision(decisionId);
    if (result?.success) {
      // Remove from local state immediately for better UX
      setDecisions(prev => prev.filter(d => d.id !== decisionId));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedDecisions.size === 0) return;
    
    Alert.alert(
      'Delete Decisions',
      `Delete ${selectedDecisions.size} selected decision${selectedDecisions.size !== 1 ? 's' : ''}?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await aiService.bulkDeleteDecisions(Array.from(selectedDecisions));
            if (result?.success) {
              setSelectedDecisions(new Set());
              setSelectionMode(false);
              Alert.alert('Success', result.message);
            }
          },
        },
      ]
    );
  };

  const toggleSelection = (decisionId: string) => {
    setSelectedDecisions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(decisionId)) {
        newSet.delete(decisionId);
      } else {
        newSet.add(decisionId);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    if (selectedDecisions.size === decisions.length) {
      setSelectedDecisions(new Set());
    } else {
      setSelectedDecisions(new Set(decisions.map(d => d.id)));
    }
  };

  const SwipeableDecisionItem = ({item}: {item: Decision & {id: string}}) => {
    const translateX = useRef(new Animated.Value(0)).current;
    const panResponder = useRef(
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return Math.abs(gestureState.dx) > 10 && !selectionMode;
        },
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dx < 0) {
            translateX.setValue(gestureState.dx);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx < -100) {
            Animated.timing(translateX, {
              toValue: -SCREEN_WIDTH,
              duration: 200,
              useNativeDriver: true,
            }).start(() => {
              handleDelete(item.id);
            });
          } else {
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
              tension: 100,
            }).start();
          }
        },
      })
    ).current;

    return (
      <View style={styles.swipeContainer}>
        <View style={styles.deleteBackground}>
          <Ionicons name="trash-outline" size={24} color="#FFF" />
          <Text style={styles.deleteText}>Delete</Text>
        </View>
        <Animated.View
          style={[styles.animatedCard, {transform: [{translateX}]}]}
          {...panResponder.panHandlers}>
          <RenderDecisionCard item={item} />
        </Animated.View>
      </View>
    );
  };

  const RenderDecisionCard = ({item}: {item: Decision & {id: string}}) => (
    <TouchableOpacity
      style={[
        styles.decisionCard,
        selectionMode && selectedDecisions.has(item.id) && styles.selectedCard,
      ]}
      onPress={() => {
        if (selectionMode) {
          toggleSelection(item.id);
        } else {
          router.push(`/chat/${item.conversationId}`);
        }
      }}
      onLongPress={() => {
        if (!selectionMode) {
          setSelectionMode(true);
          toggleSelection(item.id);
        }
      }}>
      {selectionMode && (
        <View style={styles.selectionIndicator}>
          <Ionicons
            name={selectedDecisions.has(item.id) ? 'checkmark-circle' : 'circle-outline'}
            size={24}
            color={selectedDecisions.has(item.id) ? '#007AFF' : '#999'}
          />
        </View>
      )}
      <View style={styles.decisionHeader}>
        <Text style={styles.decisionText} numberOfLines={2}>
          {item.decision || 'Decision text unavailable'}
        </Text>
        {item.decisionMaker && (
          <View style={styles.decisionMakerBadge}>
            <Ionicons name="person" size={12} color="#007AFF" />
            <Text style={styles.decisionMakerText}>{item.decisionMaker}</Text>
          </View>
        )}
      </View>

      <Text style={styles.rationale} numberOfLines={2}>
        {item.rationale || 'No rationale provided'}
      </Text>

      {item.alternativesConsidered?.length > 0 && (
        <Text style={styles.alternatives} numberOfLines={1}>
          Alt: {item.alternativesConsidered.slice(0, 2).join(', ')}
          {item.alternativesConsidered.length > 2 && ` +${item.alternativesConsidered.length - 2}`}
        </Text>
      )}

      <View style={styles.participants}>
        {item.participants && item.participants.length > 0 ? (
          <>
            {item.participants.slice(0, 3).map((participant, index) => (
              <View key={index} style={styles.participantChip}>
                <Text style={styles.participantText}>{participant}</Text>
              </View>
            ))}
            {item.participants.length > 3 && (
              <Text style={styles.moreParticipants}>+{item.participants.length - 3}</Text>
            )}
          </>
        ) : (
          <Text style={styles.participantText}>No participants</Text>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.dateText}>
          {(() => {
            try {
              const madeAtDate = item.madeAt instanceof Date
                ? item.madeAt
                : item.madeAt?.toDate?.()
                ? item.madeAt.toDate()
                : new Date(item.madeAt);
              
              if (!isNaN(madeAtDate.getTime())) {
                return format(madeAtDate, 'MMM d');
              }
            } catch (error) {
              console.log('Error formatting madeAt:', error);
            }
            return '';
          })()}
        </Text>
        <View style={styles.confidenceBadge}>
          <Text style={styles.confidenceText}>
            {Math.round(item.confidence * 100)}%
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderItem = ({item}: {item: Decision & {id: string}}) => {
    if (selectionMode) {
      return <RenderDecisionCard item={item} />;
    }
    return <SwipeableDecisionItem item={item} />;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (selectionMode) {
              setSelectionMode(false);
              setSelectedDecisions(new Set());
            } else {
              router.back();
            }
          }}
          style={styles.backButton}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <Ionicons name={selectionMode ? "close" : "arrow-back"} size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>
          {selectionMode
            ? `${selectedDecisions.size} Selected`
            : 'Decisions'
          }
        </Text>
        {selectionMode ? (
          <View style={styles.selectionActions}>
            <TouchableOpacity
              onPress={selectAll}
              style={styles.selectAllButton}>
              <Text style={styles.selectAllText}>
                {selectedDecisions.size === decisions.length ? 'None' : 'All'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleBulkDelete}
              disabled={selectedDecisions.size === 0}
              style={styles.deleteButton}>
              <Ionicons name="trash-outline" size={24} color={selectedDecisions.size > 0 ? '#FF3B30' : '#999'} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={handleAnalyze}
            disabled={analyzing}
            style={styles.analyzeButton}>
            {analyzing ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : (
              <Ionicons name="analytics-outline" size={24} color="#007AFF" />
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Progress Bar */}
      {analyzing && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <Animated.View
              style={[
                styles.progressFill,
                {width: `${analyzingProgress * 100}%`},
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            Analyzing conversations... {Math.round(analyzingProgress * 100)}%
          </Text>
        </View>
      )}

      {/* Content */}
      {decisions.length > 0 ? (
        <FlatList
          data={decisions}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.summary}>
              <Text style={styles.summaryText}>
                📌 {decisions.length} decision{decisions.length !== 1 ? 's' : ''}{' '}
                tracked
              </Text>
            </View>
          }
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🎯</Text>
          <Text style={styles.emptyText}>No decisions yet</Text>
          <Text style={styles.emptySubtext}>
            Team decisions will appear here as Ava detects them
          </Text>
          <TouchableOpacity
            style={styles.analyzeNowButton}
            onPress={handleAnalyze}>
            <Text style={styles.analyzeNowText}>Analyze Conversations</Text>
          </TouchableOpacity>
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
  analyzeButton: {
    padding: 4,
  },
  selectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  selectAllText: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 14,
  },
  deleteButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  progressContainer: {
    backgroundColor: '#FFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E5E5E5',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  progressText: {
    marginTop: 8,
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  list: {
    padding: 16,
    gap: 12,
  },
  summary: {
    backgroundColor: '#F0F8FF',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#007AFF40',
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  swipeContainer: {
    marginBottom: 8,
    position: 'relative',
  },
  deleteBackground: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 100,
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  animatedCard: {
    backgroundColor: '#FFF',
  },
  decisionCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  selectedCard: {
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  selectionIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
  },
  decisionHeader: {
    marginBottom: 8,
  },
  decisionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    lineHeight: 20,
    marginBottom: 4,
  },
  decisionMakerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F8FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  decisionMakerText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  rationale: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 6,
  },
  alternatives: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  participants: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  participantChip: {
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  participantText: {
    fontSize: 11,
    color: '#333',
  },
  moreParticipants: {
    fontSize: 11,
    color: '#666',
    alignSelf: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 11,
    color: '#999',
  },
  confidenceBadge: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  confidenceText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
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
    marginBottom: 24,
  },
  analyzeNowButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  analyzeNowText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});