import type { IncomingMessage } from "http";

export type Authenticate<T> = (request: IncomingMessage) => Promise<T>;

export type FastMCPSessionAuth = Record<string, unknown> | undefined;
