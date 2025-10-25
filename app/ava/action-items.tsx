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
};

export default function ActionItemsScreen() {
  const [actionItems, setActionItems] = useState<ActionItemWithConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
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

    // Query action items - try user-specific first, then fall back to all
    const unsubscribe = aiService.getAllActionItems().onSnapshot(async (snapshot: any) => {
      console.log(`📋 All action items snapshot received: ${snapshot.size} items`);
      
      // Filter to show: assigned to user OR unassigned
      const userItems = snapshot.docs.filter((doc: any) => {
        const data = doc.data();
        return data.assigneeId === userId || !data.assigneeId;
      });
      
      console.log(`📋 Filtered to ${userItems.length} items (assigned to you or unassigned)`);
      
      const items = userItems.map((doc: any) => {
        const data = doc.data();
        console.log('Action item:', {
          id: doc.id,
          task: data.task,
          assignee: data.assignee,
          assigneeId: data.assigneeId,
          status: data.status,
        });
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
              
              return { ...item, conversationName };
            }
          } catch (error) {
            console.error('Error fetching conversation name:', error);
          }
          return item;
        })
      );
      
      console.log(`✅ Loaded ${itemsWithNames.length} action items with conversation names`);
      setActionItems(itemsWithNames);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAnalyze = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      Alert.alert('Error', 'You must be logged in to analyze conversations');
      return;
    }

    setAnalyzing(true);
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
      
      for (const convDoc of convsSnapshot.docs) {
        const convData = convDoc.data();
        
        // Skip deleted or hidden conversations
        if (convData.deleted || 
            convData.hiddenBy?.includes(userId) ||
            convData.deletedBy?.includes(userId)) {
          console.log(`⏭️ Skipping deleted/hidden conversation: ${convDoc.id}`);
          skippedConversations++;
          continue;
        }
        
        try {
          console.log('📋 Extracting actions from conversation:', convDoc.id);
          const result = await aiService.extractActions(convDoc.id);
          console.log(`✅ Extracted ${result.count} action items from ${convDoc.id}`);
          totalExtracted++;
        } catch (error: any) {
          console.error('❌ Error extracting actions from', convDoc.id, error);
          console.error('Error details:', JSON.stringify(error, null, 2));
          totalErrors++;
        }
      }

      console.log(`📊 Analysis complete: ${totalExtracted} successful, ${totalErrors} errors`);

      // Wait a bit for Firestore to propagate
      await new Promise(resolve => setTimeout(resolve, 2000));

      Alert.alert(
        'Analysis Complete',
        `Analyzed ${totalExtracted} conversation${totalExtracted !== 1 ? 's' : ''}. ${totalErrors > 0 ? `${totalErrors} failed. ` : ''}Action items should appear now.`
      );
    } catch (error) {
      console.error('❌ Fatal error analyzing conversations:', error);
      Alert.alert('Error', 'Failed to analyze conversations');
    } finally {
      setAnalyzing(false);
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
    const isSelected = selectedItems.has(item.id);
    
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
              onPress={() => selectMode ? toggleSelection(item.id) : router.push(`/chat/${item.conversationId}`)}
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
            ListHeaderComponent={
              !selectMode && (
                <View style={styles.summary}>
                  <Text style={styles.summaryText}>
                    ✅ {actionItems.length} pending • Swipe to delete • Long press to select
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
    backgroundColor: '#FFF9E6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
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