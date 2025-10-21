# Conversation Splitting - Improved Behavior

**Date:** October 21, 2025  
**Feature:** Keep old conversations visible after splitting  
**Status:** ✅ IMPLEMENTED  

---

## 🎯 **User Request**

> "Split conversations is working well, but we need to preserve our old history of the prior conversation for both of the users, and save a row on the messages page, so the 3 users can go back to that convo whenever they want, without the 3rd user they just started a new convo with."

---

## 📱 **New Behavior (Like WhatsApp)**

### **Scenario: User A and B chat, then add User C**

**Before the change:**
1. User A and B have 100 messages in conversation
2. User A adds User C
3. ❌ Old conversation (A+B) gets archived and disappears
4. ❌ A and B lose access to their history

**After the change:**
1. User A and B have 100 messages in conversation
2. User A adds User C
3. ✅ **Old conversation (A+B) stays visible** with all 100 messages
4. ✅ **New conversation (A+B+C) is created** starting fresh
5. ✅ User A sees BOTH conversations on Messages page:
   - **"User B"** (direct, 100 messages) - old history preserved
   - **"User B, User C"** (group, 0 messages) - new group chat
6. ✅ User B sees BOTH conversations:
   - **"User A"** (direct, 100 messages) - old history preserved
   - **"User A, User C"** (group, 0 messages) - new group chat
7. ✅ User C only sees:
   - **"User A, User B"** (group, 0 messages) - can't see old history

---

## 🔧 **Implementation Changes**

### **File:** `services/conversationService.ts`

#### **Before (Archiving):**
```typescript
// Archive the old conversation
await updateDoc(doc(db, 'conversations', oldConversationId), {
  archivedAt: Timestamp.now(),
  archivedBy: initiatorId,
  archivedReason: 'participants_changed',
  updatedAt: Timestamp.now(),
});

// Filter out archived conversations
.filter(conversation => {
  return !conversation.archivedAt;
});
```

#### **After (Keep Active):**
```typescript
// DON'T archive - keep it active for original participants
// Just update timestamp so it doesn't interfere with sorting
await updateDoc(doc(db, 'conversations', oldConversationId), {
  updatedAt: Timestamp.now(),
});

// No filtering - all conversations visible
// (except those explicitly deleted by user)
```

### **File:** `types/index.ts`

Removed archived fields:
```typescript
// REMOVED:
archivedAt?: Date;
archivedBy?: string;
archivedReason?: string;
```

---

## 🎨 **User Experience**

### **Messages Screen After Split:**

```
┌─────────────────────────────────────┐
│ Messages                         ✏️ │
├─────────────────────────────────────┤
│                                     │
│ 👥 John, Sarah                      │
│    Started new group                │ ← NEW: Group with 3 people
│    Just now                         │
│                                     │
│ 👤 John                             │
│    Hey! Want to grab lunch?         │ ← OLD: 1-on-1 with all history
│    2h ago                           │
│                                     │
└─────────────────────────────────────┘
```

### **What Each User Sees:**

**User A (initiated the split):**
- ✅ Old conversation with User B (direct)
- ✅ New conversation with User B + C (group)
- Can switch between them anytime

**User B:**
- ✅ Old conversation with User A (direct)
- ✅ New conversation with User A + C (group)
- Can access all old messages with A

**User C (newly added):**
- ✅ New conversation with User A + B (group)
- ❌ Cannot see old A+B conversation (not a participant)

---

## 🔐 **Privacy & Security**

### **Access Control:**

1. **Old conversation** (A+B):
   - Participants: `[A, B]`
   - Only A and B can read/write
   - C cannot access (Firestore rules enforce this)
   - All 100 messages preserved

2. **New conversation** (A+B+C):
   - Participants: `[A, B, C]`
   - All 3 can read/write
   - Starts with 0 messages
   - Fresh conversation

### **Firestore Security Rules:**

```javascript
match /conversations/{conversationId} {
  allow read: if isAuthenticated() && 
    request.auth.uid in resource.data.participants;
}
```

This ensures User C cannot access the old conversation even if they somehow get the ID.

---

## 🧪 **Testing Scenarios**

### **Scenario 1: Add Third Person**

1. **Setup:**
   - User A and B have 50 messages
   - User A adds User C

