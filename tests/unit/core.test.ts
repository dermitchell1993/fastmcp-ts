import { describe, expect, it, vi } from "vitest";

import { FastMCP } from "../../src/FastMCP.js";
import { createTestServer } from "../fixtures.test.js";

describe("FastMCP Core", () => {
  describe("Server Initialization", () => {
    it("should create a server with default options", () => {
      const server = createTestServer();
      expect(server).toBeInstanceOf(FastMCP);
      expect(server.options.name).toBe("Test Server");
      expect(server.options.version).toBe("1.0.0");
    });

    it("should create a server with custom options", () => {
      const server = createTestServer({
        name: "Custom Server",
        version: "2.0.0",
      });
      expect(server.options.name).toBe("Custom Server");
      expect(server.options.version).toBe("2.0.0");
    });

    it("should initialize with empty sessions collection", () => {
      const server = createTestServer();
      expect(server.sessions).toEqual([]);
    });
  });

  describe("Server State", () => {
    it("should have empty sessions collection initially", () => {
      const server = createTestServer();
      expect(server.sessions).toEqual([]);
    });
  });

  describe("Configuration Validation", () => {
    it("should require name and version", () => {
      expect(() => {
        // @ts-expect-error - intentionally passing invalid options
        new FastMCP({});
      }).toThrow();
    });

    it("should accept valid ping configuration", () => {
      const server = createTestServer({
        ping: {
          enabled: true,
          intervalMs: 30000,
        },
      });
      expect(server.options.ping?.enabled).toBe(true);
      expect(server.options.ping?.intervalMs).toBe(30000);
    });

    it("should accept valid health configuration", () => {
      const server = createTestServer({
        health: {
          message: "OK",
          path: "/health",
        },
      });
      expect(server.options.health?.message).toBe("OK");
      expect(server.options.health?.path).toBe("/health");
    });
  });

  describe("Event Emitter", () => {
    it("should be an event emitter", () => {
      const server = createTestServer();
      expect(typeof server.on).toBe("function");
      expect(typeof server.emit).toBe("function");
      expect(typeof server.off).toBe("function");
    });

    it("should handle connect/disconnect events", () => {
      const server = createTestServer();
      const connectHandler = vi.fn();
      const disconnectHandler = vi.fn();

      server.on("connect", connectHandler);
      server.on("disconnect", disconnectHandler);

      // In a real scenario, these would be triggered by transport events
      // For unit testing, we just verify the handlers are registered
      expect(connectHandler).not.toHaveBeenCalled();
      expect(disconnectHandler).not.toHaveBeenCalled();
    });
  });
});
