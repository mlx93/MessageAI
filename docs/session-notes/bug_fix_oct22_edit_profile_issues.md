# Bug Fix: Edit Profile Issues
**Date:** October 22, 2025  
**Type:** Profile Management  
**Commit:** `5650232`

---

## Overview
Fixed three critical issues with the Edit Profile modal on the Messages tab that prevented users from editing and saving their profile information.

---

## Bug Reports

### 1. Firestore Undefined Error ❌

**Problem:** When trying to save a profile with an empty email field:
```
Error
Function setDoc() called with invalid data. Unsupported field value: undefined 
(found in field email in document users/TjVZPVoEGXGqnvA5744U)
```

**Impact:** 
- Users couldn't save profile if they wanted to leave email empty
- Forced users to enter an email even if they didn't want to
- App crashed when trying to save empty email

**Root Cause:**
```typescript
// Line 187 (before fix):
email: editedEmail.trim() || undefined,
```
When `editedEmail` is empty, `trim()` returns empty string `""`, which is falsy, so it becomes `undefined`. Firestore rejects `undefined` values.

---

### 2. Changes Not Persisting Immediately 🔄

**Problem:** 
- After saving profile changes, user had to close and reopen the app to see updates
- Very confusing UX - looked like save failed
- Success alert appeared but changes weren't visible

**Impact:** Users thought the save failed and kept retrying

**Root Cause:**
- No `refreshUserProfile()` call after save
- Profile data only refreshed on app restart or tab switch
- Modal closed but displayed stale data

---

### 3. UI Inconsistency Between View and Edit Modes 🎨

**Problem:**
- **View mode**: Only showed values (no labels), looked like a contact card
- **Edit mode**: Showed labels above inputs (First name, Last name, Email, Mobile)
- Very different layouts caused confusion about what changed

**User Feedback:**
> "It's confusing to the user that the page form changes so drastically. The read only page should look very similar to the edit page, with the only thing different is the big Save changes button at the bottom of the edit page, instead of sign out on the read only page."

**Impact:** Disorienting UX when switching between modes

---

## Solutions

### 1. ✅ Fixed Firestore Undefined Error

**Solution:** Handle empty email properly by using empty string instead of undefined

```typescript
// Build update object, only include email if it has a value
const updates: any = {
  firstName: editedFirstName.trim(),
  lastName: editedLastName.trim(),
  displayName: `${editedFirstName.trim()} ${editedLastName.trim()}`,
};

// Only include email field if it's not empty (allows saving null/empty email)
if (editedEmail.trim()) {
  updates.email = editedEmail.trim();
} else {
  // Explicitly set to empty string (Firestore accepts this, but not undefined)
  updates.email = '';
}

await updateUserProfile(user.uid, updates);
```

**Why This Works:**
- Firestore accepts empty string `""` but rejects `undefined`
- Explicitly setting email to `''` clears the field
- Users can now remove their email if they want

---

### 2. ✅ Fixed Persistence Issue

**Solution:** Call `refreshUserProfile()` immediately after save

**Before:**
```typescript
await updateUserProfile(user.uid, updates);
setIsEditingProfile(false);
Alert.alert('Success', 'Profile updated successfully');  // Confusing - changes not visible
```

**After:**
```typescript
await updateUserProfile(user.uid, updates);

// Refresh the profile to show updated values immediately
await refreshUserProfile();

// Exit edit mode
setIsEditingProfile(false);
```

**Changes:**
- Added `refreshUserProfile` to destructured `useAuth()` hook
- Call `refreshUserProfile()` after successful save
- Removed confusing success alert (visual feedback is immediate)
- Added error console logging for debugging

**Result:**
- Profile updates appear immediately
- No confusing alert
- Clean UX - just exits edit mode with updated values visible

---

### 3. ✅ Fixed UI Consistency

**Solution:** Made view mode use the same layout as edit mode

