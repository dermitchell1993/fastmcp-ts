import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { EventStore } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { RequestOptions } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  CallToolRequestSchema,
  ClientCapabilities,
  CompleteRequestSchema,
  CreateMessageRequestSchema,
  ErrorCode,
  GetPromptRequestSchema,
  GetPromptResult,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListResourcesResult,
  ListResourceTemplatesRequestSchema,
  ListResourceTemplatesResult,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
  RootsListChangedNotificationSchema,
  ServerCapabilities,
  SetLevelRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { StandardSchemaV1 } from "@standard-schema/spec";
import { EventEmitter } from "events";
// Additional imports from session integration
import { readFile } from "fs/promises";
import Fuse from "fuse.js";
import http from "http";
import { startHTTPServer } from "mcp-proxy";
import { StrictEventEmitter } from "strict-event-emitter-types";
import { setTimeout as delay } from "timers/promises";
import { fetch } from "undici";
import parseURITemplate from "uri-templates";
import { toJsonSchema } from "xsschema";
import { z } from "zod";

import {
  Extra,
  Extras,
  FastMCPError,
  UnexpectedStateError,
  UserError,
} from "./errors/index.js";
import {
  handleHealthEndpoint,
  handleOAuthEndpoints,
  handleReadinessEndpoint,
  type HealthEndpointConfig,
  type OAuthEndpointConfig,
  type ReadinessEndpointConfig,
} from "./server/endpoints/index.js";
import {
  createHttpTransport,
  createStdioTransport,
} from "./server/transport/index.js";
// Modular imports from extracted foundation
import { FastMCPSession } from "./session/index.js";
import {
  audioContent,
  AudioContent,
  imageContent,
  ImageContent,
  TextContent,
} from "./utils/content-helpers.js";

// Parameter mapping functions to adapt between FastMCP and FastMCPSession interfaces
function mapPingConfig(ping?: {
  enabled?: boolean;
  intervalMs?: number;
  logLevel?: LoggingLevel;
}):
  | {
      enabled: boolean;
      interval: number;
      logLevel: "debug" | "none" | "warning";
    }
  | undefined {
  if (!ping) return undefined;

  return {
    enabled: ping.enabled ?? true,
    interval: ping.intervalMs ?? 5000,
    logLevel: (ping.logLevel as "debug" | "none" | "warning") ?? "debug",
  };
}

function mapRootsConfig(roots?: { enabled?: boolean }):
  | {
      listChanged?: boolean;
    }
  | undefined {
  if (!roots) return undefined;

  return {
    listChanged: roots.enabled,
  };
}

function mapUtilsConfig(utils?: {
  formatInvalidParamsErrorMessage?: (
    issues: readonly StandardSchemaV1.Issue[],
  ) => string;
}):
  | {
      formatInvalidParamsErrorMessage?: (issues: any[]) => string;
      streamContent?: (
        content: any,
        context: any,
        progress?: any,
      ) => Promise<any>;
    }
  | undefined {
  if (!utils) return undefined;

  return {
    formatInvalidParamsErrorMessage: utils.formatInvalidParamsErrorMessage,
  };
}

import type {
  AudioContent,
  Authenticate,
  Context,
  FastMCPEvents,
  FastMCPSessionAuth,
  FastMCPSessionEvents,
  ImageContent,
  Logger,
  Progress,
  ResourceLink,
  Root,
  SerializableValue,
  SSEServer,
  TextContent,
  ToolParameters,
} from "./types/index.js";

const TextContentZodSchema = z
  .object({
    /**
     * The text content of the message.
     */
    text: z.string(),
    type: z.literal("text"),
  })
  .strict();

const ImageContentZodSchema = z
  .object({
    /**
     * The base64-encoded image data.
     */
    data: z.string().base64(),
    /**
     * The MIME type of the image. Different providers may support different image types.
     */
    mimeType: z.string(),
    type: z.literal("image"),
  })
  .strict();

const AudioContentZodSchema = z
  .object({
    /**
     * The base64-encoded audio data.
     */
    data: z.string().base64(),
    mimeType: z.string(),
    type: z.literal("audio"),
  })
  .strict();

type ResourceContent = {
  resource: {
    blob?: string;
    mimeType?: string;
    text?: string;
    uri: string;
  };
  type: "resource";
};

const ResourceContentZodSchema = z
  .object({
    resource: z.object({
      blob: z.string().optional(),
      mimeType: z.string(),
      text: z.string().optional(),
      uri: z.string(),
    }),
    type: z.literal("resource"),
  })
  .strict() satisfies z.ZodType<ResourceContent>;

