import { z } from "zod";

import { FastMCP, type ServerOptions } from "../src/FastMCP.js";

// Test fixtures and helpers - no test framework dependencies needed

// Shared test fixtures and data generators for FastMCP test suite

export const createTestServer = (
  options: Partial<ServerOptions<any>> = {},
) => {
  return new FastMCP({
    name: "Test Server",
    version: "1.0.0",
    ...options,
  } as ServerOptions<any>);
};

export const createTestTool = (
  overrides?: Partial<Parameters<FastMCP["addTool"]>[0]>,
) => ({
  description: "A test tool",
  execute: async (args: any) => `Processed: ${args?.input || 'default'}`,
  name: "test-tool",
  parameters: z.object({
    input: z.string(),
  }),
  ...overrides,
});

export const createTestResource = (
  overrides?: Partial<Parameters<FastMCP["addResource"]>[0]>,
) => ({
  load: async () => ({ text: "Test resource content" }),
  mimeType: "text/plain",
  name: "Test Resource",
  uri: "test://resource",
  ...overrides,
});

export const createTestPrompt = (
  overrides?: Partial<Parameters<FastMCP["addPrompt"]>[0]>,
) => ({
  arguments: [
    {
      description: "The topic to generate about",
      name: "topic",
      required: true,
    },
  ],
  description: "A test prompt",
  load: async (args: { topic: string }) =>
    `Generate content about: ${args.topic}`,
  name: "test-prompt",
  ...overrides,
});

// Mock authentication function
export const mockAuth = {
  role: "admin" as const,
  userId: "test-user",
};

export const createAuthFunction = () => async () => mockAuth;

// Test data generators
export const generateRandomString = (length: number = 10): string => {
  return Math.random()
    .toString(36)
    .substring(2, length + 2);
};

export const generateRandomNumber = (
  min: number = 0,
  max: number = 100,
): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};
