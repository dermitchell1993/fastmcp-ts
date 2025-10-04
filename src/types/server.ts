import type { FastMCPSession } from "../session/index.js";
import type { FastMCPSessionAuth } from "./session.js";
import type { Root } from "@modelcontextprotocol/sdk/types.js";

// Re-export types used in other modules
export type { FastMCPSession, Root };

export type FastMCPEvents<T extends FastMCPSessionAuth> = {
  connect: (event: { session: FastMCPSession<T> }) => void;
  disconnect: (event: { session: FastMCPSession<T> }) => void;
};

export type FastMCPSessionEvents = {
  error: (event: { error: Error }) => void;
  ready: () => void;
  rootsChanged: (event: { roots: Root[] }) => void;
};

export type LoggingLevel =
  | "alert"
  | "critical"
  | "debug"
  | "emergency"
  | "error"
  | "info"
  | "notice"
  | "warning";


export type SSEServer = {
  close: () => Promise<void>;
};