const ResourceLinkZodSchema = z.object({
  description: z.string().optional(),
  mimeType: z.string(),
  name: z.string(),
  title: z.string().optional(),
  type: z.literal("resource_link"),
  uri: z.string(),
}) satisfies z.ZodType<ResourceLink>;

type Content =
  | AudioContent
  | ImageContent
  | ResourceContent
  | ResourceLink
  | TextContent;

const ContentZodSchema = z.discriminatedUnion("type", [
  TextContentZodSchema,
  ImageContentZodSchema,
  AudioContentZodSchema,
  ResourceContentZodSchema,
  ResourceLinkZodSchema,
]) satisfies z.ZodType<Content>;

type ContentResult = {
  content: Content[];
  isError?: boolean;
};

const ContentResultZodSchema = z
  .object({
    content: ContentZodSchema.array(),
    isError: z.boolean().optional(),
  })
  .strict() satisfies z.ZodType<ContentResult>;

type Completion = {
  hasMore?: boolean;
  total?: number;
  values: string[];
};

/**
 * https://github.com/modelcontextprotocol/typescript-sdk/blob/3164da64d085ec4e022ae881329eee7b72f208d4/src/types.ts#L983-L1003
 */
const CompletionZodSchema = z.object({
  /**
   * Indicates whether there are additional completion options beyond those provided in the current response, even if the exact total is unknown.
   */
  hasMore: z.optional(z.boolean()),
  /**
   * The total number of completion options available. This can exceed the number of values actually sent in the response.
   */
  total: z.optional(z.number().int()),
  /**
   * An array of completion values. Must not exceed 100 items.
   */
  values: z.array(z.string()).max(100),
}) satisfies z.ZodType<Completion>;

type ArgumentValueCompleter<T extends FastMCPSessionAuth = FastMCPSessionAuth> =
  (value: string, auth?: T) => Promise<Completion>;

type InputPrompt<
  T extends FastMCPSessionAuth = FastMCPSessionAuth,
  Arguments extends InputPromptArgument<T>[] = InputPromptArgument<T>[],
  Args = PromptArgumentsToObject<Arguments>,
> = {
  arguments?: InputPromptArgument<T>[];
  description?: string;
  load: (args: Args, auth?: T) => Promise<PromptResult>;
  name: string;
};

type InputPromptArgument<T extends FastMCPSessionAuth = FastMCPSessionAuth> =
  Readonly<{
    complete?: ArgumentValueCompleter<T>;
    description?: string;
    enum?: string[];
    name: string;
    required?: boolean;
  }>;

type InputResourceTemplate<
  T extends FastMCPSessionAuth,
  Arguments extends
    InputResourceTemplateArgument<T>[] = InputResourceTemplateArgument<T>[],
> = {
  arguments: Arguments;
  description?: string;
  load: (
    args: ResourceTemplateArgumentsToObject<Arguments>,
    auth?: T,
  ) => Promise<ResourceResult | ResourceResult[]>;
  mimeType?: string;
  name: string;
  uriTemplate: string;
};

type InputResourceTemplateArgument<
  T extends FastMCPSessionAuth = FastMCPSessionAuth,
> = Readonly<{
  complete?: ArgumentValueCompleter<T>;
  description?: string;
  name: string;
  required?: boolean;
}>;

type LoggingLevel =
  | "alert"
  | "critical"
  | "debug"
  | "emergency"
  | "error"
  | "info"
  | "notice"
  | "warning";

type Prompt<
  T extends FastMCPSessionAuth = FastMCPSessionAuth,
  Arguments extends PromptArgument<T>[] = PromptArgument<T>[],
  Args = PromptArgumentsToObject<Arguments>,
> = {
  arguments?: PromptArgument<T>[];
  complete?: (name: string, value: string, auth?: T) => Promise<Completion>;
  description?: string;
  load: (args: Args, auth?: T) => Promise<PromptResult>;
  name: string;
};

type PromptArgument<T extends FastMCPSessionAuth = FastMCPSessionAuth> =
  Readonly<{
    complete?: ArgumentValueCompleter<T>;
    description?: string;
    enum?: string[];
    name: string;
    required?: boolean;
  }>;

type PromptArgumentsToObject<T extends { name: string; required?: boolean }[]> =
  {
    [K in T[number]["name"]]: Extract<
      T[number],
      { name: K }
    >["required"] extends true
      ? string
      : string | undefined;
  };

