export type SSEServer = {
  close: () => Promise<void>;
};

// Forward declaration for FastMCPSession - will be resolved when session types are extracted
export type FastMCPSession<T extends FastMCPSessionAuth = FastMCPSessionAuth> = any;

export type FastMCPEvents<T extends FastMCPSessionAuth> = {
  connect: (event: { session: FastMCPSession<T> }) => void;
  disconnect: (event: { session: FastMCPSession<T> }) => void;
};

// Forward declaration for Root - will be resolved when resource types are extracted
export type Root = any;

export type FastMCPSessionEvents = {
  error: (event: { error: Error }) => void;
  ready: () => void;
  rootsChanged: (event: { roots: Root[] }) => void;
};

// Forward declaration for FastMCPSessionAuth - will be resolved when auth types are extracted
export type FastMCPSessionAuth = Record<string, unknown> | undefined;

export type LoggingLevel =
  | "alert"
  | "critical"
  | "debug"
  | "emergency"
  | "error"
  | "info"
  | "notice"
  | "warning";
