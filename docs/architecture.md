# MVP Architecture Diagrams

## 1. High-Level System Architecture

```mermaid
graph TB
    subgraph "React Native App (Expo)"
        UI[UI Layer<br/>GiftedChat, Screens]
        Store[State Management<br/>AuthContext, Hooks]
        Services[Services Layer<br/>Auth, Message, Contact,<br/>Presence, Image, Notification]
        Local[Local Storage<br/>SQLite + AsyncStorage]
    end
    
    subgraph "Firebase Backend"
        Auth[Firebase Auth<br/>Email, Google, Apple]
        Firestore[Cloud Firestore<br/>Users, Conversations,<br/>Messages, Typing]
        Storage[Cloud Storage<br/>Images]
        Functions[Cloud Functions<br/>1 MVP Function:<br/>sendMessageNotification]
        FCM[Firebase Cloud Messaging<br/>Push Notifications]
    end
    
    subgraph "External Services"
        Contacts[Phone Contacts<br/>Contact Import]
        NetInfo[Network Status<br/>Online/Offline Detection]
    end
    
    UI --> Store
    Store --> Services
    Services --> Local
    Services --> Auth
    Services --> Firestore
    Services --> Storage
    Services --> Functions
    Services --> FCM
    Services --> Contacts
    Services --> NetInfo
    
    Functions --> FCM
    Functions --> Firestore
    
    style UI fill:#e1f5ff
    style Store fill:#fff4e1
    style Services fill:#e8f5e9
    style Local fill:#f3e5f5
    style Auth fill:#ffebee
    style Firestore fill:#ffebee
    style Storage fill:#ffebee
    style Functions fill:#ffebee
    style FCM fill:#ffebee
```

**Note**: This architecture is for the 24-hour MVP checkpoint only. AI features (which would add additional Cloud Functions and services) are post-MVP and not included in this scope.

---

## 2. Message Flow Architecture

```mermaid
sequenceDiagram
    participant U1 as User A (Sender)
    participant UI as Chat UI
    participant MS as Message Service
    participant SQL as SQLite Cache
    participant FS as Firestore
    participant CS as Conversation Service
    participant U2 as User B (Receiver)
    participant CF as Cloud Function
    participant FCM as Push Notification

    Note over U1,FCM: Sending a Message
    U1->>UI: Types and sends message
    UI->>UI: Optimistic UI<br/>(show immediately)
    UI->>MS: sendMessage()
    MS->>SQL: Cache locally
    MS->>FS: Add to messages collection
    FS-->>MS: Message ID returned
    MS->>CS: updateConversationLastMessage()
    
    Note over U1,FCM: Real-Time Delivery
    FS->>U2: onSnapshot listener fires
    U2->>SQL: Cache message
    U2->>U2: Display in chat UI
    U2->>MS: markMessageAsDelivered()
    MS->>FS: Update message status
    
    Note over U1,FCM: Read Receipts
    U2->>MS: markMessagesAsRead()
    MS->>FS: Update readBy array
    FS->>U1: onSnapshot fires
    U1->>U1: Show double blue checkmark
    
    Note over U1,FCM: Push Notification (if B offline)
    FS->>CF: onCreate trigger
    CF->>FS: Check activeConversations
    CF->>FS: Get user FCM token
    CF->>FCM: Send notification
    FCM->>U2: Deliver push notification
```

---

## 3. Offline Sync Mechanism

