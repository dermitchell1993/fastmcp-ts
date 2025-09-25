import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { setTimeout as delay } from "timers/promises";
import { toJsonSchema } from "xsschema";
import { z } from "zod";

import {
  AudioContent,
  Content,
  ContentResult,
  FastMCPSessionAuth,
  ImageContent,
  Progress,
  ResourceContent,
  ResourceLink,
  SerializableValue,
  TextContent,
  Tool,
} from "../../types/index.js";
import { Logger } from "../../types/logger.js";

// Error classes for tool handlers
export class UnexpectedStateError extends Error {
  public extras?: any;

  public constructor(message: string, extras?: any) {
    super(message);
    this.name = new.target.name;
    this.extras = extras;
  }
}

export class UserError extends UnexpectedStateError {}

// Content validation schemas
const TextContentZodSchema = z
  .object({
    text: z.string(),
    type: z.literal("text"),
  })
  .strict() satisfies z.ZodType<TextContent>;

const ImageContentZodSchema = z
  .object({
    data: z.string(),
    mimeType: z.string(),
    type: z.literal("image"),
  })
  .strict() satisfies z.ZodType<ImageContent>;

const AudioContentZodSchema = z
  .object({
    data: z.string(),
    mimeType: z.string(),
    type: z.literal("audio"),
  })
  .strict() satisfies z.ZodType<AudioContent>;

const ResourceContentZodSchema = z
  .object({
    resource: z.object({
      mimeType: z.string().optional(),
      text: z.string().optional(),
      uri: z.string(),
    }),
    type: z.literal("resource"),
  })
  .strict() satisfies z.ZodType<ResourceContent>;

const ResourceLinkZodSchema = z
  .object({
    resource: z.object({
      uri: z.string(),
    }),
    type: z.literal("resource_link"),
  })
  .strict() satisfies z.ZodType<ResourceLink>;

const ContentZodSchema = z.discriminatedUnion("type", [
  TextContentZodSchema,
  ImageContentZodSchema,
  AudioContentZodSchema,
  ResourceContentZodSchema,
  ResourceLinkZodSchema,
]) satisfies z.ZodType<Content>;

const ContentResultZodSchema = z
  .object({
    content: ContentZodSchema.array(),
    isError: z.boolean().optional(),
  })
  .strict() satisfies z.ZodType<ContentResult>;