type PromptResult = Pick<GetPromptResult, "messages"> | string;

type Resource<T extends FastMCPSessionAuth> = {
  complete?: (name: string, value: string, auth?: T) => Promise<Completion>;
  description?: string;
  load: (auth?: T) => Promise<ResourceResult | ResourceResult[]>;
  mimeType?: string;
  name: string;
  uri: string;
};

type ResourceResult =
  | {
      blob: string;
      mimeType?: string;
      uri?: string;
    }
  | {
      mimeType?: string;
      text: string;
      uri?: string;
    };

type ResourceTemplate<
  T extends FastMCPSessionAuth,
  Arguments extends
    ResourceTemplateArgument<T>[] = ResourceTemplateArgument<T>[],
> = {
  arguments: Arguments;
  complete?: (name: string, value: string, auth?: T) => Promise<Completion>;
  description?: string;
  load: (
    args: ResourceTemplateArgumentsToObject<Arguments>,
    auth?: T,
  ) => Promise<ResourceResult | ResourceResult[]>;
  mimeType?: string;
  name: string;
  uriTemplate: string;
};

type ResourceTemplateArgument<
  T extends FastMCPSessionAuth = FastMCPSessionAuth,
> = Readonly<{
  complete?: ArgumentValueCompleter<T>;
  description?: string;
  name: string;
  required?: boolean;
}>;

type ResourceTemplateArgumentsToObject<T extends { name: string }[]> = {
  [K in T[number]["name"]]: string;
};

type SamplingResponse = {
  content: AudioContent | ImageContent | TextContent;
  model: string;
  role: "assistant" | "user";
  stopReason?: "endTurn" | "maxTokens" | "stopSequence" | string;
};

