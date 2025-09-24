// Forward declarations - will be resolved when full imports are available
export type StandardSchemaV1 = any;
export type ToolParameters = StandardSchemaV1;

export type ToolAnnotations = {
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

// Forward declarations for dependencies
export type FastMCPSessionAuth = Record<string, unknown> | undefined;
export type Context<T extends FastMCPSessionAuth> = any;
export type Content = any;

export type Tool<
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    args: any, // StandardSchemaV1.InferOutput<Params> - will be resolved when imports available
    context: Context<T>,
  ) => Promise<
    Content | { content: Content[]; isError?: boolean } | string | void
  >;
  name: string;
  parameters?: Params;
  timeoutMs?: number;
};
