# AI Features Temporarily Disabled

## Status
**AI features have been temporarily disabled** while Firestore indexes are building. This prevents the app from crashing with index errors.

## What's Disabled
All AI-related features in the chat screen have been commented out with clear markers:

### 1. Imports (Lines 29-37)
```typescript
// TEMPORARILY DISABLED: AI components while indexes build
// import PriorityBadge from '../../components/ai/PriorityBadge';
// import ActionItemsBanner from '../../components/ai/ActionItemsBanner';
// import ProactiveSuggestionCard from '../../components/ai/ProactiveSuggestionCard';
// import ThreadSummaryModal from '../../components/ai/ThreadSummaryModal';
// import aiService, { ProactiveSuggestion } from '../../services/aiService';
```

### 2. State Variables (Lines 77-80)
```typescript
// TEMPORARILY DISABLED: AI-related state while indexes build
// const [summaryModalVisible, setSummaryModalVisible] = useState(false);
// const [proactiveSuggestions, setProactiveSuggestions] = useState<ProactiveSuggestion[]>([]);
// const [loadingSuggestion, setLoadingSuggestion] = useState<string | null>(null);
```

### 3. AI Subscription (Lines 736-763)
```typescript
// TEMPORARILY DISABLED: Subscribe to proactive AI suggestions
// TODO: Re-enable after Firestore indexes finish building (5-15 minutes)
```

### 4. Handler Functions (Lines 1059-1092)
```typescript
// TEMPORARILY DISABLED: AI Feature Handlers while indexes build
// const handleViewAllActionItems = () => { ... };
// const handleAcceptSuggestion = async (suggestionId: string, action?: string) => { ... };
// const handleDismissSuggestion = async (suggestionId: string) => { ... };
```

### 5. UI Components
- **Summarize Button** (✨) in header (Lines 592-606)
- **Priority Badges** (🔴🟡) on messages (Lines 1673-1679, 1683-1691)
- **Proactive Suggestion Cards** (Lines 1868-1877)
- **Action Items Banner** (Lines 1879-1883)
- **Thread Summary Modal** (Lines 2078-2083)

## Index Build Time
With a few hundred rows of data, the indexes should build in **5-15 minutes**.

## How to Re-enable
Once indexes are built (check Firebase Console), simply:

1. **Uncomment all lines** marked with `// TEMPORARILY DISABLED:`
2. **Remove the comment markers** from the disabled code
3. **Test the AI features** to ensure they work

## What Still Works
- ✅ All core messaging functionality
- ✅ Contact management
- ✅ Presence and typing indicators
- ✅ Image sharing
- ✅ Offline queue
- ✅ Push notifications
- ✅ All non-AI features

## Monitoring Index Status
Check index build progress at:
- **Firebase Console**: https://console.firebase.google.com/project/messageai-mlx93/firestore/indexes
- **Command Line**: `firebase firestore:indexes`

## Expected Timeline
- **Small dataset** (< 1000 docs): 5-15 minutes
- **Current status**: Indexes are building, app works without AI features
- **Next step**: Re-enable AI features once indexes are ready

## Notes
- The app will work perfectly without AI features
- No functionality loss for core messaging
- AI features will be available once indexes finish building
- This is a one-time process per index deployment
