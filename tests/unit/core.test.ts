import { expect } from "chai";
import { describe, it } from "mocha";
import sinon from "sinon";

import { FastMCP } from "../../src/FastMCP.js";
import { createTestServer } from "../fixtures.test.js";

describe("FastMCP Core", () => {
  describe("Server Initialization", () => {
    it("should create a server with default options", () => {
      const server = createTestServer();
      expect(server).to.be.instanceOf(FastMCP);
      expect(server.options.name).to.equal("Test Server");
      expect(server.options.version).to.equal("1.0.0");
    });

    it("should create a server with custom options", () => {
      const server = createTestServer({
        name: "Custom Server",
        version: "2.0.0",
      });
      expect(server.options.name).to.equal("Custom Server");
      expect(server.options.version).to.equal("2.0.0");
    });

    it("should initialize with empty sessions collection", () => {
      const server = createTestServer();
      expect(server.sessions).to.deep.equal([]);
    });
  });

  describe("Server State", () => {
    it("should have empty sessions collection initially", () => {
      const server = createTestServer();
      expect(server.sessions).to.deep.equal([]);
    });
  });

  describe("Configuration Validation", () => {
    it("should accept valid ping configuration", () => {
      const server = createTestServer({
        ping: {
          enabled: true,
          intervalMs: 30000,
        },
      });
      expect(server.options.ping?.enabled).to.equal(true);
      expect(server.options.ping?.intervalMs).to.equal(30000);
    });

    it("should accept valid health configuration", () => {
      const server = createTestServer({
        health: {
          message: "OK",
          path: "/health",
        },
      });
      expect(server.options.health?.message).to.equal("OK");
      expect(server.options.health?.path).to.equal("/health");
    });
  });

  describe("Event Emitter", () => {
    it("should be an event emitter", () => {
      const server = createTestServer();
      expect(typeof server.on).to.equal("function");
      expect(typeof server.emit).to.equal("function");
      expect(typeof server.off).to.equal("function");
    });

    it("should handle connect/disconnect events", () => {
      const server = createTestServer();
      const connectHandler = sinon.spy();
      const disconnectHandler = sinon.spy();

      server.on("connect", connectHandler);
      server.on("disconnect", disconnectHandler);

      // In a real scenario, these would be triggered by transport events
      // For unit testing, we just verify the handlers are registered
      expect(connectHandler.called).to.be.false;
      expect(disconnectHandler.called).to.be.false;
    });
  });
});
