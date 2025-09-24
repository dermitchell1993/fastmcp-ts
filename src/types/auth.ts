export type Authenticate<T> = (request: any) => Promise<T>; // http.IncomingMessage - will be resolved when full imports available

export type FastMCPSessionAuth = Record<string, unknown> | undefined;
