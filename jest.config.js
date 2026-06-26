/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  testEnvironmentOptions: {
    url: 'https://www.youtube.com/shorts/abc123',
  },
};
