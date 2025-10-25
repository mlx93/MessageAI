# Clearing Existing Decisions with Generic Names

Since we've fixed the participant name mapping, you may want to clear existing decisions that have generic names like "Participant 5", "Unnamed Participant", or "undefined".

## Option 1: Delete from the App (Recommended)
1. Open the Decisions page
2. Long-press on any decision to enter selection mode
3. Tap "All" to select all decisions
4. Tap the trash icon to delete them all
5. Run "Analyze" again to extract decisions with proper names

## Option 2: Clear via Firebase Console
1. Go to https://console.firebase.google.com/project/messageai-mlx93/firestore
2. Navigate to the "decisions" collection
3. Select all documents with generic participant names
4. Delete them
5. Re-analyze conversations in the app

## What's Been Fixed
- Decisions now show actual first names (e.g., "Myles", "Hadi", "Dan")
- No more "Participant 5", "Unnamed Participant", or "undefined"
- Decision maker is properly identified and displayed
- Names are extracted from participantProfiles in conversations
- Falls back to "User_XXXX" only when no profile exists

## Testing the Fix
1. Delete existing decisions with bad names
2. Go to Decisions page and tap the analyze button
3. New decisions should have proper participant names
4. Each decision should show who made it (if identifiable)