**Before (View Mode):**
```tsx
<View style={styles.appleViewFieldsContainer}>
  <TouchableOpacity style={styles.appleViewFieldRow}>
    <Text style={styles.appleViewFieldValue}>{userProfile?.firstName || 'Not set'}</Text>
  </TouchableOpacity>
  <TouchableOpacity style={styles.appleViewFieldRow}>
    <Text style={styles.appleViewFieldValue}>{userProfile?.lastName || 'Not set'}</Text>
  </TouchableOpacity>
  <TouchableOpacity style={styles.appleViewFieldRow}>
    <Text style={styles.appleViewFieldValue}>{userProfile?.email || 'Not set'}</Text>
  </TouchableOpacity>
  <View style={styles.appleViewFieldRow}>
    <Text style={[styles.appleViewFieldValue, styles.appleViewFieldReadOnly]}>
      {userProfile?.phoneNumber ? formatPhoneNumber(userProfile.phoneNumber) : 'Not set'}
    </Text>
  </View>
</View>
```

**After (View Mode):**
```tsx
<View style={styles.appleEditFieldsContainer}>
  {/* First Name */}
  <View style={styles.appleEditFieldGroup}>
    <Text style={styles.appleEditFieldLabel}>First name</Text>
    <View style={[styles.appleEditFieldInput, styles.appleViewFieldAsInput]}>
      <Text style={styles.appleViewFieldText}>
        {userProfile?.firstName || 'Not set'}
      </Text>
    </View>
  </View>

  {/* Last Name */}
  <View style={styles.appleEditFieldGroup}>
    <Text style={styles.appleEditFieldLabel}>Last name</Text>
    <View style={[styles.appleEditFieldInput, styles.appleViewFieldAsInput]}>
      <Text style={styles.appleViewFieldText}>
        {userProfile?.lastName || 'Not set'}
      </Text>
    </View>
  </View>

  {/* Email */}
  <View style={styles.appleEditFieldGroup}>
    <Text style={styles.appleEditFieldLabel}>Email</Text>
    <View style={[styles.appleEditFieldInput, styles.appleViewFieldAsInput]}>
      <Text style={[styles.appleViewFieldText, !userProfile?.email && styles.appleViewFieldPlaceholder]}>
        {userProfile?.email || 'Not set'}
      </Text>
    </View>
  </View>

  {/* Phone (read-only) */}
  <View style={styles.appleEditFieldGroup}>
    <Text style={styles.appleEditFieldLabel}>Mobile</Text>
    <View style={[styles.appleEditFieldInput, styles.appleReadOnlyField]}>
      <Text style={styles.appleReadOnlyFieldText}>
        {userProfile?.phoneNumber ? formatPhoneNumber(userProfile.phoneNumber) : 'Not set'}
      </Text>
    </View>
  </View>
</View>
```

**New Styles Added:**
```typescript
appleViewFieldAsInput: {
  backgroundColor: '#F2F2F7',  // Lighter background to indicate read-only
  justifyContent: 'center',
},
appleViewFieldText: {
  fontSize: 17,
  color: '#000',
},
appleViewFieldPlaceholder: {
  color: '#999',  // Lighter color for "Not set" text
},
```

