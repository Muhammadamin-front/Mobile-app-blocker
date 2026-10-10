module.exports = {
  preset: '@react-native/jest-preset',
  // Only crawl the JavaScript. The android/ tree holds tens of thousands of build
  // files, and on an iCloud-synced Desktop crawling them can stall for minutes.
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],
};
