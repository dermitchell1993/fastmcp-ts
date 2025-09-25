import http from "http";

import { Logger } from "../../types/logger.js";

export interface ReadinessEndpointConfig<T extends ReadinessSession> {
  host: string;
  isStateless: boolean;
  logger: Logger;
  sessions: T[];
}

export interface ReadinessResponse {
  mode?: string;
  ready: number;
  status: string;
  total: number;
}

export interface ReadinessSession {
  isReady: boolean;
}

/**
 * Handles readiness check endpoint requests
 */
export async function handleReadinessEndpoint<T extends ReadinessSession>(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: ReadinessEndpointConfig<T>,
): Promise<boolean> {
  const { host, isStateless, logger, sessions } = config;

  const url = new URL(req.url || "", `http://${host}`);

  try {
    if (req.method === "GET" && url.pathname === "/ready") {
      let response: ReadinessResponse;

      if (isStateless) {
        // In stateless mode, we're always ready if the server is running
        response = {
          mode: "stateless",
          ready: 1,
          status: "ready",
          total: 1,
        };
      } else {
        const readySessions = sessions.filter((s) => s.isReady).length;
        const totalSessions = sessions.length;
        const allReady = readySessions === totalSessions && totalSessions > 0;

        response = {
          ready: readySessions,
          status: allReady
            ? "ready"
            : totalSessions === 0
              ? "no_sessions"
              : "initializing",
          total: totalSessions,
        };
      }

      const statusCode = isStateless || response.status === "ready" ? 200 : 503;

      res
        .writeHead(statusCode, {
          "Content-Type": "application/json",
        })
        .end(JSON.stringify(response));

      return true;
    }
  } catch (error) {
    logger.error("[FastMCP error] readiness endpoint error", error);
  }

  return false;
}
