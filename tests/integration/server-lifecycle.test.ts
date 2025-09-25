import { getRandomPort } from "get-port-please";
import { describe, expect, it } from "vitest";

import { createTestServer } from "../fixtures.test.js";

describe("Server Lifecycle", () => {
  describe("HTTP Stream Transport", () => {
    it("should start and stop server successfully", async () => {
      const port = await getRandomPort();
      const server = createTestServer();

      await server.start({
        httpStream: { port },
        transportType: "httpStream",
      });

      expect(server.sessions).toHaveLength(0);

      await server.stop();
    });

    it("should handle multiple start/stop cycles", async () => {
      const port1 = await getRandomPort();
      const port2 = await getRandomPort();
      const server = createTestServer();

      // First cycle
      await server.start({
        httpStream: { port: port1 },
        transportType: "httpStream",
      });
      await server.stop();

      // Second cycle
      await server.start({
        httpStream: { port: port2 },
        transportType: "httpStream",
      });
      await server.stop();
    });

    it("should start server with custom endpoint", async () => {
      const port = await getRandomPort();
      const server = createTestServer();

      await server.start({
        httpStream: {
          endpoint: "/custom-mcp",
          port,
        },
        transportType: "httpStream",
      });

      await server.stop();
    });
  });

  describe("Stdio Transport", () => {
    it("should start server with stdio transport", async () => {
      const server = createTestServer();

      await server.start({ transportType: "stdio" });

      expect(server.sessions).toHaveLength(0);
    });
  });

  describe("Configuration", () => {
    it("should accept health endpoint configuration", async () => {
      const port = await getRandomPort();
      const server = createTestServer({
        health: {
          enabled: true,
          message: "Custom health message",
          path: "/healthz",
        },
      });

      await server.start({
        httpStream: { port },
        transportType: "httpStream",
      });

      await server.stop();
    });

    it("should accept OAuth configuration", async () => {
      const port = await getRandomPort();
      const server = createTestServer({
        oauth: {
          authorizationServer: {
            authorizationEndpoint: "https://auth.example.com/oauth/authorize",
            issuer: "https://auth.example.com",
            responseTypesSupported: ["code"],
            tokenEndpoint: "https://auth.example.com/oauth/token",
          },
          enabled: true,
        },
      });

      await server.start({
        httpStream: { port },
        transportType: "httpStream",
      });

      await server.stop();
    });
  });
});
