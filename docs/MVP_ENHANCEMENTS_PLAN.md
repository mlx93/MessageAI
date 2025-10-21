# MVP Enhancements Implementation Plan

**Date:** October 21, 2025  
**Goal:** Implement 3 major improvements to make aiMessage production-ready

---

## 🎯 **Three Major Enhancements**

1. **Invite Feature** - SMS invites for non-users
2. **Rebrand to aiMessage** - Complete app rename
3. **Phone + OTP Auth** - WhatsApp-style authentication

---

## 📋 **Phase 1: Rebrand to "aiMessage"** 
**Time:** 30 minutes  
**Complexity:** Low  
**Impact:** High (user-facing)

### Files to Update

#### 1.1 App Configuration
- [ ] `app.json` - Display name, slug
- [ ] `package.json` - Project name
- [ ] `README.md` - Project documentation

#### 1.2 Code References
- [ ] Search and replace "MessageAI" → "aiMessage"
- [ ] Update comments and docs
- [ ] Update error messages

#### 1.3 UI Text
- [ ] Login screen title
- [ ] Registration screen title
- [ ] Tab labels
- [ ] Alert messages

#### 1.4 Assets
- [ ] App icon (if custom)
- [ ] Splash screen
- [ ] Branding colors (optional)

### Success Criteria
- ✅ App displays "aiMessage" everywhere
- ✅ No broken references
- ✅ Consistent branding

---

## 📋 **Phase 2: Phone + OTP Authentication**
**Time:** 4-6 hours  
**Complexity:** High  
**Impact:** Critical (core UX improvement)

### 2.1 Firebase Setup
- [ ] Enable Firebase Phone Authentication
- [ ] Configure reCAPTCHA for web
- [ ] Test phone auth in Firebase Console
- [ ] Set up auth triggers

### 2.2 New Auth Screens

#### Screen 1: Phone Number Entry
- [ ] Create `app/auth/phone-login.tsx`
- [ ] Phone number input with formatting
- [ ] Country code selector
- [ ] "Send Code" button
- [ ] Loading state

#### Screen 2: OTP Verification
- [ ] Create `app/auth/verify-otp.tsx`
- [ ] 6-digit code input
- [ ] Auto-focus and advance
- [ ] Resend code timer (60s)
- [ ] Verify button

#### Screen 3: Profile Setup (New Users Only)
- [ ] Create `app/auth/setup-profile.tsx`
- [ ] Display name input
- [ ] Optional email input
- [ ] Profile photo upload (optional)
- [ ] Continue button

### 2.3 Auth Service Updates
- [ ] `sendPhoneVerificationCode(phoneNumber)` - Send OTP
- [ ] `verifyPhoneCode(verificationId, code)` - Verify OTP
- [ ] `checkIfUserExists(phoneNumber)` - Check existing user
- [ ] `createUserWithPhone(phone, name, email?)` - Create new user
- [ ] Update user profile fields

### 2.4 Navigation Flow
```
App Launch
  ↓
Check Auth State
  ↓
├─ Not Authenticated
│  ↓
│  Phone Login Screen
│  ↓
│  Enter Phone: +1 (234) 567-8900
│  ↓
│  Tap "Send Code"
│  ↓
│  OTP Verification Screen
│  ↓
│  Enter Code: [1] [2] [3] [4] [5] [6]
│  ↓
│  Verify
│  ↓
│  ├─ New User → Profile Setup Screen
│  │               ↓
│  │               Enter Name & Email
│  │               ↓
│  └─ Existing User → Home Screen
│
└─ Authenticated → Home Screen
```

### 2.5 Data Model Updates

**Firestore: `users` collection**
```typescript
{
  uid: string,
  phoneNumber: string,        // PRIMARY identifier (E.164 format)
  displayName: string,
  email?: string,             // OPTIONAL now
  photoURL?: string,
  online: boolean,
  lastSeen: Date,
  createdAt: Date,
  fcmToken?: string,
  // Remove: password, emailVerified
}
```

**Firestore: `usersByPhone` index (for uniqueness)**
```typescript
{
  phoneNumber: string,        // Document ID
  uid: string,
  createdAt: Date
}
```

### 2.6 Security Rules Update
```javascript
// Firestore Rules
match /usersByPhone/{phone} {
  allow read: if request.auth != null;
  allow create: if request.auth != null 
    && request.resource.data.uid == request.auth.uid;
}
```

### 2.7 Testing Checklist
- [ ] New user registration flow
- [ ] Existing user login flow
- [ ] Invalid phone number handling
- [ ] Invalid OTP handling
- [ ] Resend code functionality
- [ ] Network error handling
- [ ] Profile creation
- [ ] Session persistence

### Success Criteria
- ✅ Users can sign up with phone only
- ✅ OTP verification works
- ✅ Existing users can login
- ✅ Phone numbers are unique
- ✅ No email/password required

---

## 📋 **Phase 3: Invite Feature for Non-Users**
**Time:** 3-4 hours  
**Complexity:** Medium  
**Impact:** High (growth feature)

### 3.1 Twilio Setup
- [ ] Create Twilio account (free trial: $15 credit)
- [ ] Get phone number for sending SMS
- [ ] Get Account SID and Auth Token
- [ ] Add Twilio credentials to Cloud Functions config
- [ ] Test SMS sending

### 3.2 Deep Linking Setup
- [ ] Configure Expo deep linking
- [ ] Set up app scheme: `aimessage://`
- [ ] Create invite link format: `aimessage://invite/{inviterUserId}`
- [ ] Handle deep link on app open
- [ ] Fallback to web landing page

