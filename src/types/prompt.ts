import type { GetPromptResult } from "@modelcontextprotocol/sdk/types.js";
import type { FastMCPSessionAuth } from "./session.js";

export type Completion = {
  hasMore?: boolean;
  total?: number;
  values: string[];
};

export type ArgumentValueCompleter<T extends FastMCPSessionAuth> = (
  value: string,
  auth?: T,
) => Promise<Completion>;

export type InputPrompt<
  T extends FastMCPSessionAuth = FastMCPSessionAuth,
  Arguments extends InputPromptArgument<T>[] = InputPromptArgument<T>[],
  Args = PromptArgumentsToObject<Arguments>,
> = {
  arguments?: InputPromptArgument<T>[];
  description?: string;
  load: (args: Args, auth?: T) => Promise<PromptResult>;
  name: string;
};

export type InputPromptArgument<
  T extends FastMCPSessionAuth = FastMCPSessionAuth,
> = Readonly<{
  complete?: ArgumentValueCompleter<T>;
  description?: string;
  enum?: string[];
  name: string;
  required?: boolean;
}>;

export type Prompt<
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

export type PromptArgument<T extends FastMCPSessionAuth = FastMCPSessionAuth> =
  Readonly<{
    complete?: ArgumentValueCompleter<T>;
    description?: string;
    enum?: string[];
    name: string;
    required?: boolean;
  }>;

export type PromptArgumentsToObject<
  T extends { name: string; required?: boolean }[],
> = {
  [K in T[number]["name"]]: Extract<
    T[number],
    { name: K }
  >["required"] extends true
    ? string
    : string | undefined;
};

export type PromptResult = Pick<GetPromptResult, "messages"> | string;
