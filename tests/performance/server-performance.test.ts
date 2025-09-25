import { describe, expect, it } from "vitest";
import { getRandomPort } from "get-port-please";
import { createTestServer, createTestTool } from "../fixtures.test.js";

describe("Server Performance", () => {
  describe("Server Initialization", () => {
    it("should initialize server quickly", async () => {
      const startTime = Date.now();
      const port = await getRandomPort();
      const server = createTestServer();

      await server.start({
        httpStream: { port },
        transportType: "httpStream",
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000); // Should initialize in less than 1 second

      await server.stop();
    });
  });

  describe("Tool Execution Performance", () => {
    it("should execute tools efficiently", async () => {
      const port = await getRandomPort();
      const server = createTestServer();

      // Add a simple tool
      server.addTool(createTestTool({
        execute: async (args) => {
          // Simulate some work
          await new Promise(resolve => setTimeout(resolve, 10));
          return `Processed: ${args.input}`;
        },
      }));

      await server.start({
        httpStream: { port },
        transportType: "httpStream",
      });

      // Note: For a full performance test, we'd need a client connection
      // This is just testing server-side setup performance

      await server.stop();
    });
  });

  describe("Memory Usage", () => {
    it("should not have excessive memory growth", async () => {
      const port = await getRandomPort();
      const server = createTestServer();

      const initialMemory = process.memoryUsage().heapUsed;

      await server.start({
        httpStream: { port },
        transportType: "httpStream",
      });

      await server.stop();

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Allow some memory increase but not excessive
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
    });
  });

  describe("Concurrent Operations", () => {
    it("should handle multiple server instances", async () => {
      const ports = await Promise.all([
        getRandomPort(),
        getRandomPort(),
        getRandomPort(),
      ]);

      const servers = ports.map(port => createTestServer());

      const startTime = Date.now();

      // Start all servers concurrently
      await Promise.all(
        servers.map((server, index) =>
          server.start({
            httpStream: { port: ports[index] },
            transportType: "httpStream",
          })
        )
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(2000); // Should start 3 servers in less than 2 seconds

      // Stop all servers
      await Promise.all(servers.map(server => server.stop()));
    });
  });
});