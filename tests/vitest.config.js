import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Use the global setup file
    setupFiles: ["./setup.ts"],
    // Configure test environment
    environment: "node",
    // Enable globals for describe, it, expect
    globals: true,
    // Exclude node_modules to prevent running dependency tests
    exclude: ["**/node_modules/**"],
    // Pool options for better performance
    poolOptions: {
      forks: {
        execArgv: ["--experimental-eventsource"],
      },
    },
    // Coverage configuration
    coverage: {
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "dist/",
        "src/**/*.d.ts",
        "src/**/*.test.ts",
        "**/*.config.js",
      ],
    },
    // Test timeout
    testTimeout: 30000,
  },
});
