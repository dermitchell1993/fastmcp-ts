import { beforeAll, vi } from "vitest";

// Global test setup for FastMCP test suite
beforeAll(() => {
  // Mock console methods to reduce noise in tests
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});

  // Set test environment
  process.env.NODE_ENV = "test";
});
