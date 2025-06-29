module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/setupTests.js'],
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  collectCoverageFrom: [
    'js/**/*.js',
    'apps-script.gs',
    'sw.js',
    '!js/**/*.test.js',
    '!node_modules/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/js/$1'
  },
  testTimeout: 10000,
  globals: {
    'process.env': {
      NODE_ENV: 'test'
    }
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/'
  ],
  verbose: true
}; 