export function setupToolHandlers<T extends FastMCPSessionAuth>(
  server: Server,
  tools: Tool<T>[],
  logger: Logger,
  utils?: {
    formatInvalidParamsErrorMessage?: (issues: any[]) => string;
    streamContent?: (
      content: Content,
      context: any,
      progress?: Progress,
    ) => Promise<ContentResult>;
  },
  auth?: T,
  needsEventLoopFlush: boolean = false,
) {
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: await Promise.all(
        tools.map(async (tool) => {
          return {
            annotations: tool.annotations,
            description: tool.description,
            inputSchema: tool.parameters
              ? await toJsonSchema(tool.parameters)
              : {
                  additionalProperties: false,
                  properties: {},
                  type: "object",
                }, // More complete schema for Cursor compatibility
            name: tool.name,
          };
        }),
      ),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools.find((tool) => tool.name === request.params.name);

    if (!tool) {
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Unknown tool: ${request.params.name}`,
      );
    }

    let args: unknown = undefined;

    if (tool.parameters) {
      const parsed = await tool.parameters["~standard"].validate(
        request.params.arguments,
      );

      if (parsed.issues) {
        const friendlyErrors = utils?.formatInvalidParamsErrorMessage
          ? utils.formatInvalidParamsErrorMessage(parsed.issues)
          : parsed.issues
              .map((issue: any) => {
                const path = issue.path?.join(".") || "root";
                return `${path}: ${issue.message}`;
              })
              .join(", ");

        throw new McpError(
          ErrorCode.InvalidParams,
          `Tool '${request.params.name}' parameter validation failed: ${friendlyErrors}. Please check the parameter types and values according to the tool's schema.`,
        );
      }

      args = parsed.value;
    }

    const progressToken = request.params?._meta?.progressToken;

    let result: ContentResult;

    try {
      const reportProgress = async (progress: Progress) => {
        try {
          await server.notification({
            method: "notifications/progress",
            params: {
              ...progress,
              progressToken,
            },
          });

          if (needsEventLoopFlush) {
            await new Promise((resolve) => setImmediate(resolve));
          }
        } catch (progressError) {
          logger.warn(
            `[FastMCP warning] Failed to report progress for tool '${request.params.name}':`,
            progressError instanceof Error
              ? progressError.message
              : String(progressError),
          );
        }
      };

      const log = {
        debug: (message: string, context?: SerializableValue) => {
          server.sendLoggingMessage({
            data: {
              context,
              message,
            },
            level: "debug",
          });
        },
        error: (message: string, context?: SerializableValue) => {
          server.sendLoggingMessage({
            data: {
              context,
              message,
            },
            level: "error",
          });
        },
        info: (message: string, context?: SerializableValue) => {
          server.sendLoggingMessage({
            data: {
              context,
              message,
            },
            level: "info",
          });
        },
        warn: (message: string, context?: SerializableValue) => {
          server.sendLoggingMessage({
            data: {
              context,
              message,
            },
            level: "warning",
          });
        },
      };

      // Create a promise for tool execution
      // Streams partial results while a tool is still executing
      // Enables progressive rendering and real-time feedback
      const streamContent = async (content: Content | Content[]) => {
        const contentArray = Array.isArray(content) ? content : [content];

        try {
          await server.notification({
            method: "notifications/tool/streamContent",
            params: {
              content: contentArray,
              toolName: request.params.name,
            },
          });

          if (needsEventLoopFlush) {
            await new Promise((resolve) => setImmediate(resolve));
          }
        } catch (streamError) {
          logger.warn(
            `[FastMCP warning] Failed to stream content for tool '${request.params.name}':`,
            streamError instanceof Error
              ? streamError.message
              : String(streamError),
          );
        }
      };

      const executeToolPromise = tool.execute(args, {
        client: {
          version: server.getClientVersion(),
        },
        log,
        reportProgress,
        session: auth,
        streamContent,
      });

      // Handle timeout if specified
      const maybeStringResult = (await (tool.timeoutMs
        ? Promise.race([
            executeToolPromise,
            new Promise<never>((_, reject) => {
              const timeoutId = setTimeout(() => {
                reject(
                  new UserError(
                    `Tool '${request.params.name}' timed out after ${tool.timeoutMs}ms. Consider increasing timeoutMs or optimizing the tool implementation.`,
                  ),
                );
              }, tool.timeoutMs);

              // If promise resolves first
              executeToolPromise.finally(() => clearTimeout(timeoutId));
            }),
          ])
        : executeToolPromise)) as
        | AudioContent
        | ContentResult
        | ImageContent
        | null
        | ResourceContent
        | ResourceLink
        | string
        | TextContent
        | undefined;

      // Without this test, we are running into situations where the last progress update is not reported.
      // See the 'reports multiple progress updates without buffering' test in FastMCP.test.ts before refactoring.
      await delay(1);

      if (maybeStringResult === undefined || maybeStringResult === null) {
        result = ContentResultZodSchema.parse({
          content: [],
        });
      } else if (typeof maybeStringResult === "string") {
        result = ContentResultZodSchema.parse({
          content: [{ text: maybeStringResult, type: "text" }],
        });
      } else if ("type" in maybeStringResult) {
        result = ContentResultZodSchema.parse({
          content: [maybeStringResult],
        });
      } else {
        result = ContentResultZodSchema.parse(maybeStringResult);
      }
    } catch (error) {
      if (error instanceof UserError) {
        return {
          content: [{ text: error.message, type: "text" }],
          isError: true,
          ...(error.extras ? { structuredContent: error.extras } : {}),
        };
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            text: `Tool '${request.params.name}' execution failed: ${errorMessage}`,
            type: "text",
          },
        ],
        isError: true,
      };
    }

    return result;
  });
}
