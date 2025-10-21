# Testing Guide for MessageAI MVP

## ✅ Testing Infrastructure Status

**Unit Testing**: Working  
**Test Framework**: Jest 29.7.0 (matches Expo SDK 54)  
**Coverage**: 6/6 tests passing

---

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test File
```bash
npm test -- authService.test.ts
```

### Run with Coverage
```bash
npm test -- --coverage
```

### Watch Mode (Auto-rerun on changes)
```bash
npm test -- --watch
```

---

## Test Structure

```
services/
  __tests__/
    authService.test.ts       ✅ 6 tests passing
    contactService.test.ts    (To be created)
    messageService.test.ts    (To be created)
```

---

## Current Test Coverage

### ✅ Auth Service Tests (6 passing)
- Phone number normalization (E.164 format)
- Formatted phone numbers ((555) 123-4567)
- Various input formats
- Edge cases

**Example:**
```typescript
describe('normalizePhoneNumber', () => {
  it('should preserve E.164 format numbers', () => {
    expect(normalizePhoneNumber('+15551234567')).toBe('+15551234567');
  });
});
```

---

## Writing New Tests

### 1. Create Test File
```bash
touch services/__tests__/myService.test.ts
```

### 2. Basic Test Template
```typescript
describe('MyService', () => {
  describe('myFunction', () => {
    it('should do something', () => {
      expect(true).toBe(true);
    });
  });
});
```

### 3. Testing Async Functions
```typescript
it('should handle async operations', async () => {
  const result = await myAsyncFunction();
  expect(result).toBeDefined();
});
```

---

## Testing Best Practices

### DO:
✅ Test pure functions (no dependencies)  
✅ Test business logic  
✅ Test edge cases  
✅ Use descriptive test names  
✅ Keep tests isolated (no shared state)

### DON'T:
❌ Test Firebase directly (use mocks or emulator)  
❌ Test UI components without proper setup  
❌ Test third-party libraries  
❌ Create tests with external dependencies

---

## Mocking Strategy

Firebase services are mocked in `jest.setup.js`:
```javascript
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  // ... other mocks
}));
```

---

## Integration Testing (Future)

For full integration tests with Firebase:
1. Use Firebase Emulator Suite
2. See Task 1.6b in mvp_task_list_part1.md
3. Run: `firebase emulators:start`

---

## Manual Testing Checklist

### Authentication Flow
- [ ] Register new user
- [ ] Email validation
- [ ] Phone number normalization
- [ ] Login with credentials
- [ ] Sign out
- [ ] Duplicate email prevention

### Navigation
- [ ] Login → Tabs screen
- [ ] Register → Tabs screen  
- [ ] Sign out → Login screen

---

## Troubleshooting

### Issue: Tests fail with "Cannot find module"
**Solution**: Clear cache and reinstall
```bash
npm test -- --clearCache
npm install
```

### Issue: Expo module errors
**Solution**: Make sure using Jest 29.7.0
```bash
npm list jest
```

### Issue: Watchman warnings
**Solution**: Reset watchman
```bash
watchman watch-del '/Users/mylessjs/Desktop/MessageAI'
watchman watch-project '/Users/mylessjs/Desktop/MessageAI'
```

---

## Next Steps

### Immediate (Hour 3-4)
- Add contact service tests
- Test phone matching logic

### Hour 6-9
- Add message service tests
- Test offline queue logic

### Hour 12-15
- Add presence service tests
- Test typing indicator debouncing

---

## CI/CD Integration (Future)

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm test -- --coverage
```

---

**Testing Status**: ✅ Infrastructure Ready  
**Next**: Write tests for contact/message services as we build them

