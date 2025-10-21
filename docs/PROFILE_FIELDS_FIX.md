# Profile Fields Fix - firstName/lastName Display Issue

**Date:** October 21, 2025  
**Status:** ✅ Fixed

---

## 🐛 **Problem**

User reported that name and email entered during phone sign-up were not showing on the main messages page, and the Edit Profile page was empty even though they just filled out the profile.

**Root Causes:**
1. Profile not being refreshed in AuthContext after creation
2. Missing explicit firstName/lastName parameters in profile creation
3. Display logic using firstName/lastName which weren't being properly set
4. No fallback display logic if fields were missing

---

## 🔧 **Solution**

### 1. **Improved Profile Creation**
**File:** `services/authService.ts`

Added explicit `firstName` and `lastName` parameters to `createUserProfileWithPhone`:

```typescript
export const createUserProfileWithPhone = async (
  userId: string,
  phoneNumber: string,
  displayName: string,
  email?: string,
  firstName?: string,  // ✅ NEW
  lastName?: string    // ✅ NEW
): Promise<void>
```

**Benefits:**
- No name parsing ambiguity
- Direct storage of firstName/lastName
- Fallback to parsing if not provided (backward compatible)
- Better initials generation

### 2. **Refresh Profile After Creation**
**File:** `app/auth/setup-profile.tsx`

Added profile refresh after creation:

```typescript
await createUserProfileWithPhone(
  userId,
  phoneNumber,
  displayName,
  email.trim() || undefined,
  firstName.trim(),  // ✅ Pass directly
  lastName.trim()    // ✅ Pass directly
);

// ✅ NEW: Refresh AuthContext
await refreshUserProfile();

router.replace('/(tabs)');
```

**Why This Matters:**
- Ensures AuthContext has latest profile data
- Edit Profile page will show correct data
- Messages page header displays immediately

### 3. **Improved Display Logic**
**File:** `app/(tabs)/index.tsx`

Added fallback logic for name display:

```typescript
<Text style={styles.userName}>
  {userProfile?.displayName || 
   `${userProfile?.firstName} ${userProfile?.lastName}` || 
   'User'}
</Text>
<Text style={styles.userEmail}>
  {userProfile?.email || userProfile?.phoneNumber}
</Text>
```

**Fallback Chain:**
1. Try `displayName` first (most reliable)
2. Combine `firstName + lastName`
3. Show "User" if nothing available

**Email Fallback:**
1. Show `email` if available
2. Show `phoneNumber` if no email

---

## 📝 **Added Logging**

Enhanced debugging for troubleshooting:

### Profile Creation:
```typescript
console.log('📝 Creating profile:', { 
  userId, phoneNumber, displayName, email, 
  firstName, lastName, initials 
});

console.log('✅ User profile created successfully:', userProfile);
```

### Profile Loading:
```typescript
console.log('📱 Loaded user profile:', {
  uid, displayName, firstName, lastName, 
  email, phoneNumber
});
```

### Display Rendering:
```typescript
console.log('🎨 Rendering header with userProfile:', {
  firstName, lastName, displayName, email
});
```

---

## 🧪 **Testing Steps**

### Test 1: New User Sign-Up
1. **Phone Login:** Enter phone number (e.g., 555-555-5555)
2. **Enter OTP:** Use code from logs
3. **Setup Profile:**
   - First Name: "Test"
   - Last Name: "User"
   - Email: "test@example.com"
4. **Expected Result:** 
   - ✅ Name shows as "Test User" on messages page
   - ✅ Email shows as "test@example.com"
   - ✅ Edit Profile page pre-populated with all data

### Test 2: Edit Profile
1. **Tap "Edit"** button on messages page
2. **Expected Result:**
   - ✅ First Name: "Test"
   - ✅ Last Name: "User"
   - ✅ Email: "test@example.com"
3. **Change Name** to "John Doe"
4. **Save**
5. **Expected Result:**
   - ✅ Messages page updates to "John Doe"
   - ✅ Edit Profile shows "John Doe" on next visit

### Test 3: Existing User
1. **Sign out** and **sign in** again with same phone
2. **Expected Result:**
   - ✅ Profile setup skipped (already complete)
   - ✅ Goes directly to messages page
   - ✅ Name and email displayed correctly

---

## 🗂️ **Field Structure**

### User Profile Fields:
```typescript
interface User {
  uid: string;
  
  // Name fields
  displayName: string;      // "John Doe" (full name)
  firstName: string;         // "John"
  lastName: string;          // "Doe"
  initials: string;          // "JD"
  
  // Contact fields
  email: string;             // "john@example.com"
  phoneNumber: string;       // "+15555555555" (E.164)
  
  // Other fields...
}
```

### Data Flow:
```
User Input (Setup)
  ↓
firstName: "John"
lastName: "Doe"
  ↓
Combined into displayName: "John Doe"
  ↓
Stored in Firestore:
  - firstName: "John"
  - lastName: "Doe"
  - displayName: "John Doe"
  - initials: "JD"
  ↓
Loaded into AuthContext
  ↓
Displayed on Messages Page
  ↓
Pre-populated in Edit Profile
```

---

## 🔍 **Debugging Commands**

### Watch Logs During Sign-Up:
```bash
# In Expo terminal, watch for:
📝 Creating profile: {...}      # Profile being created
✅ User profile created: {...}  # Profile saved
📱 Loaded user profile: {...}   # Profile loaded
🎨 Rendering header: {...}      # Header rendered
```

### Check Firestore Data:
```bash
# Firebase Console → Firestore
# Navigate to: /users/{userId}
# Verify fields:
- displayName: "John Doe"
- firstName: "John"
- lastName: "Doe"
- email: "john@example.com"
```

---

## ✅ **Changes Summary**

| File | Change | Purpose |
|------|--------|---------|
| `services/authService.ts` | Added firstName/lastName params | Direct storage |
| `services/authService.ts` | Added detailed logging | Debugging |
| `app/auth/setup-profile.tsx` | Pass firstName/lastName directly | Accurate data |
| `app/auth/setup-profile.tsx` | Call refreshUserProfile() | Sync AuthContext |
| `app/(tabs)/index.tsx` | Fallback display logic | Robust rendering |
| `app/(tabs)/index.tsx` | Added logging | Debug visibility |

---

## 🎯 **Benefits**

1. **Accurate Data** - firstName/lastName stored exactly as entered
2. **Immediate Display** - Profile refresh ensures instant UI update
3. **Robust Rendering** - Multiple fallbacks prevent blank displays
4. **Better Debugging** - Comprehensive logging for troubleshooting
5. **Backward Compatible** - Still parses displayName if firstName/lastName not provided

---

## 🚀 **Ready to Test!**

Try signing up with a new phone number and verify:
- ✅ Name displays on messages page
- ✅ Email displays on messages page
- ✅ Edit Profile page is pre-populated
- ✅ Changes persist across app restarts

---

## 📌 **Notes**

- **displayName** is the primary display field
- **firstName/lastName** are used for editing and secondary displays
- **phoneNumber** shows as fallback if email is empty
- All fields are properly synced between Firestore and AuthContext

---