type ServerOptions<T extends FastMCPSessionAuth> = {
  authenticate?: Authenticate<T>;
  /**
   * Configuration for the health-check endpoint that can be exposed when the
   * server is running using the HTTP Stream transport. When enabled, the
   * server will respond to an HTTP GET request with the configured path (by
   * default "/health") rendering a plain-text response (by default "ok") and
   * the configured status code (by default 200).
   *
   * The endpoint is only added when the server is started with
   * `transportType: "httpStream"` – it is ignored for the stdio transport.
   */
  health?: {
    /**
     * When set to `false` the health-check endpoint is disabled.
     * @default true
     */
    enabled?: boolean;

    /**
     * Plain-text body returned by the endpoint.
     * @default "ok"
     */
    message?: string;

    /**
     * HTTP path that should be handled.
     * @default "/health"
     */
    path?: string;

    /**
     * HTTP response status that will be returned.
     * @default 200
     */
    status?: number;
  };
  instructions?: string;
  /**
   * Custom logger instance. If not provided, defaults to console.
   * Use this to integrate with your own logging system.
   */
  logger?: Logger;
  name: string;

  /**
   * Configuration for OAuth well-known discovery endpoints that can be exposed
   * when the server is running using HTTP-based transports (SSE or HTTP Stream).
   * When enabled, the server will respond to requests for OAuth discovery endpoints
   * with the configured metadata.
   *
   * The endpoints are only added when the server is started with
   * `transportType: "httpStream"` – they are ignored for the stdio transport.
   * Both SSE and HTTP Stream transports support OAuth endpoints.
   */
  oauth?: {
    /**
     * OAuth Authorization Server metadata for /.well-known/oauth-authorization-server
     *
     * This endpoint follows RFC 8414 (OAuth 2.0 Authorization Server Metadata)
     * and provides metadata about the OAuth 2.0 authorization server.
     *
     * Required by MCP Specification 2025-03-26
     */
    authorizationServer?: {
      authorizationEndpoint: string;
      codeChallengeMethodsSupported?: string[];
      // DPoP support
      dpopSigningAlgValuesSupported?: string[];
      grantTypesSupported?: string[];

      introspectionEndpoint?: string;
      // Required
      issuer: string;
      // Common optional
      jwksUri?: string;
      opPolicyUri?: string;
      opTosUri?: string;
      registrationEndpoint?: string;
      responseModesSupported?: string[];
      responseTypesSupported: string[];
      revocationEndpoint?: string;
      scopesSupported?: string[];
      serviceDocumentation?: string;
      tokenEndpoint: string;
      tokenEndpointAuthMethodsSupported?: string[];
      tokenEndpointAuthSigningAlgValuesSupported?: string[];

      uiLocalesSupported?: string[];
    };

    /**
     * Whether OAuth discovery endpoints should be enabled.
     */
    enabled: boolean;

    /**
     * OAuth Protected Resource metadata for `/.well-known/oauth-protected-resource`
     *
     * This endpoint follows {@link https://www.rfc-editor.org/rfc/rfc9728.html | RFC 9728}
     * and provides metadata describing how an OAuth 2.0 protected resource (in this case,
     * an MCP server) expects to be accessed.
     *
     * When configured, FastMCP will automatically serve this metadata at the
     * `/.well-known/oauth-protected-resource` endpoint. The `authorizationServers` and `resource`
     * fields are required. All others are optional and will be omitted from the published
     * metadata if not specified.
     *
     * This satisfies the requirements of the MCP Authorization specification's
     * {@link https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization#authorization-server-location | Authorization Server Location section}.
     *
     * Clients consuming this metadata MUST validate that any presented values comply with
     * RFC 9728, including strict validation of the `resource` identifier and intended audience
     * when access tokens are issued and presented (per RFC 8707 §2).
     *
     * @remarks Required by MCP Specification version 2025-06-18
     */
    protectedResource?: {
      /**
       * Allows for additional metadata fields beyond those defined in RFC 9728.
       *
       * @remarks This supports vendor-specific or experimental extensions.
       * @see {@link https://www.rfc-editor.org/rfc/rfc9728.html#section-2.3 | RFC 9728 §2.3}
       */
      [key: string]: unknown;

      /**
       * Supported values for the `authorization_details` parameter (RFC 9396).
       *
       * @remarks Used when fine-grained access control is in play.
       * @see {@link https://www.rfc-editor.org/rfc/rfc9728.html#section-2-2.23 | RFC 9728 §2.2.23}
       */
      authorizationDetailsTypesSupported?: string[];

      /**
       * List of OAuth 2.0 authorization server issuer identifiers.
       *
       * These correspond to ASes that can issue access tokens for this protected resource.
       * MCP clients use these values to locate the relevant `/.well-known/oauth-authorization-server`
       * metadata for initiating the OAuth flow.
       *
       * @remarks Required by the MCP spec. MCP servers MUST provide at least one issuer.
       * Clients are responsible for choosing among them (see RFC 9728 §7.6).
       * @see {@link https://www.rfc-editor.org/rfc/rfc9728.html#section-2-2.3 | RFC 9728 §2.2.3}
       */
      authorizationServers: string[];

      /**
       * List of supported methods for presenting OAuth 2.0 bearer tokens.
       *
       * @remarks Valid values are `header`, `body`, and `query`.
       * If omitted, clients MAY assume only `header` is supported, per RFC 6750.
       * This is a client-side interpretation and not a serialization default.
       * @see {@link https://www.rfc-editor.org/rfc/rfc9728.html#section-2-2.9 | RFC 9728 §2.2.9}
       */
      bearerMethodsSupported?: string[];

      /**
       * Whether this resource requires all access tokens to be DPoP-bound.
       *
       * @remarks If omitted, clients SHOULD assume this is `false`.
       * @see {@link https://www.rfc-editor.org/rfc/rfc9728.html#section-2-2.27 | RFC 9728 §2.2.27}
       */
      dpopBoundAccessTokensRequired?: boolean;

      /**
       * Supported algorithms for verifying DPoP proofs (RFC 9449).
       *
       * @see {@link https://www.rfc-editor.org/rfc/rfc9728.html#section-2-2.25 | RFC 9728 §2.2.25}
       */
      dpopSigningAlgValuesSupported?: string[];

      /**
       * JWKS URI of this resource. Used to validate access tokens or sign responses.
       *
       * @remarks When present, this MUST be an `https:` URI pointing to a valid JWK Set (RFC 7517).
       * @see {@link https://www.rfc-editor.org/rfc/rfc9728.html#section-2-2.5 | RFC 9728 §2.2.5}
       */
      jwksUri?: string;

      /**
       * Canonical OAuth resource identifier for this protected resource (the MCP server).
       *
       * @remarks Typically the base URL of the MCP server. Clients MUST use this as the
       * `resource` parameter in authorization and token requests (per RFC 8707).
       * @see {@link https://www.rfc-editor.org/rfc/rfc9728.html#section-2-2.1 | RFC 9728 §2.2.1}
       */
      resource: string;

      /**
       * URL to developer-accessible documentation for this resource.
       *
       * @remarks This field MAY be localized.
       * @see {@link https://www.rfc-editor.org/rfc/rfc9728.html#section-2-2.15 | RFC 9728 §2.2.15}
       */
      resourceDocumentation?: string;

      /**
       * Human-readable name for display purposes (e.g., in UIs).
       *
       * @remarks This field MAY be localized using language tags (`resource_name#en`, etc.).
       * @see {@link https://www.rfc-editor.org/rfc/rfc9728.html#section-2-2.13 | RFC 9728 §2.2.13}
       */
      resourceName?: string;

      /**
       * URL to a human-readable policy page describing acceptable use.
       *
       * @remarks This field MAY be localized.
       * @see {@link https://www.rfc-editor.org/rfc/rfc9728.html#section-2-2.17 | RFC 9728 §2.2.17}
       */
      resourcePolicyUri?: string;

      /**
       * Supported JWS algorithms for signed responses from this resource (e.g., response signing).
       *
       * @remarks MUST NOT include `none`.
       * @see {@link https://www.rfc-editor.org/rfc/rfc9728.html#section-2-2.11 | RFC 9728 §2.2.11}
       */
      resourceSigningAlgValuesSupported?: string[];

      /**
       * URL to the protected resource’s Terms of Service.
       *
       * @remarks This field MAY be localized.
       * @see {@link https://www.rfc-editor.org/rfc/rfc9728.html#section-2-2.19 | RFC 9728 §2.2.19}
       */
      resourceTosUri?: string;

      /**
       * Supported OAuth scopes for requesting access to this resource.
       *
       * @remarks Useful for discovery, but clients SHOULD still request the minimal scope required.
       * @see {@link https://www.rfc-editor.org/rfc/rfc9728.html#section-2-2.7 | RFC 9728 §2.2.7}
       */
      scopesSupported?: string[];

      /**
       * Developer-accessible documentation for how to use the service (not end-user docs).
       *
       * @remarks Semantically equivalent to `resourceDocumentation`, but included under its
       * alternate name for compatibility with tools or schemas expecting either.
       * @see {@link https://www.rfc-editor.org/rfc/rfc9728.html#section-2-2.15 | RFC 9728 §2.2.15}
       */
      serviceDocumentation?: string;

      /**
       * Whether mutual-TLS-bound access tokens are required.
       *
       * @remarks If omitted, clients SHOULD assume this is `false` (client-side behavior).
       * @see {@link https://www.rfc-editor.org/rfc/rfc9728.html#section-2-2.21 | RFC 9728 §2.2.21}
       */
      tlsClientCertificateBoundAccessTokens?: boolean;
    };
  };

  ping?: {
    /**
     * Whether ping should be enabled by default.
     * - true for SSE or HTTP Stream
     * - false for stdio
     */
    enabled?: boolean;
    /**
     * Interval
     * @default 5000 (5s)
     */
    intervalMs?: number;
    /**
     * Logging level for ping-related messages.
     * @default 'debug'
     */
    logLevel?: LoggingLevel;
  };
  /**
   * Configuration for roots capability
   */
  roots?: {
    /**
     * Whether roots capability should be enabled
     * Set to false to completely disable roots support
     * @default true
     */
    enabled?: boolean;
  };
  /**
   * General utilities
   */
  utils?: {
    formatInvalidParamsErrorMessage?: (
      issues: readonly StandardSchemaV1.Issue[],
    ) => string;
  };
  version: `${number}.${number}.${number}`;
};

