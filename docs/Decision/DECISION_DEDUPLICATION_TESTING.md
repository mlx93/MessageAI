# Decision Semantic Deduplication - Quick Testing Guide

## How to Test

### 1. Deploy the Function
```bash
./scripts/deploy-decision-deduplication.sh
```

### 2. Create Test Conversations

**Test Case 1: PostgreSQL Duplicates**
Create a conversation with these messages:
```
User A: "What database should we use for analytics?"
User B: "Let's go with PostgreSQL. It has better support for complex queries."
User A: "Agreed, use PostgreSQL for the analytics database."
User B: "Postgres SQL chosen for analytics database then."
```

Expected: 1 decision extracted (semantic duplicates detected)

**Test Case 2: Mobile Charts Duplicates**
Create a conversation with these messages:
```
User A: "The mobile charts are too complex"
User B: "Finalize and simplify mobile charts to display last 7 days"
User A: "Yes, simplify mobile charts to represent 7 days of data"
```

Expected: 1 decision extracted (semantic duplicates detected)

**Test Case 3: Distinct Decisions**
Create a conversation with these messages:
```
User A: "Use PostgreSQL for analytics database"
User B: "Deploy to AWS us-east-1 region"
User A: "Implement Redis caching layer"
```

Expected: 3 decisions extracted (all distinct)

### 3. Extract Decisions

In the app:
1. Go to Ava → Decisions
2. Tap "Extract Decisions" (⚡)
3. Select the test conversation
4. Watch the loading indicator

### 4. Verify Results

Check the app UI:
- Should show correct number of decisions (no duplicates)
- Toast message should say: "Processed X decisions (Y new, Z updated, W duplicates skipped)"

Check Firebase logs:
```bash
firebase functions:log --only extractDecisions --limit 50
```

Look for these log messages:
```
[Deduplication] Fetching existing decisions...
[Deduplication] Found 2 existing decisions
[Deduplication] Generating embeddings for semantic comparison...
[Deduplication] Embeddings generated in 1247ms
[Deduplication] Found semantic duplicate: "Use PostgreSQL..." matches existing "Postgres SQL..." (94.3% similar)
[Deduplication] Existing decision has equal/higher confidence, skipping new one
[Deduplication] Results: 1 to add, 0 to update, 1 duplicates skipped
```

## Expected Performance

| Decisions | Embedding Time | Total Time |
|-----------|---------------|------------|
| 1 new     | ~300-500ms    | ~1s        |
| 3 new     | ~900-1500ms   | ~2s        |
| 5 new     | ~1500-2500ms  | ~3s        |

With existing decisions: Add ~100ms per existing decision for comparison

## Success Criteria

✅ **Pass:** PostgreSQL test → 1 decision stored  
✅ **Pass:** Mobile charts test → 1 decision stored  
✅ **Pass:** Distinct decisions test → 3 decisions stored  
✅ **Pass:** Total time <2s for typical extractions  
✅ **Pass:** Logs show "[Deduplication]" messages  
✅ **Pass:** No crashes or errors  

❌ **Fail:** Duplicate decisions stored  
❌ **Fail:** Distinct decisions merged incorrectly  
❌ **Fail:** Takes >5s for simple extractions  
❌ **Fail:** Crashes or error messages  

## Troubleshooting

### Issue: No "[Deduplication]" logs
**Cause:** Function not deployed or old version running  
**Fix:** Re-run deployment script

### Issue: Duplicates still appearing
**Cause:** Similarity threshold too high (>80%)  
**Fix:** Check similarity scores in logs, adjust threshold if needed

### Issue: Too many merges (false positives)
**Cause:** Similarity threshold too low (<80%)  
**Fix:** Check logs for similarity scores, adjust threshold upward

### Issue: Slow performance (>5s)
**Cause:** Too many existing decisions or API slow  
**Fix:** Check embedding generation time in logs

### Issue: OpenAI API errors
**Cause:** API key not configured or quota exceeded  
**Fix:** Check Firebase secrets, verify OpenAI account

## Rollback

If critical issues arise:
```bash
cd functions
firebase deploy --only functions:extractDecisions --revision <previous-id>
```

Find previous revision ID:
```bash
firebase functions:list
```

## Monitoring

Key metrics to track:
1. **Deduplication rate:** % of duplicates skipped
2. **False positives:** Distinct decisions incorrectly merged (should be 0%)
3. **Performance:** Average time for 3-5 decisions (target <2s)
4. **User feedback:** Any complaints about missing/merged decisions

## Next Steps After Testing

1. ✅ Verify all test cases pass
2. ✅ Check logs for correct deduplication
3. ✅ Measure performance (<2s target)
4. ✅ Test with real conversations
5. ✅ Monitor for 24 hours
6. ✅ Update documentation if issues found
7. ✅ Consider deploying other AI functions with same pattern

---

**Status:** Ready for testing  
**Deployed:** Not yet  
**Tests:** Pending user validation  

