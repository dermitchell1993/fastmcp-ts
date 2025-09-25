import { Content } from "./content.js";

export type Context<T extends FastMCPSessionAuth> = {
  client: {
    version: ReturnType<any>; // Will be resolved when Server type is available
  };
  log: {
    debug: (message: string, data?: SerializableValue) => void;
    error: (message: string, data?: SerializableValue) => void;
    info: (message: string, data?: SerializableValue) => void;
    warn: (message: string, data?: SerializableValue) => void;
  };
  reportProgress: (progress: Progress) => Promise<void>;
  session: T | undefined;
  streamContent: (content: Content | Content[]) => Promise<void>;
};

// Forward declarations
export type FastMCPSessionAuth = Record<string, unknown> | undefined;

export type Progress = {
  /**
   * The progress thus far. This should increase every time progress is made, even if the total is unknown.
   */
  progress: number;
  /**
   * Total number of items to process (or total progress required), if known.
   */
  total?: number;
};

export type SamplingResponse = {
  content: any; // AudioContent | ImageContent | TextContent - will be resolved with content types
  model: string;
  role: "assistant" | "user";
  stopReason?: "endTurn" | "maxTokens" | "stopSequence" | string;
};

export type SerializableValue =
  | { [key: string]: SerializableValue }
  | boolean
  | null
  | number
  | SerializableValue[]
  | string
  | undefined;
