// Forward declarations
export type FastMCPSessionAuth = Record<string, unknown> | undefined;

export type Root = any; // From MCP SDK

export type Resource<T extends FastMCPSessionAuth> = {
  complete?: (name: string, value: string, auth?: T) => Promise<any>; // Completion type
  description?: string;
  load: (auth?: T) => Promise<ResourceResult | ResourceResult[]>;
  mimeType?: string;
  name: string;
  uri: string;
};

export type ResourceResult =
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

export type ResourceTemplate<
  T extends FastMCPSessionAuth,
  Arguments extends
    ResourceTemplateArgument<T>[] = ResourceTemplateArgument<T>[],
> = {
  arguments: Arguments;
  complete?: (name: string, value: string, auth?: T) => Promise<any>; // Completion type
  description?: string;
  load: (
    args: ResourceTemplateArgumentsToObject<Arguments>,
    auth?: T,
  ) => Promise<ResourceResult | ResourceResult[]>;
  mimeType?: string;
  name: string;
  uriTemplate: string;
};

export type ResourceTemplateArgument<T extends FastMCPSessionAuth> = {
  complete?: (value: string, auth?: T) => Promise<any>; // Completion type
  description?: string;
  name: string;
  required?: boolean;
};

export type ResourceTemplateArgumentsToObject<T extends { name: string }[]> = {
  [K in T[number]["name"]]: string;
};

export type InputResourceTemplate<
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

export type InputResourceTemplateArgument<T extends FastMCPSessionAuth> = {
  complete?: (value: string, auth?: T) => Promise<any>; // Completion type
  description?: string;
  name: string;
  required?: boolean;
};

// From MCP SDK types
export type ResourceLink = {
  description?: string;
  mimeType?: string;
  name: string;
  title?: string;
  type: "resource_link";
  uri: string;
};
