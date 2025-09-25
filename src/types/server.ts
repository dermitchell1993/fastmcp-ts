export type SSEServer = {
  close: () => Promise<void>;
};

// Forward declarations
export type FastMCPSessionAuth = Record<string, unknown> | undefined;

// Forward declaration for FastMCPSession - will be resolved when session types are extracted
// @ts-ignore - T parameter is used in FastMCPEvents below
export type FastMCPSession<T extends FastMCPSessionAuth = FastMCPSessionAuth> = any;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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



export type LoggingLevel =
  | "alert"
  | "critical"
  | "debug"
  | "emergency"
  | "error"
  | "info"
  | "notice"
  | "warning";
