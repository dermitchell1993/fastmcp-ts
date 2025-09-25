import { Server } from "@modelcontextprotocol/sdk/server/index.js";

import { Logger } from "../../types/logger.js";

export function setupErrorHandling(server: Server, logger: Logger) {
  server.onerror = (error) => {
    logger.error("[FastMCP error]", error);
  };
}