**Changes:**
- View mode now uses same container structure as edit mode
- Both modes show labels: "First name", "Last name", "Email", "Mobile"
- View mode uses lighter background (#F2F2F7) to indicate read-only
- Edit mode uses white background (#fff) for editable fields
- Only difference is the bottom button:
  - **Edit mode:** Blue "Save Changes" button
  - **View mode:** Red "Sign Out" button

**Result:**
- Consistent layout between modes
- User knows exactly what fields exist
- Clear visual distinction (background color) between editable and read-only
- Less disorienting when switching modes

---

## User Experience Flow

### Before Fixes:
1. User taps name in top-left corner
2. Profile modal opens (view mode) - shows only values, no labels
3. User taps "Edit" button
4. Layout drastically changes - now shows labels above inputs
5. User edits email, clears it to empty
6. User taps "Done" → Firestore error ❌
7. User tries again, enters dummy email just to save
8. Save succeeds → alert shows "Success"
9. User looks at profile → **still shows old values** ❌
10. User confused, tries closing app and reopening
11. Finally sees updated values

### After Fixes:
1. User taps name in top-left corner
2. Profile modal opens (view mode) - shows labels and values (same layout)
3. User taps "Edit" button
4. Layout stays consistent - inputs replace text views
5. User edits email, clears it to empty
6. User taps "Done" → **Saves successfully** ✅
7. **Values update immediately** ✅
8. User exits edit mode → sees updated values right away

---

## Testing Scenarios

### Test 1: Save Empty Email ✅
1. Open profile modal
2. Tap "Edit"
3. Clear email field completely
4. Tap "Done"
5. **Expected:** Saves successfully, no Firestore error
6. **Result:** ✅ Saves with empty email

### Test 2: Immediate Persistence ✅
1. Open profile modal
2. Tap "Edit"
3. Change first name from "William" to "Will"
4. Tap "Done"
5. **Expected:** Immediately see "Will" in view mode
6. **Result:** ✅ Changes appear instantly

### Test 3: UI Consistency ✅
1. Open profile modal (view mode)
2. Note the layout with labels
3. Tap "Edit"
4. **Expected:** Layout stays same, inputs appear
5. **Result:** ✅ Consistent layout with same labels

### Test 4: Required Fields Validation ✅
1. Open profile modal
2. Tap "Edit"
3. Clear first name
4. Tap "Done"
5. **Expected:** Error alert "First and last name are required"
6. **Result:** ✅ Validation works correctly

---

## Files Modified

**File:** `app/(tabs)/index.tsx`

**Changes:**
- Added `refreshUserProfile` to `useAuth()` hook destructuring
- Updated `handleSaveProfile()` to:
  - Validate first and last name
  - Handle empty email with empty string (not undefined)
  - Call `refreshUserProfile()` after save
  - Remove success alert (visual feedback is immediate)
- Updated view mode JSX to match edit mode layout
- Added new styles:
  - `appleViewFieldAsInput` - View container that looks like input
  - `appleViewFieldText` - Text style for view mode
  - `appleViewFieldPlaceholder` - Placeholder style for empty fields

**Lines Changed:** 81 insertions, 34 deletions

---

## Technical Details

### Firestore Field Handling

**What Firestore Accepts:**
- ✅ `email: "user@example.com"` - String value
- ✅ `email: ""` - Empty string
- ✅ `email: null` - Null value (if field is optional)
- ❌ `email: undefined` - **Rejected**

**Our Solution:**
```typescript
if (editedEmail.trim()) {
  updates.email = editedEmail.trim();  // Has value
} else {
  updates.email = '';  // Empty string (accepted by Firestore)
}
```

### React State Management

**Profile Refresh Flow:**
1. User saves changes
2. `updateUserProfile()` writes to Firestore
3. `refreshUserProfile()` reads from Firestore
4. AuthContext updates `userProfile` state
5. Component re-renders with new values
6. User sees updated values immediately

---

## Related Issues Fixed

This fix also improves:
- **Data Consistency:** Empty email properly handled across the app
- **User Trust:** Immediate feedback builds confidence
- **Cognitive Load:** Consistent layouts reduce mental effort
- **Accessibility:** Clear labels help all users understand fields

---

## Verification

✅ Empty email saves without Firestore error  
✅ Profile changes appear immediately after save  
✅ View and edit modes have consistent layouts  
✅ Required fields validation works  
✅ Phone number remains read-only and formatted  
✅ No breaking changes to other profile features  
✅ Zero linter errors

---

**Commit:** `5650232`  
**Files Changed:** `app/(tabs)/index.tsx` (1 file, +81/-34 lines)  
**Impact:** Critical UX improvements for profile management