type Tool<
  T extends FastMCPSessionAuth,
  Params extends ToolParameters = ToolParameters,
> = {
  annotations?: {
    /**
     * When true, the tool leverages incremental content streaming
     * Return void for tools that handle all their output via streaming
     */
    streamingHint?: boolean;
  } & ToolAnnotations;
  canAccess?: (auth: T) => boolean;
  description?: string;

  execute: (
    args: StandardSchemaV1.InferOutput<Params>,
    context: Context<T>,
  ) => Promise<
    | AudioContent
    | ContentResult
    | ImageContent
    | ResourceContent
    | ResourceLink
    | string
    | TextContent
    | void
  >;
  name: string;
  parameters?: Params;
  timeoutMs?: number;
};

/**
 * Tool annotations as defined in MCP Specification (2025-03-26)
 * These provide hints about a tool's behavior.
 */
type ToolAnnotations = {
  /**
   * If true, the tool may perform destructive updates
   * Only meaningful when readOnlyHint is false
   * @default true
   */
  destructiveHint?: boolean;

  /**
   * If true, calling the tool repeatedly with the same arguments has no additional effect
   * Only meaningful when readOnlyHint is false
   * @default false
   */
  idempotentHint?: boolean;

  /**
   * If true, the tool may interact with an "open world" of external entities
   * @default true
   */
  openWorldHint?: boolean;

  /**
   * If true, indicates the tool does not modify its environment
   * @default false
   */
  readOnlyHint?: boolean;

  /**
   * A human-readable title for the tool, useful for UI display
   */
  title?: string;
};

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

