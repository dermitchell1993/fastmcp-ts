import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SetLevelRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { LoggingLevel } from "../../types/index.js";

export function setupLoggingHandlers(
  server: Server,
  currentLevel: LoggingLevel,
  setLevel: (level: LoggingLevel) => void
) {
  server.setRequestHandler(SetLevelRequestSchema, (request) => {
    setLevel(request.params.level);
    return {};
  });
}
