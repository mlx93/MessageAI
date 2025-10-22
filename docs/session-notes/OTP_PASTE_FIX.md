# OTP Paste Functionality Fix

**Issue:** Pasting 6-digit code doesn't work when `maxLength={1}` on iOS

**Solution:** Changed `maxLength` from 1 to 6 to allow paste, handler detects and processes it

---

## 🔧 **How It Works Now**

### When You Paste:
1. Copy 6-digit code (e.g., "123456")
2. Long-press **any** of the 6 input boxes
3. Tap "Paste"
4. **Magic happens:**
   - Handler detects it's 6 digits
   - Splits into array: ['1','2','3','4','5','6']
   - Fills all boxes
   - Auto-verifies immediately

### When You Type:
- Still works normally
- Type one digit at a time
- Auto-advances to next box
- Auto-verifies when 6th digit entered

---

## 📝 **Code Changes**

**Before:**
```jsx
<TextInput
  maxLength={1}  // ❌ Prevents paste
  ...
/>
```

**After:**
```jsx
<TextInput
  maxLength={6}  // ✅ Allows paste
  contextMenuHidden={false}  // ✅ Shows paste menu
  ...
/>
```

**Handler Logic:**
```typescript
const handleCodeChange = (text: string, index: number) => {
  // Handle paste of full 6-digit code
  if (text.length === 6 && /^\d{6}$/.test(text)) {
    const newCode = text.split('');
    setCode(newCode);
    handleVerify(text); // Auto-verify
    return;
  }

  // Handle single digit (typing)
  // ... existing logic
};
```

---

## 🧪 **Test It:**

1. Get your OTP code: `./get-otp-code.sh`
2. Copy the 6-digit number
3. In app, long-press **first box**
4. Tap "Paste"
5. ✨ All boxes fill + auto-verify!

---

## ✅ **Benefits:**

- **Fast Entry:** Paste instead of typing 6 digits
- **Error-Free:** No typos from manual entry
- **iOS Native:** Uses iOS paste menu
- **Still Works Manually:** Can still type if you prefer

---

