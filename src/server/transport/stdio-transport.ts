import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import http from "http";

import { FastMCPSessionAuth } from "../../types/auth.js";
import { Logger } from "../../types/logger.js";

export interface StdioTransportConfig<T extends FastMCPSessionAuth> {
  authenticate?: (request: http.IncomingMessage) => Promise<T>;
  logger: Logger;
}

export interface StdioTransportResult<T extends FastMCPSessionAuth> {
  auth: T | undefined;
  transport: StdioServerTransport;
}

/**
 * Creates and configures a stdio transport for FastMCP
 */
export async function createStdioTransport<T extends FastMCPSessionAuth>(
  config: StdioTransportConfig<T>,
): Promise<StdioTransportResult<T>> {
  const transport = new StdioServerTransport();

  // For stdio transport, if authenticate function is provided, call it
  // with undefined request (since stdio doesn't have HTTP request context)
  let auth: T | undefined;

  if (config.authenticate) {
    try {
      auth = await config.authenticate(
        undefined as unknown as http.IncomingMessage,
      );
    } catch (error) {
      config.logger.error(
        "[FastMCP error] Authentication failed for stdio transport:",
        error instanceof Error ? error.message : String(error),
      );
      // Continue without auth if authentication fails
    }
  }

  return {
    auth,
    transport,
  };
}
