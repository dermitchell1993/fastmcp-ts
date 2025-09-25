import type { Completion } from "./prompt.js";
import type { FastMCPSessionAuth } from "./session.js";
import type { Root } from "@modelcontextprotocol/sdk/types.js";

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
  complete?: (value: string, auth?: T) => Promise<Completion>
  description?: string;
  name: string;
  required?: boolean;
};

export type Resource<T extends FastMCPSessionAuth> = {
  complete?: (name: string, value: string, auth?: T) => Promise<Completion>
  description?: string;
  load: (auth?: T) => Promise<ResourceResult | ResourceResult[]>;
  mimeType?: string;
  name: string;
  uri: string;
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
  complete?: (name: string, value: string, auth?: T) => Promise<Completion>
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
  complete?: (value: string, auth?: T) => Promise<Completion>
  description?: string;
  name: string;
  required?: boolean;
};

export type ResourceTemplateArgumentsToObject<T extends { name: string }[]> = {
  [K in T[number]["name"]]: string;
};