### 3.3 Cloud Function: Send Invite
```typescript
// functions/src/index.ts
export const sendInviteSMS = onCall(async (request) => {
  const { phoneNumber, inviterName, inviterUserId } = request.data;
  
  // Generate invite link
  const inviteLink = `https://aimessage.app/invite/${inviterUserId}`;
  
  // Send SMS via Twilio
  const message = `${inviterName} invited you to chat on aiMessage! Download: ${inviteLink}`;
  
  await twilio.messages.create({
    body: message,
    to: phoneNumber,
    from: TWILIO_PHONE_NUMBER
  });
  
  return { success: true };
});
```

### 3.4 Client-Side Implementation

#### Update Contacts Screen
- [ ] Make "Invite" button functional
- [ ] Show loading state while sending
- [ ] Success confirmation
- [ ] Track invite sent (optional)

```tsx
// app/(tabs)/contacts.tsx
const handleInvite = async (contact: Contact) => {
  try {
    setInviting(true);
    
    // Call Cloud Function
    const sendInvite = httpsCallable(functions, 'sendInviteSMS');
    await sendInvite({
      phoneNumber: contact.phoneNumber,
      inviterName: userProfile.displayName,
      inviterUserId: user.uid
    });
    
    Alert.alert(
      'Invite Sent!',
      `${contact.name} will receive a text message with a link to download aiMessage.`
    );
    
    // Optional: Track invite
    await logInvite(user.uid, contact.phoneNumber);
    
  } catch (error) {
    Alert.alert('Error', 'Failed to send invite. Please try again.');
  } finally {
    setInviting(false);
  }
};
```

#### Handle Incoming Invites
- [ ] Parse deep link on app open
- [ ] Show "Join {InviterName} on aiMessage" screen
- [ ] Pre-fill registration with invite context
- [ ] Auto-add inviter as contact after signup

### 3.5 Invite Tracking (Optional)
```typescript
// Firestore: invites collection
{
  inviterId: string,
  inviteePhone: string,
  sentAt: Date,
  accepted: boolean,
  acceptedAt?: Date
}
```

### 3.6 Cost Estimation
- **Twilio SMS:** $0.0079 per message (US)
- **Free trial:** $15 credit = ~1,900 invites
- **Monthly estimate:** If 100 users invite 5 friends = $4/month

### Success Criteria
- ✅ Invite button works
- ✅ SMS received within 30 seconds
- ✅ Deep link opens app
- ✅ Inviter auto-added after signup
- ✅ Graceful error handling

---

## 📋 **Phase 4: Polish & Testing**
**Time:** 2 hours  
**Complexity:** Low  
**Impact:** Medium (quality)

### 4.1 UI Polish
- [ ] Loading states everywhere
- [ ] Error messages user-friendly
- [ ] Animations smooth
- [ ] Colors consistent
- [ ] Icons updated

### 4.2 Edge Cases
- [ ] Network offline handling
- [ ] Invalid input validation
- [ ] Rate limiting (too many OTP requests)
- [ ] Already invited users
- [ ] Blocked numbers

### 4.3 Documentation
- [ ] Update README
- [ ] User guide for invites
- [ ] Admin guide for Twilio setup
- [ ] Troubleshooting guide

### 4.4 Testing Scenarios

#### Scenario 1: New User Signup
1. Enter phone number
2. Receive OTP
3. Enter code
4. Set up profile
5. See home screen

#### Scenario 2: Existing User Login
1. Enter phone number
2. Receive OTP
3. Enter code
4. Immediately see home screen

#### Scenario 3: Invite Friend
1. Go to Contacts
2. Tap "Invite" on non-user
3. Friend receives SMS
4. Friend clicks link
5. Friend signs up
6. Both see each other in contacts

#### Scenario 4: Error Handling
1. Invalid phone number → Clear error
2. Wrong OTP → Clear error + retry
3. Network offline → Helpful message
4. Twilio fails → Fallback message

---

## 🗓️ **Implementation Timeline**

### Day 1 (Today)
- **Morning:** Phase 1 - Rebrand to aiMessage (30 min)
- **Afternoon:** Phase 2 - Phone Auth Setup (4 hours)
  - Firebase configuration
  - Create auth screens
  - Implement OTP flow
  - Basic testing

### Day 2
- **Morning:** Phase 2 - Complete Phone Auth (2 hours)
  - Profile setup screen
  - Error handling
  - Comprehensive testing
- **Afternoon:** Phase 3 - Invite Feature (3 hours)
  - Twilio setup
  - Cloud Function
  - Client implementation

### Day 3
- **Morning:** Phase 4 - Polish & Testing (2 hours)
- **Afternoon:** Final testing and documentation

**Total Time:** 11-13 hours over 2-3 days

---

## 🎯 **Success Metrics**

### User Experience
- ✅ Signup takes < 60 seconds
- ✅ Only 3 screens to get started
- ✅ No password to remember
- ✅ Phone verified automatically

### Technical
- ✅ All tests pass
- ✅ No console errors
- ✅ Works on iOS and Android
- ✅ Handles edge cases gracefully

### Business
- ✅ Invite feature drives growth
- ✅ Phone auth reduces friction
- ✅ Brand consistency everywhere

---

## 🚀 **Let's Start!**

### Phase 1: Rebrand (30 minutes) ← START HERE
This is the quickest win. Let's do this first, then move to phone auth.

**Ready to begin?** I'll start with the rebrand now! 🎨