```mermaid
flowchart TD
    Start([User Sends Message]) --> Check{Network<br/>Available?}
    
    Check -->|Yes| OptUI[Show in UI<br/>Optimistically]
    OptUI --> SendFS[Send to Firestore]
    SendFS --> Cache[Cache in SQLite]
    Cache --> Success[Update Status: 'sent']
    
    Check -->|No| OptUI2[Show in UI<br/>with 'Offline' banner]
    OptUI2 --> Queue[Add to Offline Queue<br/>AsyncStorage]
    Queue --> CacheOff[Cache in SQLite<br/>Status: 'sending']
    
    CacheOff --> Wait[Wait for Network]
    Wait --> NetChange{Network<br/>Reconnects?}
    
    NetChange -->|Yes| Process[Process Offline Queue]
    Process --> Retry[Attempt Send<br/>with Exponential Backoff]
    
    Retry --> Attempt1{Success?}
    Attempt1 -->|Yes| Remove[Remove from Queue]
    Remove --> UpdateSent[Update Status: 'sent']
    UpdateSent --> End([Complete])
    
    Attempt1 -->|No| Wait2[Wait 2 seconds]
    Wait2 --> Attempt2{Retry 2<br/>Success?}
    
    Attempt2 -->|Yes| Remove
    Attempt2 -->|No| Wait4[Wait 4 seconds]
    Wait4 --> Attempt3{Retry 3<br/>Success?}
    
    Attempt3 -->|Yes| Remove
    Attempt3 -->|No| Failed[Mark as 'failed']
    Failed --> ShowRetry[Show Retry Button]
    ShowRetry --> End
    
    Success --> End
    
    style OptUI fill:#c8e6c9
    style OptUI2 fill:#ffccbc
    style Queue fill:#fff9c4
    style Process fill:#b3e5fc
    style Failed fill:#ef9a9a
    style Success fill:#a5d6a7
```

---

## 4. Authentication Flow

```mermaid
flowchart TD
    Start([App Launch]) --> CheckAuth{User<br/>Authenticated?}
    
    CheckAuth -->|Yes| LoadProfile[Load User Profile<br/>from Firestore]
    LoadProfile --> SetOnline[Set User Online<br/>presenceService]
    SetOnline --> RegisterPush[Register Push Token<br/>notificationService]
    RegisterPush --> InitDB[Initialize SQLite]
    InitDB --> MainApp[Navigate to<br/>Main App]
    
    CheckAuth -->|No| ShowLogin[Show Login Screen]
    ShowLogin --> UserChoice{User Action}
    
    UserChoice -->|Email/Password| EmailAuth[authService.signIn]
    UserChoice -->|Google| GoogleAuth[signInWithGoogle]
    UserChoice -->|Apple| AppleAuth[signInWithApple]
    UserChoice -->|Sign Up| RegFlow[Registration Flow]
    
    EmailAuth --> CreateProfile[Check/Create<br/>User Profile]
    GoogleAuth --> PhoneCheck{Has Phone<br/>Number?}
    AppleAuth --> PhoneCheck
    
    PhoneCheck -->|No| PromptPhone[Prompt for<br/>Phone Number]
    PromptPhone --> CreateProfile
    PhoneCheck -->|Yes| CreateProfile
    
    RegFlow --> Validate{Validate Email<br/>& Phone Unique}
    Validate -->|Invalid| ShowError[Show Error]
    ShowError --> ShowLogin
    Validate -->|Valid| CreateUser[createUserWithEmailAndPassword]
    CreateUser --> CreateProfile
    
    CreateProfile --> SetOnline
    
    style CheckAuth fill:#e3f2fd
    style SetOnline fill:#c8e6c9
    style MainApp fill:#a5d6a7
    style ShowError fill:#ffcdd2
    style CreateProfile fill:#fff9c4
```

---

## 5. Real-Time Features Architecture

