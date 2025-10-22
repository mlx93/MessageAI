// Jest configuration for INTEGRATION tests
// Uses Firebase Emulators, not mocks

module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|firebase|@firebase/.*)'
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.integration.js'],  // Use integration setup (no Firebase mocks)
  testMatch: ['**/__tests__/**/*.integration.test.(ts|tsx|js)'],  // Only run .integration.test files
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  testEnvironment: 'node',  // Integration tests don't need jsdom
};

