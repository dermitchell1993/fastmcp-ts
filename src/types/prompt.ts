// Forward declarations
export type FastMCPSessionAuth = Record<string, unknown> | undefined;

export type ArgumentValueCompleter<T extends FastMCPSessionAuth> = (
  value: string,
  auth?: T,
) => Promise<any>; // Completion type

export type InputPrompt<
  T extends FastMCPSessionAuth = FastMCPSessionAuth,
  Arguments extends InputPromptArgument<T>[] = InputPromptArgument<T>[],
  Args = PromptArgumentsToObject<Arguments>,
> = {
  arguments?: InputPromptArgument<T>[];
  description?: string;
  load: (args: Args, auth?: T) => Promise<any>; // PromptResult
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
  complete?: (name: string, value: string, auth?: T) => Promise<any>; // Completion type
  description?: string;
  load: (args: Args, auth?: T) => Promise<any>; // PromptResult
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

export type PromptResult = any; // Pick<GetPromptResult, "messages"> | string - will be resolved with MCP types

export type Completion = {
  hasMore?: boolean;
  total?: number;
  values: string[];
};
