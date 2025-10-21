# MessageAI Testing Suite

Comprehensive test coverage for MessageAI MVP with focus on the 10 critical requirements.

## 🎯 Quick Start

```bash
# 1. Start Firebase Emulators (Terminal 1)
npm run test:emulators

# 2. Run Tests (Terminal 2)
npm test
```

## 📊 Test Coverage

- **153+ tests** implemented
- **5 integration test suites** covering critical MVP features
- **60-65% coverage** of core services
- **Target:** 70%+ coverage

## 🧪 Test Suites

### Integration Tests (Firebase Emulator Required)

| Suite | Tests | Coverage |
|-------|-------|----------|
| **authService.integration.test.ts** | 38 | Authentication (phone OTP, email/password) |
| **messageService.integration.test.ts** | 30 | Real-time messaging, read receipts |
| **conversationService.integration.test.ts** | 25 | Direct chat, group chat (3+ users) |
| **offlineQueue.integration.test.ts** | 28 | Offline resilience, exponential backoff |
| **sqliteService.integration.test.ts** | 32 | Message persistence, force quit recovery |

### Unit Tests (No Firebase Required)

| Suite | Tests | Coverage |
|-------|-------|----------|
| **messageHelpers.test.ts** | 60+ | Timestamp formatting, utilities |
| **phoneFormat.test.ts** | 10 | Phone number formatting (E.164) |
| **authService.test.ts** | 6 | Phone normalization |

## 🔥 MVP Requirements Tested

✅ **1. One-on-one chat** - conversationService  
✅ **2. Real-time message delivery (2+ users)** - messageService  
✅ **3. Message persistence (survives restarts)** - sqliteService  
✅ **4. Optimistic UI updates** - messageService  
✅ **5. Message timestamps** - messageHelpers  
✅ **6. User authentication** - authService  
✅ **7. Group chat (3+ users)** - conversationService  
✅ **8. Message read receipts** - messageService  
⏳ **9. Online/offline status** - presenceService (placeholder)  
⏳ **10. Push notifications** - notificationService (deferred)

## 📝 Test Commands

```bash
# Run all tests
npm test

# Unit tests only (no emulator needed)
npm run test:unit

# Integration tests only (emulator required)
npm run test:integration

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Kill emulators
npm run test:emulators:kill
```

## 📚 Documentation

- **Quick Start:** `docs/TESTING_QUICK_START.md` (5-minute setup)
- **Full Documentation:** `docs/TESTING_COMPLETE.md` (comprehensive guide)
- **Testing Strategy:** `.cursor/rules/testing-agent.mdc` (detailed agent guide)

## 🚀 Next Steps

1. **Complete remaining tests** (contact service, presence service)
2. **E2E Maestro tests** (7 critical scenarios)
3. **Security rules tests** (email/phone uniqueness)
4. **Increase coverage to 70%+**

## 🐛 Troubleshooting

**Emulator not running?**
```bash
npm run test:emulators
```

**Port conflicts?**
```bash
npm run test:emulators:kill
npm run test:emulators
```

---

For detailed setup and troubleshooting, see `docs/TESTING_QUICK_START.md`.

