import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  RefreshControl,
} from 'react-native';
import {router} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {SafeAreaView} from 'react-native-safe-area-context';
import aiService, {ActionItem} from '../../services/aiService';
import {formatDistanceToNow} from 'date-fns';
import {auth, db} from '../../services/firebase';
import {collection, getDocs, query, where, orderBy, doc, getDoc, updateDoc, serverTimestamp} from 'firebase/firestore';
import {RectButton, Swipeable} from 'react-native-gesture-handler';
import {GestureHandlerRootView} from 'react-native-gesture-handler';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

type ActionItemWithConversation = ActionItem & {
  id: string;
  conversationName?: string;
  participants?: string[]; // First names only
};

export default function ActionItemsScreen() {
  const [actionItems, setActionItems] = useState<ActionItemWithConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [completing, setCompleting] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingProgress, setAnalyzingProgress] = useState(0);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const swipeableRefs = new Map();

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      console.log('❌ No user ID available for action items');
      setLoading(false);
      return;
    }

    console.log('👤 Loading action items for user:', userId);

    // First, get all conversations where user is a participant
    const loadActionItems = async () => {
      try {
        const convsRef = collection(db, 'conversations');
        const convsQuery = query(
          convsRef,
          where('participants', 'array-contains', userId)
        );
        const convsSnapshot = await getDocs(convsQuery);
        const userConversationIds = convsSnapshot.docs.map(doc => doc.id);

        console.log(`📋 User is in ${userConversationIds.length} conversations:`, userConversationIds);

        // Query all action items (no filtering by assignee)
        const unsubscribe = aiService.getAllActionItems().onSnapshot(async (snapshot: any) => {
          console.log(`📋 All action items snapshot received: ${snapshot.size} items`);
          
          // Debug: Log all conversation IDs from action items
          const allConvIds = snapshot.docs.map((doc: any) => doc.data().conversationId);
          console.log('📋 Action items conversation IDs:', allConvIds);
          
          // Filter to show items from user's conversations
          const userItems = snapshot.docs.filter((doc: any) => {
            const data = doc.data();
            const isInUserConv = userConversationIds.includes(data.conversationId);
            console.log(`📋 Item ${doc.id}: conversationId=${data.conversationId}, included=${isInUserConv}`);
            return isInUserConv;
          });
          
          console.log(`📋 Filtered to ${userItems.length} items from your conversations`);
          
          const items = userItems.map((doc: any) => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
            };
          });
          
          // Fetch conversation names for each item
          const itemsWithNames = await Promise.all(
            items.map(async (item: ActionItemWithConversation) => {
              try {
                const convDoc = await getDoc(doc(db, 'conversations', item.conversationId));
                if (convDoc.exists()) {
                  const convData = convDoc.data();
                  let conversationName = 'Unknown Conversation';
                  let participants: string[] = [];
                  
                  if (convData.isGroup) {
                    conversationName = convData.groupName || 'Group Chat';
                  } else if (convData.participantDetails) {
                    // For direct messages, show other participants' names
                    const names = Object.entries(convData.participantDetails)
                      .filter(([id]) => id !== userId)
                      .map(([, details]: [string, any]) => details.displayName)
                      .filter(Boolean)
                      .join(', ');
                    conversationName = names || 'Direct Message';
                  }
                  
                  // Extract first names from participantDetails for display
                  if (convData.participantDetails) {
                    participants = Object.values(convData.participantDetails)
                      .map((details: any) => {
                        const displayName = details.displayName || '';
                        // Extract first name only
                        return displayName.split(' ')[0];
                      })
                      .filter(Boolean);
                  }
                  
                  return { ...item, conversationName, participants };
                }
              } catch (error) {
                console.error('Error fetching conversation name:', error);
              }
              return item;
            })
          );
          
          // Sort: user's items first, then by creation date (newest first)
          const sortedItems = itemsWithNames.sort((a, b) => {
            const aIsPersonal = a.assigneeId === userId;
            const bIsPersonal = b.assigneeId === userId;
            
            // Primary sort: personal items first
            if (aIsPersonal && !bIsPersonal) return -1;
            if (!aIsPersonal && bIsPersonal) return 1;
            
            // Secondary sort within same category: by confidence (high to low)
            const aConfidence = a.confidence || 0;
            const bConfidence = b.confidence || 0;
            if (Math.abs(aConfidence - bConfidence) > 0.05) {
              return bConfidence - aConfidence;
            }
            
            // Tertiary sort: by creation date (newest first)
            const aTime = a.createdAt?.toMillis?.() || 0;
            const bTime = b.createdAt?.toMillis?.() || 0;
            return bTime - aTime;
          });
          
          console.log(`✅ Loaded ${sortedItems.length} action items with conversation names`);
          setActionItems(sortedItems);
          setLoading(false);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Error loading action items:', error);
        setLoading(false);
      }
    };

    const unsubPromise = loadActionItems();
    return () => {
      // Cleanup: close all swipeable refs and clear the map
      swipeableRefs.forEach((ref) => {
        ref?.close();
      });
      swipeableRefs.clear();
      
      // Unsubscribe from snapshot listener
      unsubPromise.then(unsub => unsub && unsub());
    };
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    console.log('🔄 Manual refresh triggered');
    // The snapshot listener should automatically update
    // Just wait a moment for any pending updates
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const handleAnalyze = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      Alert.alert('Error', 'You must be logged in to analyze conversations');
      return;
    }

    // Track count before analysis
    const itemsBeforeAnalysis = actionItems.length;
    console.log(`📊 Starting analysis with ${itemsBeforeAnalysis} existing items`);

    setAnalyzing(true);
    setAnalyzingProgress(0);
    try {
      // Get all user's conversations (excluding deleted/hidden)
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

      console.log(`🔍 Starting analysis of ${convsSnapshot.size} conversations`);

      // Extract action items from each conversation
      let totalExtracted = 0;
      let totalErrors = 0;
      let skippedConversations = 0;
      const totalConversations = convsSnapshot.size;
      
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
          console.log('📋 Extracting actions from conversation:', convDoc.id);
          const result = await aiService.extractActions(convDoc.id);
          
          // Null safety check - result can be null if there's an error
          if (result === null) {
            console.error('❌ extractActions returned null for', convDoc.id);
            totalErrors++;
          } else if (result.count && result.count > 0) {
            totalExtracted += result.count;
            console.log(`✅ Extracted ${result.count} action items from ${convDoc.id}`);
          }
          
          setAnalyzingProgress((i + 1) / totalConversations);
        } catch (error: any) {
          console.error('❌ Error extracting actions from', convDoc.id, error);
          console.error('Error details:', JSON.stringify(error, null, 2));
          totalErrors++;
          setAnalyzingProgress((i + 1) / totalConversations);
        }
      }

      console.log(`📊 Analysis complete: ${totalExtracted} items extracted, ${totalErrors} errors`);

      // Wait for Firestore to propagate
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check if items actually loaded using the count we saved before analysis
      const itemsAfterAnalysis = actionItems.length;
      const newItemsCount = itemsAfterAnalysis - itemsBeforeAnalysis;
      console.log(`📊 Items after analysis: ${itemsAfterAnalysis} (${newItemsCount > 0 ? '+' : ''}${newItemsCount} change)`);
      
      if (newItemsCount > 0) {
        Alert.alert(
          'Analysis Complete',
          `Found ${newItemsCount} new action item${newItemsCount !== 1 ? 's' : ''}!`
        );
      } else if (totalExtracted > 0) {
        Alert.alert(
          'Analysis Complete', 
          `Analyzed ${totalConversations - skippedConversations} conversation${totalConversations - skippedConversations !== 1 ? 's' : ''}. ${totalErrors > 0 ? `${totalErrors} failed. ` : ''}Items may take a moment to appear. Pull down to refresh if needed.`
        );
      } else {
        Alert.alert(
          'Analysis Complete',
          'No new action items found in the analyzed conversations.'
        );
      }
    } catch (error) {
      console.error('❌ Fatal error analyzing conversations:', error);
      Alert.alert('Error', 'Failed to analyze conversations');
    } finally {
      setAnalyzing(false);
      setAnalyzingProgress(0);
    }
  };

  const handleComplete = async (itemId: string) => {
    if (selectMode) {
      toggleSelection(itemId);
      return;
    }
    
    Alert.alert(
      'Complete Action Item',
      'Mark this action item as completed?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Complete',
          style: 'default',
          onPress: async () => {
            setCompleting(itemId);
            try {
              await aiService.completeActionItem(itemId);
            } catch (error) {
              console.error('Error completing action item:', error);
              Alert.alert('Error', 'Failed to complete action item');
            } finally {
              setCompleting(null);
            }
          },
        },
      ]
    );
  };

  const handleDelete = async (itemId: string) => {
    try {
      await updateDoc(doc(db, 'action_items', itemId), {
        status: 'deleted',
        deletedAt: serverTimestamp(),
      });
      // Close the swipeable
      const ref = swipeableRefs.get(itemId);
      ref?.close();
    } catch (error) {
      console.error('Error deleting action item:', error);
      Alert.alert('Error', 'Failed to delete action item');
    }
  };

  const toggleSelection = (itemId: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedItems(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedItems.size === actionItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(actionItems.map(item => item.id)));
    }
  };

  const handleBulkComplete = async () => {
    if (selectedItems.size === 0) {
      Alert.alert('No Selection', 'Please select items to complete');
      return;
    }

    Alert.alert(
      'Bulk Complete',
      `Complete ${selectedItems.size} action item${selectedItems.size !== 1 ? 's' : ''}?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Complete All',
          style: 'default',
          onPress: async () => {
            setBulkProcessing(true);
            try {
              await Promise.all(
                Array.from(selectedItems).map(id => 
                  aiService.completeActionItem(id)
                )
              );
              setSelectedItems(new Set());
              setSelectMode(false);
            } catch (error) {
              console.error('Error completing items:', error);
              Alert.alert('Error', 'Failed to complete some items');
            } finally {
              setBulkProcessing(false);
            }
          },
        },
      ]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) {
      Alert.alert('No Selection', 'Please select items to delete');
      return;
    }

    Alert.alert(
      'Bulk Delete',
      `Delete ${selectedItems.size} action item${selectedItems.size !== 1 ? 's' : ''}?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            setBulkProcessing(true);
            try {
              await Promise.all(
                Array.from(selectedItems).map(id => 
                  updateDoc(doc(db, 'action_items', id), {
                    status: 'deleted',
                    deletedAt: serverTimestamp(),
                  })
                )
              );
              setSelectedItems(new Set());
              setSelectMode(false);
            } catch (error) {
              console.error('Error deleting items:', error);
              Alert.alert('Error', 'Failed to delete some items');
            } finally {
              setBulkProcessing(false);
            }
          },
        },
      ]
    );
  };

  const renderRightActions = (progress: Animated.AnimatedInterpolation<number>, itemId: string) => {
    const translateX = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [192, 0],
    });

    return (
      <Animated.View
        style={[
          styles.swipeActionsContainer,
          {
            transform: [{translateX}],
          },
        ]}>
        <RectButton
          style={[styles.swipeAction, styles.deleteAction]}
          onPress={() => handleDelete(itemId)}>
          <Ionicons name="trash-outline" size={20} color="#FFF" />
          <Text style={styles.swipeActionText}>Delete</Text>
        </RectButton>
      </Animated.View>
    );
  };

  const renderItem = ({item}: {item: ActionItemWithConversation}) => {
    const userId = auth.currentUser?.uid;
    const isSelected = selectedItems.has(item.id);
    const isPersonal = item.assigneeId === userId;
    
    return (
      <Swipeable
        ref={(ref) => {
          if (ref) swipeableRefs.set(item.id, ref);
        }}
        renderRightActions={(progress) => renderRightActions(progress, item.id)}
        overshootRight={false}
        friction={2}
        rightThreshold={40}>
        <View
          style={[
            styles.itemCard,
            isPersonal && styles.itemCardPersonal,
            isSelected && styles.itemCardSelected
          ]}>
          <View style={styles.itemRow}>
            {selectMode && (
              <TouchableOpacity
                style={styles.selectionIndicator}
                onPress={() => toggleSelection(item.id)}>
                <Ionicons
                  name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                  size={22}
                  color={isSelected ? "#007AFF" : "#C7C7CC"}
                />
              </TouchableOpacity>
            )}
            
            {!selectMode && (
              <TouchableOpacity
                style={styles.checkbox}
                onPress={() => handleComplete(item.id)}
                disabled={completing === item.id}>
                {completing === item.id ? (
                  <ActivityIndicator size="small" color="#007AFF" />
                ) : (
                  <Ionicons name="ellipse-outline" size={22} color="#007AFF" />
                )}
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={styles.itemContent}
              onPress={() => selectMode ? toggleSelection(item.id) : router.push(`/ava/action-item-detail/${item.id}`)}
              onLongPress={() => {
                if (!selectMode) {
                  setSelectMode(true);
                  toggleSelection(item.id);
                }
              }}
              activeOpacity={0.7}>
              <View style={styles.taskHeader}>
                <Text style={styles.itemTask} numberOfLines={2}>{item.task}</Text>
                {item.conversationName && (
                  <Text style={styles.conversationName} numberOfLines={1}>
                    📱 {item.conversationName}
                  </Text>
                )}
                {item.participants && item.participants.length > 0 && (
                  <Text style={styles.participantsText} numberOfLines={1}>
                    👥 {item.participants.join(', ')}
                  </Text>
                )}
              </View>

              {item.context && (
                <Text style={styles.itemContext} numberOfLines={1}>
                  {item.context}
                </Text>
              )}

              <View style={styles.itemFooter}>
                {item.assignee ? (
                  <View style={styles.tag}>
                    <Ionicons name="person-outline" size={10} color="#666" />
                    <Text style={styles.tagText}>{item.assignee}</Text>
                  </View>
                ) : (
                  <View style={[styles.tag, styles.unassignedTag]}>
                    <Ionicons name="help-circle-outline" size={10} color="#FF9500" />
                    <Text style={[styles.tagText, styles.unassignedText]}>Unassigned</Text>
                  </View>
                )}
                {item.deadline && (() => {
                  try {
                    const deadlineDate = item.deadline instanceof Date
                      ? item.deadline
                      : item.deadline?.toDate?.()
                      ? item.deadline.toDate()
                      : new Date(item.deadline);
                    
                    if (!isNaN(deadlineDate.getTime())) {
                      return (
                        <View style={[styles.tag, styles.deadlineTag]}>
                          <Ionicons name="calendar-outline" size={10} color="#FF3B30" />
                          <Text style={[styles.tagText, styles.deadlineText]}>
                            {formatDistanceToNow(deadlineDate, {addSuffix: true})}
                          </Text>
                        </View>
                      );
                    }
                  } catch (error) {
                    console.log('Error formatting deadline:', error);
                  }
                  return null;
                })()}
                <View style={styles.tag}>
                  <Text style={styles.tagText}>
                    {Math.round(item.confidence * 100)}%
                  </Text>
                </View>
                
                {!selectMode && (
                  <View style={styles.viewLink}>
                    <Text style={styles.viewLinkText}>View</Text>
                    <Ionicons name="arrow-forward" size={12} color="#007AFF" />
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </Swipeable>
    );
  };

  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              if (selectMode) {
                setSelectMode(false);
                setSelectedItems(new Set());
              } else {
                router.back();
              }
            }}
            style={styles.backButton}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Ionicons name={selectMode ? "close" : "arrow-back"} size={24} color="#007AFF" />
          </TouchableOpacity>
          
          <Text style={styles.title}>
            {selectMode 
              ? `${selectedItems.size} selected` 
              : 'Action Items'}
          </Text>
          
          {selectMode ? (
            <TouchableOpacity
              onPress={handleSelectAll}
              style={styles.analyzeButton}>
              <Text style={styles.selectAllText}>
                {selectedItems.size === actionItems.length ? 'None' : 'All'}
              </Text>
            </TouchableOpacity>
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

        {/* Bulk Action Bar */}
        {selectMode && (
          <View style={styles.bulkActionBar}>
            <TouchableOpacity
              style={[styles.bulkButton, bulkProcessing && styles.bulkButtonDisabled]}
              onPress={handleBulkComplete}
              disabled={bulkProcessing}>
              {bulkProcessing ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-done" size={18} color="#FFF" />
                  <Text style={styles.bulkButtonText}>Complete</Text>
                </>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.bulkButton, styles.bulkDeleteButton, bulkProcessing && styles.bulkButtonDisabled]}
              onPress={handleBulkDelete}
              disabled={bulkProcessing}>
              {bulkProcessing ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={18} color="#FFF" />
                  <Text style={styles.bulkButtonText}>Delete</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading action items...</Text>
          </View>
        ) : actionItems.length > 0 ? (
          <FlatList
            data={actionItems}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor="#007AFF"
                title="Pull to refresh"
              />
            }
            ListHeaderComponent={
              !selectMode && (
                <View style={styles.summary}>
                  <Text style={styles.summaryText}>
                    📌 {actionItems.length} pending action item{actionItems.length !== 1 ? 's' : ''}
                  </Text>
                </View>
              )
            }
          />
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>✨</Text>
            <Text style={styles.emptyText}>All caught up!</Text>
            <Text style={styles.emptySubtext}>
              No pending action items at the moment
            </Text>
          </View>
        )}
      </SafeAreaView>
    </GestureHandlerRootView>
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
    paddingVertical: 10,
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
  selectAllText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
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
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  bulkActionBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  bulkButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    borderRadius: 6,
  },
  bulkDeleteButton: {
    backgroundColor: '#FF3B30',
  },
  bulkButtonDisabled: {
    opacity: 0.6,
  },
  bulkButtonText: {
    color: '#FFF',
    fontSize: 14,
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
  list: {
    padding: 12,
    gap: 8,
  },
  summary: {
    backgroundColor: '#F0F8FF',
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#007AFF30',
  },
  summaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  swipeActionsContainer: {
    width: 80,
    flexDirection: 'row',
  },
  swipeAction: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteAction: {
    backgroundColor: '#FF3B30',
  },
  swipeActionText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  itemCard: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  itemCardPersonal: {
    backgroundColor: '#E8F2FF',
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  itemCardSelected: {
    backgroundColor: '#E8F2FF',
    borderWidth: 1.5,
    borderColor: '#007AFF',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  selectionIndicator: {
    marginRight: 10,
  },
  checkbox: {
    marginRight: 10,
  },
  itemContent: {
    flex: 1,
  },
  taskHeader: {
    marginBottom: 4,
  },
  itemTask: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    lineHeight: 18,
    marginBottom: 2,
  },
  conversationName: {
    fontSize: 11,
    color: '#666',
  },
  participantsText: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  itemContext: {
    fontSize: 12,
    color: '#888',
    lineHeight: 16,
    marginBottom: 6,
  },
  itemFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#F0F1F3',
  },
  deadlineTag: {
    backgroundColor: '#FFF0F0',
  },
  unassignedTag: {
    backgroundColor: '#FFF5E6',
  },
  tagText: {
    fontSize: 10,
    color: '#666',
  },
  deadlineText: {
    color: '#FF3B30',
  },
  unassignedText: {
    color: '#FF9500',
  },
  viewLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  viewLinkText: {
    fontSize: 11,
    color: '#007AFF',
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
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
  },
});