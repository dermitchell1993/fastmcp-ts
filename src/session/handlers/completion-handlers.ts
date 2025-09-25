import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CompleteRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { Prompt, ResourceTemplate, FastMCPSessionAuth } from "../../types/index.js";

// Error class for completion handlers
export class UnexpectedStateError extends Error {
  public extras?: any;

  public constructor(message: string, extras?: any) {
    super(message);
    this.name = new.target.name;
    this.extras = extras;
  }
}

// Completion schema validation
const CompletionZodSchema = z.object({
  hasMore: z.optional(z.boolean()),
  total: z.optional(z.number().int()),
  values: z.array(
    z.object({
      value: z.string(),
      description: z.optional(z.string()),
    }),
  ),
});

export function setupCompleteHandlers<T extends FastMCPSessionAuth>(
  server: Server,
  prompts: Prompt<T>[],

  resourceTemplates?: ResourceTemplate<T>[],
  auth?: T
) {
  server.setRequestHandler(CompleteRequestSchema, async (request) => {
    if (request.params.ref.type === "ref/prompt") {
      const prompt = prompts.find(
        (prompt) => prompt.name === request.params.ref.name,
      );

      if (!prompt) {
        throw new UnexpectedStateError("Unknown prompt", {
          request,
        });
      }

      if (!prompt.complete) {
        throw new UnexpectedStateError("Prompt does not support completion", {
          request,
        });
      }

      const completion = CompletionZodSchema.parse(
        await prompt.complete(
          request.params.argument.name,
          request.params.argument.value,
          auth,
        ),
      );

      return {
        completion,
      };
    }

    if (request.params.ref.type === "ref/resource" && resourceTemplates) {
      const resource = resourceTemplates.find(
        (resource) => resource.uriTemplate === request.params.ref.uri,
      );

      if (!resource) {
        throw new UnexpectedStateError("Unknown resource", {
          request,
        });
      }

      if (!("uriTemplate" in resource)) {
        throw new UnexpectedStateError("Unexpected resource");
      }

      if (!resource.complete) {
        throw new UnexpectedStateError(
          "Resource does not support completion",
          {
            request,
          },
        );
      }

      const completion = CompletionZodSchema.parse(
        await resource.complete(
          request.params.argument.name,
          request.params.argument.value,
          auth,
        ),
      );

      return {
        completion,
      };
    }

    throw new UnexpectedStateError("Unexpected completion request", {
      request,
    });
  });
}