```mermaid
graph TB
    subgraph "Chat Screen"
        ChatUI[Chat UI Component]
        TypingHook[useTypingIndicator Hook]
        PresenceHook[usePresence Hook]
        MessagesHook[useMessages Hook]
    end
    
    subgraph "Firestore Real-Time Listeners"
        Messages[conversations/{id}/messages<br/>onSnapshot]
        Typing[conversations/{id}/typing/{userId}<br/>onSnapshot]
        Presence[users/{userId}<br/>onSnapshot]
        ActiveConv[activeConversations/{userId}<br/>setDoc on mount/unmount]
    end
    
    subgraph "Presence Service"
        SetOnline[setUserOnline<br/>+ onDisconnect handler]
        SetOffline[setUserOffline]
        Subscribe[subscribeToUserPresence]
    end
    
    subgraph "User Actions"
        SendMsg[Send Message]
        StartType[Start Typing]
        OpenChat[Open Chat]
        CloseChat[Close Chat]
    end
    
    ChatUI --> MessagesHook
    ChatUI --> TypingHook
    ChatUI --> PresenceHook
    
    MessagesHook --> Messages
    Messages --> |New Message| ChatUI
    
    StartType --> TypingHook
    TypingHook --> |Update isTyping: true| Typing
    TypingHook --> |Auto-clear after 500ms| Typing
    Typing --> |Other user typing| ChatUI
    
    PresenceHook --> Subscribe
    Subscribe --> Presence
    Presence --> |Online/Offline status| ChatUI
    
    OpenChat --> ActiveConv
    CloseChat --> ActiveConv
    
    SendMsg --> Messages
    
    style ChatUI fill:#e1f5ff
    style Messages fill:#ffebee
    style Typing fill:#ffebee
    style Presence fill:#ffebee
    style SetOnline fill:#c8e6c9
```

---

## 6. Push Notification Flow

```mermaid
sequenceDiagram
    participant U1 as User A
    participant App1 as App (User A)
    participant FS as Firestore
    participant CF as Cloud Function
    participant FCM as Firebase Cloud Messaging
    participant App2 as App (User B)
    participant U2 as User B (Backgrounded)

    Note over U1,U2: Setup Phase
    App2->>FS: Register FCM token on app start
    App2->>FS: Set activeConversations/{userId}: null
    U2->>U2: Backgrounds app
    
    Note over U1,U2: User A Opens Chat
    U1->>App1: Opens conversation
    App1->>FS: setActiveConversation(userId, conversationId)
    
    Note over U1,U2: Sending Message
    U1->>App1: Sends message
    App1->>FS: Add to messages collection
    
    Note over U1,U2: Cloud Function Trigger
    FS->>CF: onCreate trigger fires
    CF->>FS: Get conversation.participants
    CF->>FS: Check activeConversations for each recipient
    
    alt User B Not in Active Conversation
        CF->>FS: Get User B's FCM token
        CF->>FCM: Send notification
        FCM->>App2: Deliver push notification
        App2->>U2: Show system notification
        U2->>App2: Taps notification
        App2->>App2: Navigate to conversation
    else User B In Active Conversation
        CF->>CF: Skip notification (already viewing)
    end
    
    Note over U1,U2: User A Leaves Chat
    App1->>FS: setActiveConversation(userId, null)
```

---

## 7. Data Model Relationships

```mermaid
erDiagram
    USER ||--o{ CONVERSATION : participates
    USER ||--o{ MESSAGE : sends
    USER ||--o{ CONTACT : has
    USER ||--o{ TYPING_STATUS : "currently typing"
    CONVERSATION ||--o{ MESSAGE : contains
    CONVERSATION ||--o{ TYPING_STATUS : "typing in"
    
    USER {
        string uid PK
        string email UNIQUE
        string phoneNumber UNIQUE
        string firstName
        string lastName
        string displayName
        string photoURL
        string initials
        boolean online
        timestamp lastSeen
        string fcmToken
        object settings
    }
    
    CONVERSATION {
        string id PK
        string type "direct or group"
        array participants "user IDs"
        object lastMessage
        object participantDetails
        timestamp createdAt
        timestamp updatedAt
    }
    
    MESSAGE {
        string id PK
        string conversationId FK
        string text
        string senderId FK
        timestamp timestamp
        string status "sending|sent|delivered|read|failed"
        string type "text|image|system"
        string mediaURL
        string localId
        array readBy
        array deliveredTo
    }
    
    CONTACT {
        string id PK
        string userId FK
        string phoneNumber
        string name
        boolean isAppUser
        string appUserId
        timestamp lastSynced
    }
    
    TYPING_STATUS {
        string userId PK
        string conversationId FK
        boolean isTyping
        string displayName
        timestamp timestamp
    }
```

---

## 8. Service Layer Architecture

