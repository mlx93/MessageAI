# Action Items Display Issues - Investigation Prompt

The Action Items feature was recently updated with new visibility logic and backend changes, but now items aren't displaying after successful extraction, and the UI needs styling polish to match the Decisions screen.

## Problem Summary
The Action Items screen (`app/ava/action-items.tsx`) has two issues: (1) The summary banner at the top uses a checkmark emoji format "✅ 2 decisions tracked" which looks unpolished compared to the Decisions screen's clean "📌 2 decisions tracked" style, and (2) after running the "Analyze" function and receiving a success toast "Analyzed 6 conversations. Action items should appear now.", the action items list remains empty even though the extraction completed successfully.

## Investigation Requirements
First, examine the visibility logic in `app/ava/action-items.tsx` lines 50-144 which was recently modified to query user conversations first, then filter action items by conversation IDs. The issue may be with the async timing - the `loadActionItems` function returns a promise that gets unwrapped, and the snapshot listener might not be persisting correctly. Check if the `userConversationIds` array is populated correctly and if the filter `userConversationIds.includes(data.conversationId)` is matching the actual conversation IDs from the database. Also verify that the deployed `extractActions` function (recently updated with resurrection logic) is actually writing items with the correct `status: 'pending'` field, and check Firebase console logs for any errors during extraction. The frontend may be successfully extracting items but the real-time listener isn't picking them up due to the refactored query logic.

## Styling Fix
For the summary banner styling issue, replace the checkmark emoji "✅ {count} pending" in the `ListHeaderComponent` (around line 574) with a cleaner format matching the Decisions screen. Use a simple pin emoji "📌" or remove emojis entirely, and update the styling to match the polished look shown in the Decisions screenshot. The banner should be more minimal and professional, potentially using just text with an icon or removing the summary box altogether in favor of just showing the count in the header title.

