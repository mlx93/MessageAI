# Action Items - Assignment & Reassignment Feature

**Date:** October 26, 2025  
**Status:** Design Document - Ready for Implementation  

---

## 🎯 Overview

Action items are **conversation-level entities** that can be assigned, reassigned, and unassigned by conversation participants. This document defines the assignment model and implementation requirements.

---

## 📊 State Model

### Conversation-Level Entities

Action items exist at the **conversation level**, not per-user:

```typescript
interface ActionItem {
  id: string;
  conversationId: string;        // Which conversation this belongs to
  task: string;                  // What needs to be done
  assigneeId: string | null;     // Who it's assigned to (null = unassigned)
  assignee: string | null;       // Display name (null = unassigned)
  createdBy: string;             // Who created it (or 'system' for AI-extracted)
  messageId: string;             // Source message
  context: string;               // Brief context
  deadline: string | null;       // Optional deadline
  confidence: number;            // AI confidence (0-1)
  status: 'pending' | 'completed' | 'deleted';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Key Principles

1. **Shared Existence:** One action item exists in the conversation for all participants
2. **Filtered Visibility:** Users only see items assigned to them + unassigned items
3. **Collaborative Assignment:** Any participant can assign themselves to unassigned items
4. **Flexible Reassignment:** Current assignee can reassign to others in the conversation

---

## 🔐 Assignment Rules

### Who Can See What

| User Role | Assigned to User | Unassigned | Assigned to Other |
|-----------|-----------------|------------|-------------------|
| Participant | ✅ **Shows** | ✅ **Shows** | ❌ **Hidden** |
| Non-Participant | ❌ **Hidden** | ❌ **Hidden** | ❌ **Hidden** |

### Who Can Assign/Reassign

| Action | User Type | Allowed? | Notes |
|--------|-----------|----------|-------|
| Assign self to unassigned | Participant | ✅ Yes | Pick up available tasks |
| Reassign from self to other | Current Assignee | ✅ Yes | Must be in conversation |
| Reassign other's item | Non-Assignee | ❌ No | Cannot modify others' items |
| Unassign from self | Current Assignee | ✅ Yes | Makes item unassigned |
| Assign non-participant | Anyone | ❌ No | Must be in conversation |

---

## 🎨 UI/UX Design

### Action Items List Screen

**Unassigned Items:**
```
┌─────────────────────────────────────────────┐
│ 📌 Action Items                             │
├─────────────────────────────────────────────┤
│ 🔴 Handle the MongoDB setup                 │
│    Unassigned • Database setup              │
│    [Assign to Me] button                    │
│    From: #backend-team                      │
├─────────────────────────────────────────────┤
│ 🟡 Update architecture docs                 │
│    Hadi Raad • Database decision            │
│    From: #backend-team                      │
└─────────────────────────────────────────────┘
```

**Assigned Items:**
```
┌─────────────────────────────────────────────┐
│ 🟡 Run benchmarks this week                 │
│    You • Performance testing                │
│    Due: Wednesday                           │
│    [Unassign] [Reassign...] buttons         │
│    From: #backend-team                      │
└─────────────────────────────────────────────┘
```

### Action Item Detail Screen

**For Unassigned Items:**
```
┌─────────────────────────────────────────────┐
│ Handle the MongoDB setup                    │
├─────────────────────────────────────────────┤
│ Status:       Unassigned                    │
│ Deadline:     Today                         │
│ Confidence:   95%                          │
│ From:         #backend-team                 │
│                                             │
│ Context:                                    │
│ "Database setup for analytics project"      │
│                                             │
│ Source Message: (highlighted)               │
│ Hadi: I can handle the MongoDB setup       │
│                                             │
│ [Assign to Me]  [Assign to Someone...]     │
└─────────────────────────────────────────────┘
```

**For Your Assigned Items:**
```
┌─────────────────────────────────────────────┐
│ Run benchmarks this week                    │
├─────────────────────────────────────────────┤
│ Assigned to:  You (Myles Lewis)            │
│ Deadline:     Wednesday                     │
│ Confidence:   98%                          │
│ From:         #backend-team                 │
│                                             │
│ [Mark Complete]  [Reassign...]  [Unassign] │
└─────────────────────────────────────────────┘
```

### Assignment Modal

```
┌─────────────────────────────────────────────┐
│ Assign Action Item                          │
├─────────────────────────────────────────────┤
│ Task: Handle the MongoDB setup              │
│                                             │
│ Assign to:                                  │
│ ○ Myles Lewis                               │
│ ○ Dan Greenlee                              │
│ ○ Hadi Raad                                 │
│ ○ Unassigned (anyone can pick up)          │
│                                             │
│ [Cancel]              [Assign]              │
└─────────────────────────────────────────────┘
```

---

## 🛠️ Implementation

### Frontend Changes

#### 1. Add Assignment Buttons to List View

**File:** `app/ava/action-items.tsx`

```typescript
const renderItem = ({ item }: { item: ActionItemWithConversation }) => {
  const isAssignedToUser = item.assigneeId === userId;
  const isUnassigned = !item.assigneeId;
  
  return (
    <View style={styles.itemCard}>
      <Text style={styles.task}>{item.task}</Text>
      
      {/* Assignment Status */}
      <View style={styles.assignmentRow}>
        {isUnassigned && (
          <>
            <Text style={styles.unassignedText}>Unassigned</Text>
            <TouchableOpacity 
              onPress={() => handleAssignToMe(item.id)}
              style={styles.assignButton}
            >
              <Text>Assign to Me</Text>
            </TouchableOpacity>
          </>
        )}
        {isAssignedToUser && (
          <>
            <Text style={styles.assignedText}>You</Text>
            <TouchableOpacity 
              onPress={() => handleReassign(item.id)}
              style={styles.reassignButton}
            >
              <Text>Reassign...</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
      
      {/* Rest of item display */}
    </View>
  );
};
```

#### 2. Assignment Handlers

```typescript
const handleAssignToMe = async (itemId: string) => {
  try {
    const itemRef = doc(db, 'action_items', itemId);
    const itemDoc = await getDoc(itemRef);
    
    if (!itemDoc.exists()) {
      Alert.alert('Error', 'Action item not found');
      return;
    }
    
    const itemData = itemDoc.data();
    
    // Verify user is in the conversation
    const convRef = doc(db, 'conversations', itemData.conversationId);
    const convDoc = await getDoc(convRef);
    const convData = convDoc.data();
    
    if (!convData.participants.includes(userId)) {
      Alert.alert('Error', 'You are not a participant in this conversation');
      return;
    }
    
    // Assign to current user
    await updateDoc(itemRef, {
      assigneeId: userId,
      assignee: user.displayName || 'You',
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
    
    Alert.alert('Success', 'Action item assigned to you');
  } catch (error) {
    console.error('Error assigning item:', error);
    Alert.alert('Error', 'Failed to assign action item');
  }
};

const handleReassign = async (itemId: string) => {
  // Get conversation participants
  const itemRef = doc(db, 'action_items', itemId);
  const itemDoc = await getDoc(itemRef);
  const itemData = itemDoc.data();
  
  const convRef = doc(db, 'conversations', itemData.conversationId);
  const convDoc = await getDoc(convRef);
  const convData = convDoc.data();
  
  // Get participant names
  const participants = convData.participants
    .filter(id => id !== userId) // Exclude current user
    .map(id => ({
      id,
      name: convData.participantDetails[id]?.displayName || id.slice(0, 8),
    }));
  
  // Show modal to select new assignee
  setReassignModalVisible(true);
  setReassignItem({ itemId, participants });
};

const handleReassignConfirm = async (newAssigneeId: string) => {
  try {
    const itemRef = doc(db, 'action_items', reassignItem.itemId);
    
    if (newAssigneeId === 'unassigned') {
      // Unassign
      await updateDoc(itemRef, {
        assigneeId: null,
        assignee: null,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      });
    } else {
      // Assign to someone else
      const newAssignee = reassignItem.participants.find(p => p.id === newAssigneeId);
      await updateDoc(itemRef, {
        assigneeId: newAssigneeId,
        assignee: newAssignee?.name || newAssigneeId,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      });
    }
    
    setReassignModalVisible(false);
    Alert.alert('Success', 'Action item reassigned');
  } catch (error) {
    console.error('Error reassigning item:', error);
    Alert.alert('Error', 'Failed to reassign action item');
  }
};
```

#### 3. Reassignment Modal

```typescript
<Modal
  visible={reassignModalVisible}
  transparent={true}
  animationType="slide"
>
  <View style={styles.modalOverlay}>
    <View style={styles.modalContent}>
      <Text style={styles.modalTitle}>Reassign Action Item</Text>
      
      <Text style={styles.modalTask}>{reassignItem?.task}</Text>
      
      <Text style={styles.modalSubtitle}>Assign to:</Text>
      
      {/* Unassign option */}
      <TouchableOpacity
        style={styles.participantOption}
        onPress={() => handleReassignConfirm('unassigned')}
      >
        <Text>Unassigned (anyone can pick up)</Text>
      </TouchableOpacity>
      
      {/* Participant options */}
      {reassignItem?.participants.map(participant => (
        <TouchableOpacity
          key={participant.id}
          style={styles.participantOption}
          onPress={() => handleReassignConfirm(participant.id)}
        >
          <Text>{participant.name}</Text>
        </TouchableOpacity>
      ))}
      
      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => setReassignModalVisible(false)}
      >
        <Text>Cancel</Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>
```

### Backend Changes

#### 1. Add Firestore Security Rules

**File:** `firestore.rules`

```javascript
match /action_items/{itemId} {
  // Allow read for users in the conversation
  allow read: if request.auth != null && 
    get(/databases/$(database)/documents/conversations/$(resource.data.conversationId))
      .data.participants.hasAny([request.auth.uid]);
  
  // Allow update (assignment) if:
  // 1. User is in the conversation
  // 2. User is current assignee (reassigning their own item)
  // 3. Item is unassigned (anyone can claim)
  // 4. Only updating assignment fields
  allow update: if request.auth != null && 
    get(/databases/$(database)/documents/conversations/$(resource.data.conversationId))
      .data.participants.hasAny([request.auth.uid]) &&
    (
      // Assigning unassigned item to self
      (resource.data.assigneeId == null && 
       request.resource.data.assigneeId == request.auth.uid) ||
      // Reassigning own item to someone else in conversation
      (resource.data.assigneeId == request.auth.uid &&
       get(/databases/$(database)/documents/conversations/$(resource.data.conversationId))
         .data.participants.hasAny([request.resource.data.assigneeId])) ||
      // Unassigning own item
      (resource.data.assigneeId == request.auth.uid &&
       request.resource.data.assigneeId == null)
    ) &&
    // Only allow updating assignment fields
    request.resource.data.diff(resource.data).affectedKeys()
      .hasOnly(['assigneeId', 'assignee', 'updatedAt', 'updatedBy']);
  
  // Allow create for users in conversation (AI extraction or manual creation)
  allow create: if request.auth != null &&
    get(/databases/$(database)/documents/conversations/$(request.resource.data.conversationId))
      .data.participants.hasAny([request.auth.uid]);
  
  // Allow delete for current assignee or creator
  allow delete: if request.auth != null &&
    (resource.data.assigneeId == request.auth.uid ||
     resource.data.createdBy == request.auth.uid);
}
```

#### 2. Update Action Item Schema

Add new fields to track updates:

```typescript
interface ActionItem {
  // ... existing fields ...
  updatedAt: Timestamp;        // Last update time
  updatedBy: string | null;    // Who last updated it
  assignmentHistory?: Array<{  // Optional: Track reassignments
    from: string | null;
    to: string | null;
    by: string;
    at: Timestamp;
  }>;
}
```

---

## 🧪 Testing Scenarios

### Scenario 1: Assign Unassigned Item

1. Extract action items from #backend-team
2. Verify unassigned item shows "Unassigned" label
3. Log in as Myles
4. Tap "Assign to Me" on unassigned item
5. Verify item now shows "You" as assignee
6. Log in as Hadi
7. Verify Hadi does NOT see that item anymore (assigned to Myles)

### Scenario 2: Reassign Own Item

1. Log in as Myles (has item assigned to him)
2. Tap "Reassign..." on his action item
3. Select Hadi from participant list
4. Verify item disappears from Myles's list
5. Log in as Hadi
6. Verify item now appears in Hadi's list

### Scenario 3: Unassign Item

1. Log in as Myles (has item assigned to him)
2. Tap "Reassign..."
3. Select "Unassigned"
4. Verify item still appears in Myles's list (now as unassigned)
5. Log in as Hadi
6. Verify Hadi also sees the unassigned item
7. Either user can now claim it

### Scenario 4: Security - Cannot Assign Non-Participant

1. Log in as Myles
2. Try to reassign item to user NOT in conversation
3. Verify Firestore rules block this operation
4. Show error message to user

### Scenario 5: Collaborative Workflow

**Initial State:**
- MongoDB setup task: Unassigned
- Participants: Myles, Hadi, Dan

**Workflow:**
1. Hadi sees unassigned task → Assigns to self
2. Hadi realizes he's overloaded → Reassigns to Myles
3. Myles completes task → Marks complete
4. All participants see consistent state throughout

---

## 🎯 Success Criteria

### User Experience
- ✅ Unassigned items show "Assign to Me" button
- ✅ Assigned items show "Reassign..." and "Unassign" buttons
- ✅ Reassignment modal shows only conversation participants
- ✅ Changes reflect immediately in UI
- ✅ Clear feedback on success/error

### Privacy & Security
- ✅ Users only see items assigned to them + unassigned
- ✅ Cannot reassign items they don't own
- ✅ Cannot assign to users outside conversation
- ✅ Firestore rules enforce all constraints

### Data Integrity
- ✅ Assignment updates tracked with timestamps
- ✅ Optional assignment history for audit trail
- ✅ Real-time updates via Firestore listeners
- ✅ Consistent state across all devices

---

## 📋 Implementation Checklist

### Phase 1: Basic Assignment (Priority)
- [ ] Add "Assign to Me" button for unassigned items
- [ ] Implement `handleAssignToMe` function
- [ ] Update Firestore rules for assignment
- [ ] Test with multiple users
- [ ] Add success/error feedback

### Phase 2: Reassignment
- [ ] Add "Reassign..." button for assigned items
- [ ] Build reassignment modal with participant list
- [ ] Implement `handleReassign` and `handleReassignConfirm`
- [ ] Add "Unassign" option in modal
- [ ] Test reassignment workflow

### Phase 3: Polish & History
- [ ] Add assignment history tracking (optional)
- [ ] Improve modal styling
- [ ] Add haptic feedback
- [ ] Add loading states
- [ ] Add confirmation for unassignment

### Phase 4: Testing & Deployment
- [ ] Test all scenarios from testing section
- [ ] Verify Firestore security rules
- [ ] Test offline behavior
- [ ] Deploy backend rules
- [ ] Deploy frontend changes

---

## 🚀 Future Enhancements

### Smart Assignment Suggestions
- Suggest assignees based on:
  - Past action items (who usually handles this type?)
  - Workload (who has fewer pending items?)
  - Expertise (who's mentioned in similar tasks?)

### Notifications
- Notify user when assigned a new item
- Notify user when reassigned from them
- Notify when deadline approaching

### Bulk Operations
- Reassign multiple items at once
- Assign all unassigned items to yourself
- Bulk unassign for workload balancing

### Assignment Analytics
- Show "Who does what" breakdown per conversation
- Track completion rates by assignee
- Show workload distribution

---

## 📚 Related Documentation

- `ACTION_ITEMS_PHASE_3_FIXES_COMPLETE.md` - Recent fixes
- `ACTION_ITEMS_TROUBLESHOOTING.md` - Troubleshooting guide
- `systemPatterns.md` - Overall architecture
- `firestore.rules` - Security rules implementation

---

**Status:** Ready for implementation  
**Priority:** High (enhances user experience significantly)  
**Estimated Effort:** 2-3 days (including testing)

