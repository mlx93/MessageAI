# Decision Extraction - No Results Investigation

## Status: Crashes Fixed ✅, But No Decisions Extracted ❌

We just fixed all `.slice()` null safety issues (see @DECISION_BUG_INVESTIGATION_PROMPT.md ). The extraction now runs without errors, but returns zero decisions.

## The Problem

**User clicks "Analyze Conversations"** → Extraction runs on 4 conversations → No new decisions created → Frontend shows 0 decisions

**Why zero decisions?**
1. **Conversation filtering issue**: All 14 existing decisions are filtered out as "non-user conversation" even though the user is in those conversations
2. **New extractions return nothing**: No Firebase logs showing decisions were created from the 4 conversations analyzed
3. **Old decisions have bad data**: `participants: ["Team members"]`, `messageIds: ["0", "1", "2"]` instead of real names/IDs

## Expected Behavior

Decisions should:
- Appear for ALL participants in a conversation (not just the sender)
- Show who made the decision prominently
- Use real participant first names (from `participantProfiles`)
- Use actual Firestore message IDs (not array indices)

## Key Files

- **Backend**: `/Users/mylessjs/Desktop/MessageAI/functions/src/ai/decisionTracking.ts` (extraction logic)
- **Frontend**: `/Users/mylessjs/Desktop/MessageAI/app/ava/decisions.tsx` (filtering logic at ~useEffect)
- **Service**: `/Users/mylessjs/Desktop/MessageAI/services/aiService.ts` (Decision interface)

## Investigation Focus

1. **Why is conversation filtering too strict?** User has 4 conversations but all 14 decisions filtered out. Check frontend `convIds` filtering logic.
2. **Why no new decisions created?** Check Firebase Console logs for `extractDecisions` - what is the AI returning?
3. **Why do old decisions have generic data?** The AI prompt should include participant names but returned "Team members" instead.

## Quick Diagnostic

Check Firebase Console logs for these patterns:
- `Participant mapping: {...}` - Are real names in the map?
- `Extracted X new decisions` - Is X > 0 for any conversation?
- `No messages in conversation` - Are messages being filtered out incorrectly?

The issue is likely in conversation/participant filtering logic or AI prompt construction.

