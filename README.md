# aiMessage

A real-time messaging app built with React Native, Expo, and Firebase. Features include one-on-one and group chats, offline support, typing indicators, read receipts, and iMessage-style UI.

## ✨ Features

- 📱 **Real-time Messaging** - Instant message delivery with Firestore
- 👥 **Group Chats** - Create groups, add/remove participants inline
- 📴 **Offline Support** - Messages queue automatically and send when reconnected
- ✓✓ **Read Receipts** - iMessage-style read indicators with timestamps
- 💬 **Typing Indicators** - See when others are typing
- 🟢 **Online Status** - Green (active), yellow (background), or offline
- 🔒 **Firebase Auth** - Phone OTP, email/password, and Google Sign-In

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Expo Go](https://expo.dev/client) app installed on your phone
- iOS Simulator (Mac) or Android Emulator (optional)

**No Firebase setup needed** - The app is pre-configured with a test Firebase project. Just install and run!

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/mlx93/MessageAI.git
   cd MessageAI
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npx expo start
   ```

4. **Test on your device**
   
   **Option 1: Physical Device (Recommended)**
   - Open Expo Go app on your phone
   - Scan the QR code shown in terminal
   - App will load automatically

   **Option 2: iOS Simulator (Mac only)**
   - Press `i` in the terminal
   - Simulator will launch automatically

   **Option 3: Android Emulator**
   - Press `a` in the terminal
   - Emulator will launch automatically

## 📱 Testing the App

### Create an Account
1. Launch the app
2. Tap "Create Account"
3. Enter phone number (any format works)
4. Enter OTP code: `123456` (test code)
5. Complete your profile

### Test Messaging Features
1. **Import Contacts** - Tap "Import Contacts" to find other users
2. **Start Chat** - Tap a contact to start messaging
3. **Group Chat** - Use "+" button in Messages tab to create a group
4. **Add Members** - In any chat, tap the search bar to add more participants
5. **Offline Mode** - Enable airplane mode, send messages, disable airplane mode to see them sync

### Test Two Devices
- Register with different phone numbers on two devices
- Make sure both devices import contacts to find each other
- Start messaging to see real-time sync, typing indicators, and read receipts

## 🏗️ Architecture

```
app/           # Expo Router screens (file-based routing)
services/      # Firebase services (auth, messaging, contacts)
components/    # Reusable UI components
store/         # React Context (AuthContext)
types/         # TypeScript definitions
utils/         # Helper functions (phone formatting, message helpers)
functions/     # Firebase Cloud Functions
```

### Key Technologies
- **Frontend**: React Native, Expo SDK 54, TypeScript
- **Backend**: Firebase (Auth, Firestore, Storage, Functions, FCM)
- **Local Storage**: SQLite for caching, AsyncStorage for offline queue
- **Navigation**: Expo Router (file-based)

## 🔧 Configuration

**Ready to test immediately!** The app is pre-configured with a Firebase project (`messageai-mlx93`) - no setup required. All Firebase credentials are included in the codebase.

## 🧪 Testing Credentials

**Test Phone Numbers**: Any number works  
**OTP Code**: `123456`  
**Test Email**: Create any account with real email

## 📚 Documentation

- [MVP Implementation Plan](docs/mvp_implementation_plan.md)
- [Feature List](docs/COMPLETE_FEATURE_LIST.md)
- [Firebase Setup](docs/FIRESTORE_SETUP.md)
- [Testing Guide](docs/TESTING_GUIDE.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - feel free to use this project for learning or building your own messaging app.

## 👨‍💻 Author

Built by [mlx93](https://github.com/mlx93)

---

**Questions?** Open an issue on GitHub or check the [docs/](docs/) folder for detailed guides.

