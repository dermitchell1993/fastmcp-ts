import { EventStore } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import http from "http";
import { startHTTPServer } from "mcp-proxy";
import { Logger } from "../../types/logger.js";
import { SSEServer } from "../../types/server.js";
import { FastMCPSessionAuth } from "../../types/auth.js";

export interface HttpTransportConfig<T extends FastMCPSessionAuth, SessionType> {
  authenticate?: (request: http.IncomingMessage) => Promise<T>;
  createSession: (auth: T | undefined) => SessionType;
  enableJsonResponse?: boolean;
  eventStore?: EventStore;
  host: string;
  logger: Logger;
  onClose?: (session: SessionType) => Promise<void>;
  onConnect?: (session: SessionType) => Promise<void>;
  onUnhandledRequest: (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void>;
  port: number;
  stateless?: boolean;
  streamEndpoint: string;
}

/**
 * Creates and configures an HTTP transport for FastMCP
 */
export async function createHttpTransport<T extends FastMCPSessionAuth, SessionType>(
  config: HttpTransportConfig<T, SessionType>
): Promise<SSEServer> {
  const {
    authenticate,
    createSession,
    enableJsonResponse,
    eventStore,
    host,
    logger,
    onClose,
    onConnect,
    onUnhandledRequest,
    port,
    stateless = false,
    streamEndpoint,
  } = config;

  if (stateless) {
    // Stateless mode - create new server instance for each request
    logger.info(
      `[FastMCP info] Starting server in stateless mode on HTTP Stream at http://${host}:${port}${streamEndpoint}`,
    );

    return await startHTTPServer<SessionType>({
      createServer: async (request) => {
        let auth: T | undefined;

        if (authenticate) {
          auth = await authenticate(request);
        }

        // In stateless mode, create a new session for each request
        // without persisting it in the sessions array
        return createSession(auth);
      },
      enableJsonResponse,
      eventStore,
      host,
      // In stateless mode, we don't track sessions
      onClose: async () => {
        // No session tracking in stateless mode
      },
      onConnect: async () => {
        // No persistent session tracking in stateless mode
        logger.debug(
          `[FastMCP debug] Stateless HTTP Stream request handled`,
        );
      },
      onUnhandledRequest: async (req, res) => {
        await onUnhandledRequest(req, res);
      },
      port,
      stateless: true,
      streamEndpoint,
    });
  } else {
    // Regular mode with session management
    const server = await startHTTPServer<SessionType>({
      createServer: async (request) => {
        let auth: T | undefined;

        if (authenticate) {
          auth = await authenticate(request);
        }

        return createSession(auth);
      },
      enableJsonResponse,
      eventStore,
      host,
      onClose: async (session) => {
        if (onClose) {
          await onClose(session);
        }
      },
      onConnect: async (session) => {
        if (onConnect) {
          await onConnect(session);
        }
      },
      onUnhandledRequest: async (req, res) => {
        await onUnhandledRequest(req, res);
      },
      port,
      streamEndpoint,
    });

    logger.info(
      `[FastMCP info] server is running on HTTP Stream at http://${host}:${port}${streamEndpoint}`,
    );

    return server;
  }
}
