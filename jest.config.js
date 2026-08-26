module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  testTimeout: 30000,
  maxWorkers: 1,
  modulePathIgnorePatterns: ["<rootDir>/dist/", "<rootDir>/dist-test/"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.jest.json" }],
  },
};
