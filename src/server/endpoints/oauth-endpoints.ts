import http from "http";
import { Logger } from "../../types/logger.js";

export interface OAuthConfig {
  enabled?: boolean;
  authorizationServer?: Record<string, unknown>;
  protectedResource?: Record<string, unknown>;
}

export interface OAuthEndpointConfig {
  oauthConfig?: OAuthConfig;
  logger: Logger;
  host: string;
}

/**
 * Converts camelCase to snake_case for OAuth endpoint responses
 */
function camelToSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Converts an object with camelCase keys to snake_case keys
 */
function convertObjectToSnakeCase(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = camelToSnakeCase(key);
    result[snakeKey] = value;
  }

  return result;
}

/**
 * Handles OAuth well-known endpoint requests
 */
export async function handleOAuthEndpoints(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: OAuthEndpointConfig
): Promise<boolean> {
  const { oauthConfig, logger, host } = config;

  if (!oauthConfig?.enabled || req.method !== "GET") {
    return false;
  }

  const url = new URL(req.url || "", `http://${host}`);

  try {
    // Handle OAuth authorization server metadata
    if (
      url.pathname === "/.well-known/oauth-authorization-server" &&
      oauthConfig.authorizationServer
    ) {
      const metadata = convertObjectToSnakeCase(
        oauthConfig.authorizationServer,
      );
      res
        .writeHead(200, {
          "Content-Type": "application/json",
        })
        .end(JSON.stringify(metadata));
      return true;
    }

    // Handle OAuth protected resource metadata
    if (
      url.pathname === "/.well-known/oauth-protected-resource" &&
      oauthConfig.protectedResource
    ) {
      const metadata = convertObjectToSnakeCase(
        oauthConfig.protectedResource,
      );
      res
        .writeHead(200, {
          "Content-Type": "application/json",
        })
        .end(JSON.stringify(metadata));
      return true;
    }
  } catch (error) {
    logger.error("[FastMCP error] OAuth endpoint error", error);
  }

  return false;
}
