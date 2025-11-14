# Attribution Flow Test Suite

This test suite validates the end-to-end attribution system for tracking donations across Meta Ads, SMS campaigns, and ActBlue transactions.

## Setup

All necessary testing dependencies have been installed:
- `vitest` - Test runner
- `@testing-library/react` - React component testing utilities
- `@testing-library/jest-dom` - Custom matchers for assertions
- `@testing-library/user-event` - User interaction simulation
- `msw` - API mocking

## Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

## Test Coverage

### 1. UTM to Meta Campaign Attribution
- ✅ Links UTM parameters to Meta campaign IDs
- ✅ Attributes donations with matching UTM to correct campaign
- ✅ Calculates campaign revenue from attributed donations
- ✅ Computes ROI for Meta campaigns

### 2. UTM to SMS Campaign Attribution
- ✅ Links UTM parameters to Switchboard campaign IDs
- ✅ Attributes SMS-driven donations correctly
- ✅ Calculates SMS campaign revenue
- ✅ Computes ROI for SMS campaigns

### 3. Refcode to ActBlue Attribution
- ✅ Matches donations to refcodes
- ✅ Calculates total revenue per refcode
- ✅ Supports multi-channel refcodes (Meta + SMS)
- ✅ Handles missing refcodes gracefully

### 4. Multi-touch Attribution Models
- ✅ First-touch attribution (100% to first interaction)
- ✅ Last-touch attribution (100% to last interaction)
- ✅ Linear attribution (equal split across touchpoints)
- ✅ Position-based attribution (40-20-40 model)
- ✅ Time-decay attribution (favor recent interactions)
- ✅ Complete donor journey tracking (Meta → SMS → Donation)

### 5. Data Integrity Checks
- ✅ Unique attribution IDs
- ✅ Valid organization IDs
- ✅ At least one channel ID per attribution
- ✅ Matching refcodes between attribution and transactions

### 6. Revenue Attribution Calculations
- ✅ Total attributed revenue across channels
- ✅ Revenue by channel (Meta vs SMS)
- ✅ Multi-channel attribution for shared refcodes

### 7. Attribution Time Windows
- ✅ Chronological order of touchpoints
- ✅ Same-day conversion handling

### 8. Edge Cases and Error Handling
- ✅ Missing UTM parameters
- ✅ Zero-value donations
- ✅ Negative ROI scenarios
- ✅ Division by zero in ROI calculations

### 9. Performance Metrics
- ✅ Conversion rate calculations
- ✅ Cost per conversion
- ✅ ROAS (Return on Ad Spend)

## Test Data

The test suite uses mock data defined in `src/__tests__/mocks/handlers.ts`:

### Mock Attribution Mappings
- Meta-only attribution (Facebook → Meta campaign)
- SMS-only attribution (Switchboard → SMS campaign)
- Multi-touch attribution (Facebook + SMS → Donation)

### Mock Transactions
- Meta-attributed donation ($50)
- SMS-attributed donation ($100)
- Multi-touch donation ($250)

### Mock Metrics
- Meta ad performance (spend, impressions, clicks, conversions)
- SMS campaign performance (sent, delivered, conversions, cost)
- ROI analytics with all attribution models

## Architecture

```
src/__tests__/
├── setup.ts                    # Test environment setup
├── attribution-flow.test.tsx   # Main test suite
└── mocks/
    ├── server.ts              # MSW server instance
    └── handlers.ts            # API endpoint mocks
```

## Adding New Tests

1. Add mock data to `handlers.ts`
2. Create new test describe block in `attribution-flow.test.tsx`
3. Use the `TestWrapper` component for components that need providers
4. Run tests to verify

## CI/CD Integration

Add to your CI pipeline:

```yaml
- name: Run tests
  run: npm run test:coverage
  
- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/coverage-final.json
```

## Notes

- Tests use MSW to mock Supabase API endpoints
- All database queries are intercepted and return mock data
- Tests are isolated and can run in parallel
- Coverage reporting is configured in `vitest.config.ts`
