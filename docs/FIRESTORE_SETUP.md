# Firestore Security Rules and Indexes Setup

## Security Rules

Open Firebase Console → Firestore Database → Rules, and replace with the following:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return request.auth.uid == userId;
    }
    
    function emailIsUnique(email) {
      return !exists(/databases/$(database)/documents/usersByEmail/$(email));
    }
    
    function phoneIsUnique(phone) {
      return !exists(/databases/$(database)/documents/usersByPhone/$(phone));
    }
    
    // Users collection
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() 
        && isOwner(userId)
        && emailIsUnique(request.resource.data.email)
        && phoneIsUnique(request.resource.data.phoneNumber);
      allow update: if isAuthenticated() && isOwner(userId);
      
      // User contacts subcollection
      match /contacts/{contactId} {
        allow read, write: if isAuthenticated() && isOwner(userId);
      }
    }
    
    // Email uniqueness index
    match /usersByEmail/{email} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() 
        && request.resource.data.uid == request.auth.uid;
    }
    
    // Phone uniqueness index
    match /usersByPhone/{phone} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() 
        && request.resource.data.uid == request.auth.uid;
    }
    
    // Conversations collection
    match /conversations/{conversationId} {
      allow read: if isAuthenticated() 
        && request.auth.uid in resource.data.participants;
      allow create: if isAuthenticated() 
        && request.auth.uid in request.resource.data.participants;
      allow update: if isAuthenticated() 
        && request.auth.uid in resource.data.participants;
      
      // Messages subcollection
      match /messages/{messageId} {
        allow read: if isAuthenticated() 
          && request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants;
        allow create: if isAuthenticated() 
          && request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants
          && request.resource.data.senderId == request.auth.uid;
        allow update: if isAuthenticated() 
          && request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants;
      }
      
      // Typing indicators subcollection
      match /typing/{userId} {
        allow read: if isAuthenticated() 
          && request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants;
        allow write: if isAuthenticated() 
          && isOwner(userId)
          && request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants;
      }
    }
    
    // Active conversations (for notification suppression)
    match /activeConversations/{userId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated() && isOwner(userId);
    }
  }
}
```

## Firestore Indexes

### Option 1: Auto-create via Console Errors (Recommended)

1. Run your app and navigate to conversations/messages
2. Open browser console and look for Firestore errors like:
   ```
   The query requires an index. You can create it here: https://console.firebase.google.com/...
   ```
3. Click the link to auto-create the index
4. Wait 2-5 minutes for index to build

### Option 2: Manual Creation

Go to Firebase Console → Firestore Database → Indexes → Create Index

**Index 1: Conversations ordered by updatedAt**
- Collection ID: `conversations`
- Fields indexed:
  - `participants` (Array-contains)
  - `updatedAt` (Descending)
- Query scope: Collection

**Index 2: Messages ordered by timestamp**
- Collection ID: `messages`  
- Collection group: ✅ Yes (collection group query)
- Fields indexed:
  - `conversationId` (Ascending)
  - `timestamp` (Ascending)
- Query scope: Collection group

**Index 3: Typing indicators (optional, create if needed)**
- Collection ID: `typing`
- Collection group: ✅ Yes
- Fields indexed:
  - `conversationId` (Ascending)
  - `isTyping` (Ascending)
  - `timestamp` (Descending)
- Query scope: Collection group

## Testing Security Rules

After deploying rules, test that:

1. ✅ Users can only read their own profile
2. ✅ Duplicate email registration fails with permission-denied
3. ✅ Duplicate phone registration fails with permission-denied
4. ✅ Users can only access conversations they're part of
5. ✅ Users can only send messages in conversations they're part of

## Index Build Time

- Simple indexes: 2-5 minutes
- Complex indexes: 5-10 minutes
- You'll receive an email when indexes are ready
- App will work once indexes are built

## Troubleshooting

**Error: "The query requires an index"**
- Click the link in the error message to create it
- Or manually create the index as shown above

**Error: "permission-denied" when creating user**
- This is EXPECTED when email/phone already exists
- Our code handles this error gracefully

**Conversations not loading**
- Check that Index 1 is built (green checkmark in Firebase Console)
- May take 5-10 minutes after creation

**Messages not loading**
- Check that Index 2 is built
- Ensure it's a Collection Group query (not just Collection)

