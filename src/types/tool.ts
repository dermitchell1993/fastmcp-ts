import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { Content } from "./content.js";
import type { Context, FastMCPSessionAuth } from "./session.js";
export type Tool<
   
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
    { content: Content[]; isError?: boolean } | Content | string | void
  >;
  name: string;
  parameters?: Params;
  timeoutMs?: number;
};
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

export type ToolParameters = StandardSchemaV1;
