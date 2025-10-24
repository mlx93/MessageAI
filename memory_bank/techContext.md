# Tech Context

## Frontend
- React Native 0.81.4, Expo SDK 54 (managed), React 19.1.0, TypeScript 5.9.x
- Navigation: Expo Router
- Animations/Gestures: react‑native‑reanimated, react‑native‑gesture‑handler
- Storage: `expo-sqlite` (sync APIs), AsyncStorage
- Device APIs: Notifications, Contacts, Image Picker/Manipulator, NetInfo

## Backend
- Firebase v12: Auth, Firestore (us‑south1), Storage (us‑central1), Functions, FCM
- Cloud Functions: push notifications, OTP helpers, cleanup tasks
- Firestore rules align with participant‑only access and image upload limits

## Patterns & Decisions
- Service layer; offline‑first; queue‑first sends; 300ms convo update debounce; 200ms SQLite batching; lastMessageId guard; presence heartbeat (15s) with ~30s offline.
- Conversation IDs: direct = sorted `uid1_uid2`; group = UUID v4.
- Image uploads: progressive compression; timeout/retry; 10MB limit enforced by rules.

## Development setup
- iOS Simulator (iPhone 17 Pro) and Android Emulator (Pixel 9 Pro)
- Firebase Emulator Suite for integration tests
- Commands: `npx expo start`, `npm test`, emulator scripts

## Known constraints
- Expo Go limitations: Android push tokens unsupported; Social auth requires dev/prod builds (OAuth redirect/bundle IDs).
- Network variability: use `sendMessageWithTimeout` for retries and queue processing.

## References
- Code: `services/firebase.ts`, `store/AuthContext.tsx`, `services/*`
- Docs: `/docs/architecture.md`, testing/deployment guides


