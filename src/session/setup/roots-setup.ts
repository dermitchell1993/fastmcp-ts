import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ErrorCode,
  McpError,
  Root,
  RootsListChangedNotificationSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Logger } from "../../types/logger.js";

export function setupRootsHandlers(
  server: Server,
  updateRoots: (newRoots: Root[]) => void,
  rootsConfig?: { listChanged?: boolean },
  logger?: Logger,
  emit?: (event: string, data: any) => void
) {
  if (rootsConfig?.listChanged === false) {
    logger?.debug(
      "[FastMCP debug] roots capability explicitly disabled via config",
    );
    return;
  }

  // Only set up roots notification handling if the server supports it
  if (typeof server.listRoots === "function") {
    server.setNotificationHandler(
      RootsListChangedNotificationSchema,
      () => {
        server
          .listRoots()
          .then((rootsResult) => {
            // Update the roots using the callback
            updateRoots(rootsResult.roots);

            emit?.("rootsChanged", {
              roots: rootsResult.roots,
            });
          })
          .catch((error) => {
            if (
              error instanceof McpError &&
              error.code === ErrorCode.MethodNotFound
            ) {
              logger?.debug(
                "[FastMCP debug] listRoots method not supported by client",
              );
            } else {
              logger?.error(
                `[FastMCP error] received error listing roots.\n\n${
                  error instanceof Error ? error.stack : JSON.stringify(error)
                }`,
              );
            }
          });
      },
    );
  } else {
    logger?.debug(
      "[FastMCP debug] roots capability not available, not setting up notification handler",
    );
  }
}