2. **Expected:**
   - ✅ A sees 2 conversations (A+B direct, A+B+C group)
   - ✅ B sees 2 conversations (A+B direct, A+B+C group)
   - ✅ C sees 1 conversation (A+B+C group)
   - ✅ A can open old A+B chat and see all 50 messages
   - ✅ C cannot access old A+B chat

### **Scenario 2: Remove Person from Group**

1. **Setup:**
   - Group chat: A, B, C with 30 messages
   - User A removes User C

2. **Expected:**
   - ✅ Old group (A+B+C) stays visible for all
   - ✅ New conversation (A+B) created as direct
   - ✅ C can still see old 30 messages but can't send new ones
   - ✅ A and B continue in new direct conversation

### **Scenario 3: Multiple Splits**

1. **Setup:**
   - A+B (100 messages) → Add C → A+B+C
   - A+B+C (50 messages) → Add D → A+B+C+D

2. **Expected:**
   - ✅ User A sees 3 conversations:
     - A+B (100 messages, direct)
     - A+B+C (50 messages, group)
     - A+B+C+D (0 messages, group)
   - ✅ User D only sees A+B+C+D (new group)
   - ✅ All history preserved per participant set

---

## 📊 **Data Structure**

### **After Split: User A's Conversations Collection**

```javascript
// Old conversation (still exists, active)
{
  id: "userA_userB",
  type: "direct",
  participants: ["userA", "userB"],
  lastMessage: {
    text: "Hey! Want to grab lunch?",
    timestamp: "2025-10-21T14:00:00Z",
    senderId: "userA"
  },
  updatedAt: "2025-10-21T16:00:00Z" // Updated when split happened
}

// New conversation (created on split)
{
  id: "abc123-uuid",
  type: "group",
  participants: ["userA", "userB", "userC"],
  lastMessage: {
    text: "Started new group",
    timestamp: "2025-10-21T16:00:00Z",
    senderId: "userA"
  },
  createdAt: "2025-10-21T16:00:00Z"
}
```

### **Messages Collection Structure:**

```javascript
// Old conversation messages (preserved)
conversations/userA_userB/messages/
  - msg1: "Hi!"
  - msg2: "How are you?"
  - ... (100 messages)

// New conversation messages (empty at start)
conversations/abc123-uuid/messages/
  - (empty - fresh start)
```

---

## 🎯 **Benefits**

### **For Users:**
1. ✅ **Never lose chat history** - old conversations always accessible
2. ✅ **Clear separation** - know which chat has which people
3. ✅ **Privacy preserved** - new members can't see old messages
4. ✅ **Flexibility** - can continue old chat or use new group

### **For Privacy:**
1. ✅ **New members isolated** - can't access previous conversations
2. ✅ **Removed members isolated** - can see old but not new
3. ✅ **Message history compartmentalized** - per participant set

### **For App Performance:**
1. ✅ **No message duplication** - each message stored once
2. ✅ **Simple queries** - just filter by participants
3. ✅ **Efficient storage** - conversations only created when needed

---

## 🔄 **Migration Notes**

### **Existing Archived Conversations:**

If any conversations were archived before this change, they won't appear in the list. To fix:

**Option 1: Update Query (Recommended)**
```typescript
// Show all conversations, even if they have archivedAt field
.filter(conversation => {
  const deletedBy = conversation.deletedBy || [];
  return !deletedBy.includes(userId);
});
```

**Option 2: Clean Up Firestore**
```javascript
// Remove archivedAt field from all conversations
conversations.forEach(conv => {
  if (conv.archivedAt) {
    updateDoc(doc(db, 'conversations', conv.id), {
      archivedAt: deleteField(),
      archivedBy: deleteField(),
      archivedReason: deleteField()
    });
  }
});
```

---

## 📝 **Summary**

**Old Behavior:**
- Split → Archive old → Hide from list
- History lost for original participants

**New Behavior:**
- Split → Keep old active → Show both on list
- History preserved for everyone
- Privacy maintained (new people can't access old chat)

**Result:**
- ✅ Best of both worlds: history preservation + privacy
- ✅ Matches WhatsApp/Signal behavior
- ✅ Users never lose messages
- ✅ Clear separation between old and new conversations

---

**Status:** ✅ Implemented  
**Files Changed:** 2 (`conversationService.ts`, `types/index.ts`)  
**Breaking Changes:** None  
**Ready for Testing:** Yes

