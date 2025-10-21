# Phone Number Priority Authentication Plan

**Status**: Planned for Future Implementation  
**Priority**: Post-MVP or Early Enhancement  
**Complexity**: Medium (2-3 hours)

---

## 📋 Current State

### Current Authentication Flow:
- **Primary**: Email + Password
- **Secondary**: Google Sign-In, Apple Sign-In
- **Phone Number**: Required field but not used for authentication
- **Sign-in Screen**: Email input field for login

### Data Model:
```typescript
interface User {
  uid: string;
  email: string;           // Required, unique
  phoneNumber: string;     // Required, unique, E.164 format
  firstName: string;
  lastName: string;
  displayName: string;
  // ... other fields
}
```

---

## 🎯 Desired State

### New Authentication Flow:
- **Primary**: Phone Number + Password
- **Secondary**: Email (still required for account, but not primary login)
- **Social Auth**: Google, Apple (still available)
- **Sign-in Screen**: Phone number input field for login

### Why This Makes Sense:
1. ✅ Mobile-first UX (phone number is more natural on mobile)
2. ✅ Matches WhatsApp, Telegram, Signal patterns
3. ✅ Phone already required and unique in our system
4. ✅ Email can be secondary/backup method
5. ✅ Better for international users

---

## 🔧 Required Changes

### 1. Update authService.ts

**New Function**: `signInWithPhone`
```typescript
export const signInWithPhone = async (
  phoneNumber: string, 
  password: string
): Promise<FirebaseUser> => {
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  
  // Query users collection by phone number
  const q = query(
    collection(db, 'users'), 
    where('phoneNumber', '==', normalizedPhone)
  );
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    throw new Error('No account found with this phone number');
  }
  
  const userData = snapshot.docs[0].data() as User;
  const email = userData.email;
  
  // Sign in with email + password (Firebase Auth still uses email)
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  await setDoc(doc(db, 'users', userCredential.user.uid), { 
    online: true, 
    lastSeen: new Date() 
  }, { merge: true });
  
  return userCredential.user;
};
```

**Keep Existing**: `signIn` (email) as fallback method

---

### 2. Update Login Screen (app/auth/login.tsx)

**Changes**:
```typescript
// Change input field
<TextInput
  placeholder="Phone number (+1234567890)"
  value={phone}
  onChangeText={setPhone}
  keyboardType="phone-pad"  // Mobile-optimized keyboard
  autoComplete="tel"
/>

// Add "Sign in with email instead" toggle
<TouchableOpacity onPress={() => setUseEmail(!useEmail)}>
  <Text style={styles.toggleText}>
    {useEmail ? 'Use phone number' : 'Use email instead'}
  </Text>
</TouchableOpacity>

// Update handleLogin
const handleLogin = async () => {
  try {
    if (useEmail) {
      await signIn(emailOrPhone, password);
    } else {
      await signInWithPhone(emailOrPhone, password);
    }
    router.replace('/(tabs)');
  } catch (error: any) {
    Alert.alert('Error', error.message);
  }
};
```

---

### 3. Update Register Screen (app/auth/register.tsx)

**Keep As-Is**:
- Phone number is already required ✅
- Email is already required ✅
- Both are validated for uniqueness ✅

**Optional Enhancement**:
- Make phone number the first field (move above email)
- Add helper text: "Your phone number will be your username"

---

### 4. Update Edit Profile Screen (app/auth/edit-profile.tsx)

**Add Phone Restriction**:
```typescript
<TextInput
  value={phoneNumber}
  editable={false}  // Cannot change phone number
  style={styles.disabledInput}
/>

<Text style={styles.helperText}>
  Phone number cannot be changed. Contact support if needed.
</Text>
```

**Rationale**:
- Phone number is account identifier (like username)
- Changing it could break contact matching
- Prevents abuse (account transfers)
- Standard practice (WhatsApp, Signal don't allow phone changes)

---

### 5. Update Firestore Security Rules

**Add Phone-Based Query Rule**:
```javascript
// In rules_version = '2'
match /users/{userId} {
  allow read: if isAuthenticated();
  
  // Allow querying by phone for login
  allow list: if isAuthenticated() 
    && request.query.limit == 1
    && request.auth != null;
}
```

This allows the phone number lookup during sign-in while maintaining security.

---

## 📱 User Experience Flow

### Registration:
1. User enters **phone number** (first field, emphasized)
2. User enters email (second field, labeled "Email (for account recovery)")
3. User enters password
4. System validates both phone and email uniqueness
5. Account created

### Sign-In (Primary):
1. User enters **phone number**
2. User enters password
3. System looks up email by phone → signs in with email
4. Redirects to app

### Sign-In (Fallback):
1. User taps "Use email instead"
2. User enters email
3. User enters password
4. Standard email sign-in

---

## 🔒 Security Considerations

### ✅ Secure:
- Phone number uniqueness still enforced
- Email uniqueness still enforced
- Password authentication unchanged
- Firebase Auth still manages sessions
- Firestore rules prevent unauthorized queries

### ⚠️ Considerations:
- Phone lookup adds one extra query per sign-in (minimal cost)
- Phone normalization must be consistent
- Account recovery still uses email (Firebase standard)

---

## 🧪 Testing Checklist

After implementation:
- [ ] Register with phone + email + password
- [ ] Sign in with phone + password → Success
- [ ] Sign in with email + password → Success (fallback)
- [ ] Try to sign in with wrong phone → Error
- [ ] Try to sign in with wrong password → Error
- [ ] Try to edit phone number → Disabled
- [ ] Social auth still requires phone prompt
- [ ] Phone normalization works (various formats)

---

## ⏱️ Implementation Time Estimate

| Task | Time |
|------|------|
| Update authService.ts | 30 min |
| Update login.tsx | 30 min |
| Update register.tsx | 15 min |
| Update edit-profile.tsx | 15 min |
| Update security rules | 15 min |
| Testing | 30 min |
| **Total** | **~2.5 hours** |

---

## 🚦 When to Implement

### Option 1: After MVP Complete (Recommended)
- Pros: Don't derail current momentum
- Pros: Can test with users first
- Pros: May discover if email login is actually needed
- Timeline: After Hour 28 testing complete

### Option 2: Before User Testing
- Pros: Better first impression
- Pros: Mobile-first from the start
- Cons: Small scope creep risk
- Timeline: After Hour 24 (before final testing)

### Option 3: Next (Now)
- Pros: Get it done early
- Cons: Delays remaining MVP features
- Timeline: Add 2-3 hours to current schedule

---

## 💡 Recommendation

**Wait until after Phase 4-6 implementation** (Presence, Images, Notifications).

Rationale:
1. Current auth works perfectly ✅
2. No user complaints yet (no users yet!)
3. Remaining MVP features are more critical
4. Can gather feedback on preferred sign-in method
5. Easy to add later (2-3 hours)

---

## 📝 Alternative: Quick Win

If you want phone priority NOW without delaying MVP:

**Phase 1** (15 minutes):
- Update login screen to show "Email or Phone" placeholder
- Update handleLogin to detect format (contains '@' = email, else = phone)
- Add phone lookup if no '@' detected

**Phase 2** (Later):
- Add explicit toggle
- Add phone-first registration
- Restrict phone editing

This gives you phone login immediately with minimal changes!

---

## 🔗 Related Documents

- `services/authService.ts` - Current auth implementation
- `app/auth/login.tsx` - Login screen
- `app/auth/register.tsx` - Registration screen
- `app/auth/edit-profile.tsx` - Profile editing
- `docs/FIRESTORE_SETUP.md` - Security rules

---

**Status**: Documented and ready to implement when needed

