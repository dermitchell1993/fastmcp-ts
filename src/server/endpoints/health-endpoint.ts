import http from "http";

import { Logger } from "../../types/logger.js";

export interface HealthConfig {
  enabled?: boolean;
  message?: string;
  path?: string;
  status?: number;
}

export interface HealthEndpointConfig {
  healthConfig?: HealthConfig;
  host: string;
  logger: Logger;
}

/**
 * Handles health check endpoint requests
 */
export async function handleHealthEndpoint(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: HealthEndpointConfig,
): Promise<boolean> {
  const { healthConfig = {}, host, logger } = config;

  const enabled =
    healthConfig.enabled === undefined ? true : healthConfig.enabled;

  if (!enabled) {
    return false;
  }

  const path = healthConfig.path ?? "/health";
  const url = new URL(req.url || "", `http://${host}`);

  try {
    if (req.method === "GET" && url.pathname === path) {
      res
        .writeHead(healthConfig.status ?? 200, {
          "Content-Type": "text/plain",
        })
        .end(healthConfig.message ?? "✓ Ok");

      return true;
    }
  } catch (error) {
    logger.error("[FastMCP error] health endpoint error", error);
  }

  return false;
}