```mermaid
graph TB
    subgraph "UI Layer"
        Screens[App Screens]
        Components[Reusable Components]
        Hooks[Custom Hooks]
    end
    
    subgraph "Service Layer"
        AuthS[authService.ts]
        MessageS[messageService.ts]
        ConversationS[conversationService.ts]
        ContactS[contactService.ts]
        PresenceS[presenceService.ts]
        ImageS[imageService.ts]
        NotificationS[notificationService.ts]
        SQLiteS[sqliteService.ts]
        OfflineQ[offlineQueue.ts]
    end
    
    subgraph "Core Infrastructure"
        Firebase[firebase.ts<br/>Auth, Firestore, Storage, Functions]
        NetInfo[Network Info]
        Permissions[Device Permissions]
    end
    
    Screens --> Hooks
    Components --> Hooks
    Hooks --> AuthS
    Hooks --> MessageS
    Hooks --> ConversationS
    Hooks --> ContactS
    Hooks --> PresenceS
    Hooks --> ImageS
    Hooks --> NotificationS
    
    AuthS --> Firebase
    MessageS --> Firebase
    MessageS --> SQLiteS
    MessageS --> OfflineQ
    ConversationS --> Firebase
    ContactS --> Firebase
    ContactS --> Permissions
    PresenceS --> Firebase
    ImageS --> Firebase
    ImageS --> Permissions
    NotificationS --> Firebase
    NotificationS --> Permissions
    
    OfflineQ --> NetInfo
    
    style Screens fill:#e1f5ff
    style Hooks fill:#fff4e1
    style AuthS fill:#e8f5e9
    style MessageS fill:#e8f5e9
    style Firebase fill:#ffebee
```

---

## 9. File Structure Overview

```mermaid
graph TB
    Root[messaging-app-mvp/]
    
    Root --> App[app/]
    Root --> Components[components/]
    Root --> Services[services/]
    Root --> Hooks[hooks/]
    Root --> Store[store/]
    Root --> Utils[utils/]
    Root --> Types[types/]
    Root --> Functions[functions/]
    
    App --> Auth[auth/<br/>login.tsx<br/>register.tsx]
    App --> Tabs[tabs/<br/>index.tsx<br/>contacts.tsx]
    App --> Chat[chat/<br/>[id].tsx<br/>add-participant.tsx]
    
    Services --> Firebase[firebase.ts]
    Services --> AuthService[authService.ts]
    Services --> MessageService[messageService.ts]
    Services --> ConversationService[conversationService.ts]
    Services --> ContactService[contactService.ts]
    Services --> PresenceService[presenceService.ts]
    Services --> ImageService[imageService.ts]
    Services --> NotificationService[notificationService.ts]
    Services --> SQLiteService[sqliteService.ts]
    Services --> OfflineQueue[offlineQueue.ts]
    
    Hooks --> UseTyping[useTypingIndicator.ts]
    Hooks --> UsePresence[usePresence.ts]
    Hooks --> UseMessages[useMessages.ts]
    
    Store --> AuthContext[AuthContext.tsx]
    
    Types --> Index[index.ts<br/>User, Message, Conversation]
    
    Functions --> CloudFunctions[index.js<br/>sendMessageNotification]
    
    style Root fill:#e3f2fd
    style App fill:#e1f5ff
    style Services fill:#e8f5e9
    style Store fill:#fff4e1
    style Functions fill:#ffebee
```

---

## 10. Critical Path: First Message Flow

