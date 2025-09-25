import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ErrorCode,
  ListResourcesRequestSchema,
  ListResourcesResult,
  ListResourceTemplatesRequestSchema,
  ListResourceTemplatesResult,
  McpError,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import parseURITemplate from "uri-templates";
import { Resource, ResourceTemplate, FastMCPSessionAuth } from "../../types/index.js";
import { UnexpectedStateError } from "../../errors/index.js";

export function setupResourceHandlers<T extends FastMCPSessionAuth>(
  server: Server,
  resources: Resource<T>[],
  resourceTemplates?: ResourceTemplate<T>[],
  auth?: T
) {
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: resources.map((resource) => ({
        description: resource.description,
        mimeType: resource.mimeType,
        name: resource.name,
        uri: resource.uri,
      })),
    } satisfies ListResourcesResult;
  });

  server.setRequestHandler(
    ReadResourceRequestSchema,
    async (request) => {
      if ("uri" in request.params) {
        const resource = resources.find(
          (resource) =>
            "uri" in resource && resource.uri === request.params.uri,
        );

        if (!resource) {
          // Check resource templates if available
          if (resourceTemplates) {
            for (const resourceTemplate of resourceTemplates) {
              const uriTemplate = parseURITemplate(
                resourceTemplate.uriTemplate,
              );

              const match = uriTemplate.fromUri(request.params.uri);

              if (!match) {
                continue;
              }

              const uri = uriTemplate.fill(match);

              const result = await resourceTemplate.load(match, auth);

              const resourceResults = Array.isArray(result) ? result : [result];
              return {
                contents: resourceResults.map((resource) => ({
                  ...resource,
                  description: resourceTemplate.description,
                  mimeType: resource.mimeType ?? resourceTemplate.mimeType,
                  name: resourceTemplate.name,
                  uri: resource.uri ?? uri,
                })),
              };
            }
          }

          throw new McpError(
            ErrorCode.MethodNotFound,
            `Resource not found: '${request.params.uri}'. Available resources: ${
              resources.map((r) => r.uri).join(", ") || "none"
            }`,
          );
        }

        if (!("uri" in resource)) {
          throw new UnexpectedStateError("Resource does not support reading");
        }

        let maybeArrayResult: Awaited<ReturnType<Resource<T>["load"]>>;

        try {
          maybeArrayResult = await resource.load(auth);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to load resource '${resource.name}' (${resource.uri}): ${errorMessage}`,
            {
              uri: resource.uri,
            },
          );
        }

        const resourceResults = Array.isArray(maybeArrayResult)
          ? maybeArrayResult
          : [maybeArrayResult];

        return {
          contents: resourceResults.map((result) => ({
            ...result,
            mimeType: result.mimeType ?? resource.mimeType,
            name: resource.name,
            uri: result.uri ?? resource.uri,
          })),
        };
      }

      throw new UnexpectedStateError("Unknown resource request", {
        request,
      });
    },
  );
}

export function setupResourceTemplateHandlers<T extends FastMCPSessionAuth>(
  server: Server,
  resourceTemplates: ResourceTemplate<T>[]
) {
  server.setRequestHandler(
    ListResourceTemplatesRequestSchema,
    async () => {
      return {
        resourceTemplates: resourceTemplates.map((resourceTemplate) => ({
          description: resourceTemplate.description,
          mimeType: resourceTemplate.mimeType,
          name: resourceTemplate.name,
          uriTemplate: resourceTemplate.uriTemplate,
        })),
      } satisfies ListResourceTemplatesResult;
    },
  );
}
