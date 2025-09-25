import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ErrorCode,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

import { FastMCPSessionAuth, Prompt } from "../../types/index.js";

export function setupPromptHandlers<T extends FastMCPSessionAuth>(
  server: Server,
  prompts: Prompt<T>[],
  auth?: T,
) {
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: prompts.map((prompt) => {
        return {
          arguments: prompt.arguments,
          complete: prompt.complete,
          description: prompt.description,
          name: prompt.name,
        };
      }),
    };
  });

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const prompt = prompts.find(
      (prompt) => prompt.name === request.params.name,
    );

    if (!prompt) {
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Unknown prompt: ${request.params.name}`,
      );
    }

    const args = request.params.arguments;

    for (const arg of prompt.arguments ?? []) {
      if (arg.required && !(args && arg.name in args)) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Prompt '${request.params.name}' requires argument '${arg.name}': ${
            arg.description || "No description provided"
          }`,
        );
      }
    }

    let result: Awaited<ReturnType<Prompt<T>["load"]>>;

    try {
      result = await prompt.load(
        args as Record<string, string | undefined>,
        auth,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to load prompt '${request.params.name}': ${errorMessage}`,
      );
    }

    if (typeof result === "string") {
      return {
        description: prompt.description,
        messages: [
          {
            content: { text: result, type: "text" },
            role: "user",
          },
        ],
      };
    } else {
      return {
        description: prompt.description,
        messages: result.messages,
      };
    }
  });
}