```mermaid
flowchart LR
    Start([User Opens App]) --> Auth[Authenticate]
    Auth --> ImportContacts[Import Contacts]
    ImportContacts --> Match[Match Against App Users]
    Match --> ShowList[Show Contact List]
    ShowList --> SelectContact[User Selects Contact]
    SelectContact --> CreateConvo[createOrGetConversation]
    CreateConvo --> NavChat[Navigate to Chat Screen]
    NavChat --> LoadMessages[Load Cached Messages<br/>+ Subscribe to Real-Time]
    LoadMessages --> UserTypes[User Types Message]
    UserTypes --> SendTyping[Update Typing Status]
    UserTypes --> SendMsg[User Sends]
    SendMsg --> OptimisticUI[Show Immediately in UI]
    OptimisticUI --> CheckNet{Network Available?}
    CheckNet -->|Yes| SendFirestore[Send to Firestore]
    CheckNet -->|No| QueueOffline[Queue for Later]
    SendFirestore --> UpdateConvo[Update Conversation LastMessage]
    UpdateConvo --> Cache[Cache in SQLite]
    Cache --> Recipient[Recipient's onSnapshot Fires]
    Recipient --> ShowRecipient[Show on Recipient's Device]
    ShowRecipient --> MarkDelivered[Mark as Delivered]
    MarkDelivered --> End([Message Delivered])
    
    style Start fill:#c8e6c9
    style Auth fill:#fff9c4
    style SendMsg fill:#e1f5ff
    style OptimisticUI fill:#a5d6a7
    style End fill:#81c784
```

---

## Usage Instructions

### For Cursor/Claude Code:

1. **Save these diagrams** in your repository as `docs/ARCHITECTURE.md`
2. **Reference in README.md**: Link to architecture docs so AI sees them
3. **When asking Cursor for help**, mention: "See docs/ARCHITECTURE.md for system design"
4. **During code generation**, Cursor will understand how components connect

### For Development:

1. **Onboarding**: Review diagrams before starting each phase
2. **Debugging**: Trace issues through sequence diagrams
3. **Feature Planning**: Use architecture to identify integration points
4. **Code Review**: Verify new code follows architectural patterns

### Viewing in GitHub:

These Mermaid diagrams render automatically in GitHub's Markdown viewer. You can also:
- Use Mermaid Live Editor: https://mermaid.live
- Install Mermaid Preview extension in VS Code/Cursor
- View in GitHub README or wiki pages

---

## Key Architectural Principles

1. **Services Layer Isolation**: All Firebase/external interactions go through services
2. **Offline-First**: SQLite cache + AsyncStorage queue ensures resilience
3. **Real-Time by Default**: Firestore onSnapshot listeners for live updates
4. **Optimistic UI**: Show changes immediately, sync in background
5. **Smart Notifications**: Cloud Functions check active conversations before sending
6. **Type Safety**: TypeScript interfaces define all data structures
7. **Testability**: Services can be mocked, hooks can be tested in isolation
8. **Uniqueness Enforcement**: Email/phone uniqueness via Firestore security rules with index collections
9. **Emulator Support**: Firebase emulators for integration testing without hitting production

---

## MVP Scope Notes

**This architecture document focuses on the 24-hour MVP checkpoint** which includes:
- ✅ Complete messaging infrastructure (all 10 MVP features)
- ✅ Real-time sync with offline support
- ✅ Push notifications via Expo Go
- ✅ 1 Cloud Function for notifications
- ✅ Testing on iOS and Android simulators

**Post-MVP (Beyond 24-Hour Checkpoint):**
- AI features with additional Cloud Functions
- RAG pipelines and LLM integration
- Advanced capabilities (multi-step agents, proactive assistants)
- Production builds (TestFlight, APK)

The messaging foundation is production-ready and can scale to support AI features when needed.

---

## Testing Strategy for MVP

### Integration Testing with Firebase Emulator
```bash
# Start emulators
firebase emulators:start

# Run integration tests
npm test -- --testPathPattern=integration

# Tests connect to:
# - Auth Emulator: localhost:9099
# - Firestore Emulator: localhost:8080
# - Functions Emulator: localhost:5001
```

### Push Notification Testing with Expo Go
- Install Expo Go on iOS Simulator and Android Emulator
- Run `npm start` and scan QR code with Expo Go
- Expo Go supports push notifications in development mode
- No physical devices required for MVP testing
- Background app and send message to receive notification

### End-to-End Testing
All 7 MVP test scenarios can be completed on:
- iOS Simulator + Android Emulator (running Expo Go)
- No physical devices required
- Firebase Emulator for backend testing
- Production Firebase for full integration testing

---

**These diagrams are living documents - update them as your architecture evolves!**