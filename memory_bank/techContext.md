# Tech Context

## Frontend
- React Native 0.81.4, Expo SDK 54 (managed), React 19.1.0, TypeScript 5.9.x
- Navigation: Expo Router
- Animations/Gestures: react‑native‑reanimated, react‑native‑gesture‑handler
- Storage: `expo-sqlite` (sync APIs), AsyncStorage
- Device APIs: Notifications, Contacts, Image Picker/Manipulator, NetInfo

## Backend
- Firebase v12: Auth, Firestore (us‑south1), Storage (us‑central1), Functions, FCM
- Cloud Functions: push notifications, OTP helpers, cleanup tasks, AI features (summarize, extract actions, proactive triggers)
- Firestore rules align with participant‑only access and image upload limits
- **AI Services**: OpenAI API (text-embedding-3-large, GPT-4), Pinecone vector database, enhanced caching

## Patterns & Decisions
- Service layer; offline‑first; queue‑first sends; 300ms convo update debounce; 200ms SQLite batching; lastMessageId guard; presence heartbeat (15s) with ~30s offline.
- Conversation IDs: direct = sorted `uid1_uid2`; group = UUID v4.
- Image uploads: progressive compression; timeout/retry; 10MB limit enforced by rules.
- **AI Patterns**: Error handling wrapper for all AI methods; offline detection via NetInfo; exponential backoff retries; aggressive caching (60min summaries, 30min search, 120min decisions).

## Development setup
- iOS Simulator (iPhone 17 Pro) and Android Emulator (Pixel 9 Pro)
- Firebase Emulator Suite for integration tests
- Commands: `npx expo start`, `npm test`, emulator scripts
- **AI Setup**: `npm run create-pinecone-index`, `npm run embed-messages`, `firebase deploy --only functions`

## Known constraints
- Expo Go limitations: Android push tokens unsupported; Social auth requires dev/prod builds (OAuth redirect/bundle IDs).
- Network variability: use `sendMessageWithTimeout` for retries and queue processing.
- **AI Constraints**: AI features require internet connection; graceful offline handling implemented; OpenAI API rate limits; Pinecone vector database costs.

## References
- Code: `services/firebase.ts`, `store/AuthContext.tsx`, `services/*`, `services/aiService.ts`, `services/aiErrorHandler.ts`
- Docs: `/docs/architecture.md`, testing/deployment guides, `AI_ENHANCEMENTS_SUMMARY.md`


