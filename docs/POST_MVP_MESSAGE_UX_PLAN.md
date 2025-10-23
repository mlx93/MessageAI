# Post-MVP Message UX Enhancement Plan

**Document Type:** Implementation Plan (No Code)  
**Product:** aiMessage  
**Version:** 1.1.0 (Post-MVP)  
**Created:** October 23, 2025  
**Status:** Planning Phase

---

## 📋 Overview

This document outlines the implementation strategy for 8 new post-MVP features focused on enhancing the messaging user experience. These features build upon the existing production-ready MVP codebase, leveraging the established service layer architecture, Firebase infrastructure, and custom iMessage-style UI components. All features maintain consistency with the current design system (iOS blue #007AFF, smooth animations, gesture-based interactions) and follow the existing patterns for real-time updates, offline support, and error handling.

**Current Architecture Context:**
- Custom chat UI at `app/chat/[id].tsx` with FlatList and message bubbles
- Service layer: `messageService.ts`, `conversationService.ts`, `imageService.ts`
- Real-time Firestore listeners with <1 second latency
- SQLite caching for offline support (500ms batched writes)
- React Native Reanimated for 60 FPS animations
- Existing swipe gesture implementation on Messages page

---

## 🎯 Phase A: Core Message Interactions

### **Feature 1: Delete Individual Messages** 🔥

**User Experience:** Users can long-press their own messages (2+ seconds) to reveal a modal with Delete/Copy options, with the selected message clearly highlighted through a subtle background overlay or scale animation. When Delete is tapped, the message bubble animates with a "burst" effect (scale up + fade out over 300ms) before disappearing, providing satisfying visual feedback. The deleted message is soft-deleted in Firestore (new `deletedBy: string[]` field added to Message model) rather than hard-deleted, allowing for potential recovery or audit trails while being filtered from UI queries. The conversation's `lastMessage` field must be recalculated intelligently—if the deleted message was the most recent, traverse backwards through messages to find the first non-deleted message and update the preview on the Messages page accordingly.

**Technical Implementation:**
- Add `onLongPress` handler to message bubbles in `app/chat/[id].tsx` using React Native's `Pressable` component with `delayLongPress={2000}`
- Create new modal component `MessageActionSheet.tsx` with Delete/Copy options, styled as iOS bottom sheet with blur background
- Implement `deleteMessage(messageId, userId)` function in `messageService.ts` that updates Firestore with `arrayUnion` to append userId to `deletedBy[]` array
- Add burst animation using React Native Reanimated: `useAnimatedStyle` with `withSequence(withTiming(scale: 1.2), withTiming(opacity: 0))`
- Update `subscribeToMessages()` query to filter where `currentUserId not in deletedBy` array
- Create `recalculateLastMessage(conversationId)` helper in `conversationService.ts` that queries the most recent non-deleted message and updates conversation document
- Add Firestore index: `messages` collection, `conversationId` (ASC), `timestamp` (DESC), `deletedBy` (ARRAY)

**Edge Cases:**
- If user deletes the only message in a conversation, set `lastMessage` to empty string with placeholder text "No messages"
- Handle race conditions where multiple users delete messages simultaneously by using Firestore transactions for `lastMessage` updates
- Ensure deleted messages don't appear in push notifications by filtering in Cloud Function `sendMessageNotification`

---

### **Feature 2: Copy Message Text** 📋

**User Experience:** The same long-press gesture (2+ seconds) that reveals the Delete option also shows a "Copy" button in the action sheet modal, available for any message regardless of sender. When Copy is tapped, the message text is instantly copied to the device clipboard using Expo's `expo-clipboard` package, and a subtle toast notification appears at the top of the screen (similar to iOS system toast) with the text "Copied to clipboard" that auto-dismisses after 1.5 seconds. This feature works seamlessly for both text-only messages and image messages with captions, copying only the text content while ignoring media URLs.

**Technical Implementation:**
- Extend `MessageActionSheet.tsx` modal to include "Copy" button for all messages (not just own messages like Delete)
- Use `expo-clipboard`'s `Clipboard.setStringAsync(text)` method to copy message text to clipboard
- Create reusable `ToastNotification.tsx` component with slide-in animation from top using Reanimated's `SlideInUp` preset
- Add toast state management using React Context or local state in `app/chat/[id].tsx` with auto-dismiss timer
- Ensure proper text extraction: for text messages use `message.text`, for image messages with captions use `message.text || ''`

**Edge Cases:**
- Handle empty messages (image-only, no caption) by showing toast "No text to copy"
- Sanitize text before copying to remove any formatting characters or special symbols that might break clipboard
- Test on both iOS and Android to ensure clipboard API works consistently across platforms

---

### **Feature 2.5: Improved Swipe-to-Delete Gesture** ✨

**User Experience:** On the Messages page (`app/(tabs)/index.tsx`), the swipe-right-to-reveal-delete gesture is already implemented but occasionally fails to reveal the Delete button due to inconsistent swipe velocity detection or threshold sensitivity. This improvement refines the gesture recognizer parameters—specifically adjusting the swipe threshold distance (reduce to 40px from current value) and velocity threshold (increase sensitivity to 100px/s) to ensure the Delete button reliably appears with minimal user effort. The improvement maintains the existing visual design (red Delete button on right side) and animation timing while only enhancing the gesture recognition logic for better responsiveness.

**Technical Implementation:**
- Review current swipe implementation in `app/(tabs)/index.tsx` using React Native Gesture Handler's `PanGestureHandler` or `Swipeable` component
- Adjust gesture configuration: reduce `activeOffsetX` threshold from current value to `[-40, 0]` for right swipe detection
- Increase velocity sensitivity by lowering `velocityX` threshold to `-100` (pixels per second)
- Test swipe gesture across different device sizes (iPhone SE, iPhone Pro Max, iPad) to ensure consistent behavior
- Consider adding haptic feedback on Delete button reveal using `expo-haptics` for tactile confirmation

**Edge Cases:**
- Prevent accidental deletion by maintaining confirmation alert before actually deleting conversation
- Ensure swipe gesture doesn't interfere with scroll behavior when user is quickly scrolling through conversation list
- Test with VoiceOver/accessibility features enabled to ensure gesture doesn't break screen reader navigation

---

### **Feature 3: Profile Picture Upload & Display** 📸

**User Experience:** In the Edit Profile screen (`app/auth/edit-profile.tsx`), users can tap their current avatar (which shows "ML" initials by default) to launch the native image picker and select a photo from their Camera Roll. The selected image is automatically cropped to a square aspect ratio (1:1) using `expo-image-manipulator` before being uploaded to Firebase Storage at `users/{userId}/profile-photos/avatar.jpg`, with the resulting URL stored in the user's `photoURL` field. Once uploaded, this profile picture replaces the initial-based avatars everywhere in the app: conversation list bubbles, chat headers, participant pills in group chats, contact list items, and in-app notification banners. The upload process shows a subtle loading spinner overlay on the avatar during the 2-5 second upload, with error handling that falls back to initials if upload fails.

**Technical Implementation:**
- Add `onPress` handler to avatar View in `app/auth/edit-profile.tsx` that calls existing `pickAndUploadImage()` from `imageService.ts`
- Extend `pickAndUploadImage()` to accept a second parameter `cropToSquare: boolean`, using `expo-image-manipulator`'s `manipulateAsync()` with `resize` action to ensure 1:1 aspect ratio (e.g., 400x400px)
- Store uploaded image in new Storage path `users/{userId}/profile-photos/avatar.jpg` (separate from message media at `users/{userId}/media/`)
- Update Firestore user document with `photoURL` field, triggering real-time updates across all components via existing presence listeners
- Refactor avatar rendering logic across all screens into reusable `Avatar.tsx` component that accepts `{ photoURL, initials, size }` props and conditionally renders Image or initials Text
- Add loading state (`isUploadingAvatar: boolean`) in `edit-profile.tsx` to show ActivityIndicator overlay during upload
- Update Firestore security rules to allow write access to `users/{userId}/profile-photos/` path

**Edge Cases:**
- If image upload fails, show Alert with error message and keep existing photoURL unchanged
- Handle users who later want to remove their profile picture: add "Remove Photo" option that sets `photoURL: null` and reverts to initials
- Ensure profile picture updates propagate to all active conversations immediately through real-time listeners (already handled by existing presence system)
- Consider image caching strategy to avoid re-downloading profile pictures on every render (use `expo-image`'s built-in caching)

---

## 🎯 Phase B: Group Chat UX Enhancements

### **Feature 4: Group Info Screen** 👥

**User Experience:** When users tap the header of a group chat conversation, they navigate to a new Group Info screen that displays comprehensive group details including the full participant list with each member's avatar (profile picture or initials) and display name. This screen uses a vertically scrollable FlatList to accommodate groups with many participants, with each participant rendered as a row similar to the Contacts page design (avatar left, name center, chevron right). The screen maintains the same navigation structure as the chat screen—a back button returns users to the group conversation they came from, and tapping any participant row navigates to that user's Contact Info screen (Feature 6).

**Technical Implementation:**
- Create new screen `app/group/[id].tsx` using Expo Router's file-based routing with dynamic `id` parameter
- Add `onPress` handler to group chat header in `app/chat/[id].tsx` that checks if conversation type is 'group', then calls `router.push('/group/' + conversationId)`
- Fetch conversation data using existing `getConversation(conversationId)` from `conversationService.ts` to access `participantDetails` object
- Render participant list using FlatList with `keyExtractor={(item) => item.userId}` and custom `ParticipantRow` component
- Each ParticipantRow shows reusable `Avatar.tsx` component (from Feature 3), `Text` for displayName, and right chevron icon
- Add `onPress` to each row that navigates to Contact Info screen: `router.push('/contact/' + participantUserId)`
- Style header with group name, participant count subtitle (Feature 5), and standard back button

**Edge Cases:**
- Handle scenarios where a participant has left the group or been removed—show their name as grayed out with "(Left)" suffix
- If current user is group admin (future feature), show "Add Participant" button at top of list
- Ensure real-time updates: if a participant is added/removed while viewing Group Info, update list via Firestore listener
- Handle groups with 100+ participants: implement pagination with `limit(50)` query and "Load More" button at bottom

---

### **Feature 5: Participant Count in Header** 🔢

**User Experience:** In group chat conversations, the header displays a two-line layout where the first line shows the group name and the second line (subtitle) shows "(N participants)" in a smaller, gray font (e.g., "Family Chat" on line 1, "(5 participants)" on line 2). This subtle visual indicator helps users quickly understand the size of the group without needing to enter the Group Info screen, especially useful for distinguishing between small groups (3-4 people) and large broadcast-style groups (20+ people). The participant count updates in real-time as members are added or removed from the group.

**Technical Implementation:**
- Modify header configuration in `app/chat/[id].tsx` for group conversations to accept `headerSubtitle` prop (may require custom header component since Expo Router's default header doesn't support subtitles)
- Create custom header component `GroupChatHeader.tsx` that renders two Text elements: title (17px, semibold, black) and subtitle (13px, regular, #8E8E93 gray)
- Calculate participant count from `conversation.participants.length` and format as `(${count} participants)` or `(${count} participant)` for count === 1
- Subscribe to conversation updates using existing `subscribeToConversation()` listener pattern to update count in real-time
- Ensure subtitle only shows for `type: 'group'` conversations, not direct chats

**Edge Cases:**
- Handle pluralization: use "participant" (singular) when count is 1, "participants" (plural) otherwise
- If participant count exceeds 99, consider showing "99+" to avoid layout issues with very large numbers
- Test header layout on small devices (iPhone SE) to ensure subtitle doesn't overflow or wrap awkwardly

---

### **Feature 6: Contact Info Screen** 👤

**User Experience:** When users tap a participant's name in the Group Info screen (Feature 4) or tap a contact's name on the Contacts page, they navigate to a dedicated Contact Info screen that displays that user's full profile information in a clean, read-only view similar to the Edit Profile screen's layout. This screen shows the user's profile picture (or initials), display name prominently centered at the top, email address (if available), phone number in formatted style (e.g., "+1 (202) 555-1234"), and a primary action button labeled "Send Message" that creates or navigates to a direct conversation with that user. The back button returns users to whichever screen they came from—either Group Info or Contacts page—maintaining a natural navigation flow.

**Technical Implementation:**
- Create new screen `app/contact/[userId].tsx` using Expo Router with dynamic `userId` parameter
- Fetch user data using existing `getUserProfile(userId)` from `authService.ts` to get `displayName`, `email`, `phoneNumber`, `photoURL`
- Render profile layout using same component structure as `edit-profile.tsx` but with read-only Text fields instead of TextInputs
- Add "Send Message" button that calls `createOrGetConversation([currentUserId, targetUserId])` from `conversationService.ts`, then navigates to chat: `router.push('/chat/' + conversationId)`
- Format phone number display using existing `formatPhoneNumber()` utility from `utils/phoneFormat.ts`
- Use reusable `Avatar.tsx` component for profile picture display (large size, e.g., 120x120px)
- Handle navigation back correctly: use `router.back()` which automatically returns to previous screen in stack (Group Info or Contacts)

**Edge Cases:**
- If viewing your own profile (userId === currentUser.uid), hide "Send Message" button and show "Edit Profile" button instead that navigates to `edit-profile.tsx`
- Handle scenarios where user data fails to load: show loading spinner during fetch, error message if fetch fails
- If user has blocked you (future feature), show "Blocked" status instead of "Send Message" button
- Consider adding additional actions in future: "Block User", "Report User", "Add to Favorites"

---

## 🎯 Phase C: Loading State Polish

### **Feature 7: Image Upload Placeholder** ⏳

**User Experience:** When users send an image message in a conversation, the 2-5 second upload process to Firebase Storage now displays a polished loading state directly in the message bubble instead of showing nothing or a blank space. The placeholder consists of a light gray rectangle (#E8E8E8) matching the bubble background color, with a centered ActivityIndicator (spinner) or optionally a blurred low-resolution thumbnail of the image being uploaded if we generate one using `expo-image-manipulator`'s blur effect. This loading state maintains the same message bubble styling (border radius, padding) as regular image messages, positioned in the FlatList exactly where the final image will appear, preventing jarring layout shifts when the upload completes.

**Technical Implementation:**
- Modify `sendImageMessage()` in `messageService.ts` to return an upload progress callback or promise that updates local state
- In `app/chat/[id].tsx`, add local state `uploadingImages: Map<localId, { progress: number, thumbnailUri?: string }>` to track in-flight uploads
- When user picks image, immediately add optimistic message to FlatList with `status: 'uploading'` and localId
- Render custom `ImageMessageBubble.tsx` component that checks message status: if 'uploading', show gray placeholder View with ActivityIndicator; if 'sent', show Image component
- Optionally generate blurred thumbnail: before upload, use `expo-image-manipulator` to create 50x50px blurred version (blur radius 50), display as background of placeholder
- On upload completion, update message status to 'sent' and replace placeholder with full image URL via real-time Firestore listener
- Show upload progress percentage below spinner if desired: "Uploading 45%"

**Edge Cases:**
- If upload fails after 3 retry attempts, replace placeholder with error state: red border, "Upload Failed" text, "Retry" button
- Handle user navigating away from chat mid-upload: continue upload in background (existing service layer handles this), update UI when they return
- Test with very slow networks (throttle to 3G in dev tools) to ensure placeholder appears long enough to be noticeable
- Consider maximum upload time: if upload exceeds 30 seconds, show timeout error and queue for retry

---

### **Feature 8: Image Download Loading** ⏬

**User Experience:** When users receive an image message or open a conversation with images for the first time, the download process from Firebase Storage shows a professional loading state rather than blank white space or delayed pop-in. Each image position in the message bubble displays a light gray placeholder (#E8E8E8) with a centered ActivityIndicator (spinner) that animates while the image is being fetched from the network. As soon as the image data arrives, it fades in smoothly using a 200ms opacity animation, providing visual continuity and preventing the jarring "flash" effect of instant image appearance common in messaging apps.

**Technical Implementation:**
- Leverage React Native's `Image` component's built-in `onLoadStart`, `onLoad`, and `onError` callbacks to track loading state
- Create enhanced `CachedImage.tsx` wrapper component that manages loading/error states internally using `useState`
- Initially render gray placeholder View with ActivityIndicator, set `loading: true` state
- When Image `onLoad` fires, set `loading: false` and animate opacity from 0 to 1 using Reanimated's `FadeIn` preset over 200ms
- Use `expo-image` package instead of core Image for better caching and progressive loading features
- Add retry logic: if `onError` fires, show "Tap to retry" button on placeholder that re-fetches image
- Maintain consistent image dimensions during loading by setting explicit width/height based on message metadata (if available) or using 16:9 aspect ratio default

**Edge Cases:**
- If image fails to load after 3 retry attempts, show permanent error state: gray box with broken image icon and "Unable to load image" text
- Handle very large images (5MB+) that take 10+ seconds to download on slow networks: show progress indicator if possible (Storage signed URLs don't provide progress)
- Test with airplane mode enabled: ensure placeholder doesn't hang indefinitely, show offline error after 10 second timeout
- Consider adding image compression preview: download low-res version first (if we generate thumbnails server-side with Cloud Functions), then load full-res version in background

---

## 🛠️ Implementation Order & Dependencies

**Recommended Build Sequence:**

1. **Phase A.2 (Copy Message)** — Simplest feature, introduces action sheet modal pattern used by other features
2. **Phase A.1 (Delete Message)** — Builds on action sheet, adds animation and soft-delete logic
3. **Phase A.3 (Profile Picture Upload)** — Independent feature, creates reusable Avatar component needed for Phase B
4. **Phase C.7 & C.8 (Loading States)** — Can be done in parallel, both enhance image handling
5. **Phase B.5 (Participant Count)** — Simple header change, prepares for Group Info screen
6. **Phase B.4 (Group Info Screen)** — Creates navigation destination for Feature 6
7. **Phase B.6 (Contact Info Screen)** — Completes Group Info flow
8. **Phase A.2.5 (Swipe Gesture)** — Polish improvement, can be done anytime

**Estimated Effort:**
- **Phase A:** 8-12 hours (3-4 hours per feature)
- **Phase B:** 6-9 hours (2-3 hours per feature)
- **Phase C:** 4-6 hours (2-3 hours per feature)
- **Total:** 18-27 hours (approximately 2-3 full development days)

---

## 📐 Design System Consistency

All features maintain the existing aiMessage design language:

**Colors:**
- Primary: #007AFF (iOS Blue)
- Gray Placeholder: #E8E8E8
- Text Gray: #8E8E93
- Background: #FFFFFF
- Red (Delete): #FF3B30

**Typography:**
- Header Title: 17px, Semibold
- Subtitle: 13px, Regular
- Action Sheet: 16px, Semibold
- Body Text: 15px, Regular

**Animations:**
- Duration: 200-300ms
- Easing: Spring (damping: 15, stiffness: 150)
- Opacity transitions: FadeIn/FadeOut presets
- Gesture-driven: Follow finger, snap to final position

**Spacing:**
- Standard padding: 16px
- Compact padding: 8px
- Border radius: 18px (bubbles), 12px (modals)

---

## 🧪 Testing Considerations

Each feature should be tested for:

1. **Functionality:** Core feature works as described
2. **Real-time sync:** Updates propagate to other devices within 1 second
3. **Offline behavior:** Graceful degradation when network unavailable
4. **Error handling:** Clear error messages, retry options
5. **Performance:** No frame drops, smooth 60 FPS animations
6. **Accessibility:** VoiceOver/TalkBack compatible, proper ARIA labels
7. **Cross-platform:** Works identically on iOS and Android (or documented differences)

---

## 🚀 Future Enhancements (Beyond This Plan)

These features lay the groundwork for additional post-MVP improvements:

- **Message reactions** (❤️, 👍, 😂) — Uses similar long-press pattern as delete/copy
- **Message forwarding** — Extends action sheet modal with "Forward" option
- **Group admin controls** — Adds permissions to Group Info screen
- **Voice messages** — Similar loading placeholders as image messages
- **Message search** — Enhances conversation UX
- **Read receipts per user** — Shows who read message in Group Info

---

**Document Version:** 1.0  
**Last Updated:** October 23, 2025  
**Status:** ✅ Ready for Implementation  
**Next Step:** Begin implementation with Phase A.2 (Copy Message)