const FastMCPEventEmitterBase: {
  new (): StrictEventEmitter<EventEmitter, FastMCPEvents<FastMCPSessionAuth>>;
} = EventEmitter;

class FastMCPEventEmitter extends FastMCPEventEmitterBase {}

export class FastMCP<
  T extends FastMCPSessionAuth = FastMCPSessionAuth,
> extends FastMCPEventEmitter {
  public get isRunning(): boolean {
    return this.#httpStreamServer !== null || this.#sessions.length > 0;
  }

  public get prompts(): InputPrompt<T>[] {
    return this.#prompts;
  }

  public get resources(): Resource<T>[] {
    return this.#resources;
  }

  public get resourceTemplates(): InputResourceTemplate<T>[] {
    return this.#resourcesTemplates;
  }

  public get sessions(): FastMCPSession<T>[] {
    return this.#sessions;
  }

  public get tools(): Tool<T>[] {
    return this.#tools;
  }

  #authenticate: Authenticate<T> | undefined;
  #httpStreamServer: null | SSEServer = null;
  #logger: Logger;
  #options: ServerOptions<T>;
  #prompts: InputPrompt<T>[] = [];
  #resources: Resource<T>[] = [];
  #resourcesTemplates: InputResourceTemplate<T>[] = [];
  #sessions: FastMCPSession<T>[] = [];

  #tools: Tool<T>[] = [];

  constructor(public options: ServerOptions<T>) {
    super();

    // Validate required options
    if (!options.name) {
      throw new Error("Server name is required");
    }
    if (!options.version) {
      throw new Error("Server version is required");
    }

    this.#options = options;
    this.#authenticate = options.authenticate;
    this.#logger = options.logger || console;
  }

  /**
   * Adds a prompt to the server.
   */
  public addPrompt<const Args extends InputPromptArgument<T>[]>(
    prompt: InputPrompt<T, Args>,
  ) {
    this.#prompts.push(prompt);
  }

  /**
   * Adds a resource to the server.
   */
  public addResource(resource: Resource<T>) {
    this.#resources.push(resource);
  }

  /**
   * Adds a resource template to the server.
   */
  public addResourceTemplate<
    const Args extends InputResourceTemplateArgument[],
  >(resource: InputResourceTemplate<T, Args>) {
    this.#resourcesTemplates.push(resource);
  }

  /**
   * Adds a tool to the server.
   */
  public addTool<Params extends ToolParameters>(tool: Tool<T, Params>) {
    this.#tools.push(tool as unknown as Tool<T>);
  }

  /**
   * Embeds a resource by URI, making it easy to include resources in tool responses.
   *
   * @param uri - The URI of the resource to embed
   * @returns Promise<ResourceContent> - The embedded resource content
   */
  public async embedded(uri: string): Promise<ResourceContent["resource"]> {
    // First, try to find a direct resource match
    const directResource = this.#resources.find(
      (resource) => resource.uri === uri,
    );

    if (directResource) {
      const result = await directResource.load();
      const results = Array.isArray(result) ? result : [result];
      const firstResult = results[0];

      const resourceData: ResourceContent["resource"] = {
        mimeType: directResource.mimeType,
        uri,
      };

      if ("text" in firstResult) {
        resourceData.text = firstResult.text;
      }

      if ("blob" in firstResult) {
        resourceData.blob = firstResult.blob;
      }

      return resourceData;
    }

    // Try to match against resource templates
    for (const template of this.#resourcesTemplates) {
      // Check if the URI starts with the template base
      const templateBase = template.uriTemplate.split("{")[0];

      if (uri.startsWith(templateBase)) {
        const params: Record<string, string> = {};
        const templateParts = template.uriTemplate.split("/");
        const uriParts = uri.split("/");

        for (let i = 0; i < templateParts.length; i++) {
          const templatePart = templateParts[i];

          if (templatePart?.startsWith("{") && templatePart.endsWith("}")) {
            const paramName = templatePart.slice(1, -1);
            const paramValue = uriParts[i];

            if (paramValue) {
              params[paramName] = paramValue;
            }
          }
        }

        const result = await template.load(
          params as ResourceTemplateArgumentsToObject<
            typeof template.arguments
          >,
        );

        const resourceData: ResourceContent["resource"] = {
          mimeType: template.mimeType,
          uri,
        };

        if ("text" in result) {
          resourceData.text = result.text;
        }

        if ("blob" in result) {
          resourceData.blob = result.blob;
        }

        return resourceData; // The resource we're looking for
      }
    }

    throw new UnexpectedStateError(`Resource not found: ${uri}`, { uri });
  }

  /**
   * Starts the server.
   */
  public async start(
    options?: Partial<{
      httpStream: {
        enableJsonResponse?: boolean;
        endpoint?: `/${string}`;
        eventStore?: EventStore;
        host?: string;
        port: number;
        stateless?: boolean;
      };
      transportType: "httpStream" | "stdio";
    }>,
  ) {
    const config = this.#parseRuntimeConfig(options);

    if (config.transportType === "stdio") {
      const { auth, transport } = await createStdioTransport({
        authenticate: this.#authenticate,
        logger: this.#logger,
      });

      const session = new FastMCPSession<T>({
        auth,
        instructions: this.#options.instructions,
        logger: this.#logger,
        name: this.#options.name,
        ping: mapPingConfig(this.#options.ping),
        prompts: this.#prompts,
        resources: this.#resources,
        resourcesTemplates: this.#resourcesTemplates,
        roots: mapRootsConfig(this.#options.roots),
        tools: this.#tools,
        transportType: "stdio",
        utils: mapUtilsConfig(this.#options.utils),
        version: this.#options.version,
      });

      await session.connect(transport);

      this.#sessions.push(session);

      session.once("error", () => {
        this.#removeSession(session);
      });

      // Monitor the underlying transport for close events
      if (transport.onclose) {
        const originalOnClose = transport.onclose;

        transport.onclose = () => {
          this.#removeSession(session);

          if (originalOnClose) {
            originalOnClose();
          }
        };
      } else {
        transport.onclose = () => {
          this.#removeSession(session);
        };
      }

      this.emit("connect", {
        session: session as FastMCPSession<FastMCPSessionAuth>,
      });
    } else if (config.transportType === "httpStream") {
      const httpConfig = config.httpStream;

      this.#httpStreamServer = await createHttpTransport({
        authenticate: this.#authenticate,
        createSession: (auth: T | undefined) => this.#createSession(auth),
        enableJsonResponse: httpConfig.enableJsonResponse,
        eventStore: httpConfig.eventStore,
        host: httpConfig.host,
        logger: this.#logger,
        onClose: httpConfig.stateless
          ? undefined
          : async (session) => {
              const sessionIndex = this.#sessions.indexOf(session);
              if (sessionIndex !== -1) this.#sessions.splice(sessionIndex, 1);
              this.emit("disconnect", {
                session: session as FastMCPSession<FastMCPSessionAuth>,
              });
            },
        onConnect: httpConfig.stateless
          ? undefined
          : async (session) => {
              this.#sessions.push(session);
              this.#logger.info(
                `[FastMCP info] HTTP Stream session established`,
              );
              this.emit("connect", {
                session: session as FastMCPSession<FastMCPSessionAuth>,
              });
            },
        onUnhandledRequest: async (req, res) => {
          await this.#handleUnhandledRequest(
            req,
            res,
            httpConfig.stateless,
            httpConfig.host,
          );
        },
        port: httpConfig.port,
        stateless: httpConfig.stateless,
        streamEndpoint: httpConfig.endpoint,
      });
    } else {
      throw new Error("Invalid transport type");
    }
  }

  /**
   * Stops the server.
   */
  public async stop() {
    if (this.#httpStreamServer) {
      await this.#httpStreamServer.close();
    }
  }

  /**
   * Creates a new FastMCPSession instance with the current configuration.
   * Used both for regular sessions and stateless requests.
   */
  #createSession(auth?: T): FastMCPSession<T> {
    const allowedTools = auth
      ? this.#tools.filter((tool) =>
          tool.canAccess ? tool.canAccess(auth) : true,
        )
      : this.#tools;
    return new FastMCPSession<T>({
      auth,
      instructions: this.#options.instructions,
      logger: this.#logger,
      name: this.#options.name,
      ping: mapPingConfig(this.#options.ping),
      prompts: this.#prompts,
      resources: this.#resources,
      resourcesTemplates: this.#resourcesTemplates,
      roots: mapRootsConfig(this.#options.roots),
      tools: allowedTools,
      transportType: "httpStream",
      utils: mapUtilsConfig(this.#options.utils),
      version: this.#options.version,
    });
  }

  /**
   * Handles unhandled HTTP requests with health, readiness, and OAuth endpoints
   */
  #handleUnhandledRequest = async (
    req: http.IncomingMessage,
    res: http.ServerResponse,
    isStateless = false,
    host: string,
  ) => {
    // Try health endpoint handler
    const healthHandled = await handleHealthEndpoint(req, res, {
      healthConfig: this.#options.health,
      host,
      logger: this.#logger,
    });
    if (healthHandled) return;

    // Try readiness endpoint handler
    const readinessHandled = await handleReadinessEndpoint(req, res, {
      host,
      isStateless,
      logger: this.#logger,
      sessions: this.#sessions,
    });
    if (readinessHandled) return;

    // Try OAuth endpoints handler
    const oauthHandled = await handleOAuthEndpoints(req, res, {
      host,
      logger: this.#logger,
      oauthConfig: this.#options.oauth,
    });
    if (oauthHandled) return;

    // If the request was not handled above, return 404
    res.writeHead(404).end();
  };

  #parseRuntimeConfig(
    overrides?: Partial<{
      httpStream: {
        enableJsonResponse?: boolean;
        endpoint?: `/${string}`;
        host?: string;
        port: number;
        stateless?: boolean;
      };
      transportType: "httpStream" | "stdio";
    }>,
  ):
    | {
        httpStream: {
          enableJsonResponse?: boolean;
          endpoint: `/${string}`;
          eventStore?: EventStore;
          host: string;
          port: number;
          stateless?: boolean;
        };
        transportType: "httpStream";
      }
    | { transportType: "stdio" } {
    const args = process.argv.slice(2);
    const getArg = (name: string) => {
      const index = args.findIndex((arg) => arg === `--${name}`);

      return index !== -1 && index + 1 < args.length
        ? args[index + 1]
        : undefined;
    };

    const transportArg = getArg("transport");
    const portArg = getArg("port");
    const endpointArg = getArg("endpoint");
    const statelessArg = getArg("stateless");
    const hostArg = getArg("host");

    const envTransport = process.env.FASTMCP_TRANSPORT;
    const envPort = process.env.FASTMCP_PORT;
    const envEndpoint = process.env.FASTMCP_ENDPOINT;
    const envStateless = process.env.FASTMCP_STATELESS;
    const envHost = process.env.FASTMCP_HOST;
    // Overrides > CLI > env > defaults
    const transportType =
      overrides?.transportType ||
      (transportArg === "http-stream" ? "httpStream" : transportArg) ||
      envTransport ||
      "stdio";

    if (transportType === "httpStream") {
      const port = parseInt(
        overrides?.httpStream?.port?.toString() || portArg || envPort || "8080",
      );
      const host =
        overrides?.httpStream?.host || hostArg || envHost || "localhost";
      const endpoint =
        overrides?.httpStream?.endpoint || endpointArg || envEndpoint || "/mcp";
      const enableJsonResponse =
        overrides?.httpStream?.enableJsonResponse || false;
      const stateless =
        overrides?.httpStream?.stateless ||
        statelessArg === "true" ||
        envStateless === "true" ||
        false;

      return {
        httpStream: {
          enableJsonResponse,
          endpoint: endpoint as `/${string}`,
          host,
          port,
          stateless,
        },
        transportType: "httpStream" as const,
      };
    }

    return { transportType: "stdio" as const };
  }

  #removeSession(session: FastMCPSession<T>): void {
    const sessionIndex = this.#sessions.indexOf(session);

    if (sessionIndex !== -1) {
      this.#sessions.splice(sessionIndex, 1);
      this.emit("disconnect", {
        session: session as FastMCPSession<FastMCPSessionAuth>,
      });
    }
  }
}

export type {
  AudioContent,
  Content,
  ContentResult,
  Context,
  FastMCPEvents,
  FastMCPSessionEvents,
  ImageContent,
  InputPrompt,
  InputPromptArgument,
  LoggingLevel,
  Progress,
  Prompt,
  PromptArgument,
  Resource,
  ResourceContent,
  ResourceResult,
  ResourceTemplate,
  ResourceTemplateArgument,
  SerializableValue,
  ServerOptions,
  TextContent,
  Tool,
  ToolParameters,
};

export {
  FastMCPError,
  UnexpectedStateError,
  UserError,
} from "./errors/index.js";
export { FastMCPSession } from "./session/index.js";
// Export utility functions and error classes
export { audioContent, imageContent } from "./utils/content-helpers.js";
