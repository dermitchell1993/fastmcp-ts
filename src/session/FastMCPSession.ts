import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  ClientCapabilities,
  ErrorCode,
  McpError,
  Root,
  ServerCapabilities,
} from "@modelcontextprotocol/sdk/types.js";
import { EventEmitter } from "events";
import { StrictEventEmitter } from "strict-event-emitter-types";
import { setTimeout as delay } from "timers/promises";

import {
  Context,
  Progress,
  Tool,
  Resource,
  Prompt,
  LoggingLevel,
  Content,
  ContentResult,
  FastMCPSessionEvents,
  FastMCPSessionAuth,
  ResourceTemplate,
  InputResourceTemplate,
} from "../types/index.js";
import { Logger } from "../types/logger.js";

import { setupErrorHandling } from "./setup/error-setup.js";
import { setupLoggingHandlers } from "./setup/logging-setup.js";
import { setupRootsHandlers } from "./setup/roots-setup.js";
import { setupCompleteHandlers } from "./handlers/completion-handlers.js";
import { setupPromptHandlers } from "./handlers/prompt-handlers.js";
import { setupResourceHandlers } from "./handlers/resource-handlers.js";
import { setupToolHandlers } from "./handlers/tool-handlers.js";

// Event emitter setup
const FastMCPSessionEventEmitterBase: {
  new (): StrictEventEmitter<EventEmitter, FastMCPSessionEvents>;
} = EventEmitter;

class FastMCPSessionEventEmitter extends FastMCPSessionEventEmitterBase {}

export class FastMCPSession<
  T extends FastMCPSessionAuth = FastMCPSessionAuth,
> extends FastMCPSessionEventEmitter {
  public get clientCapabilities(): ClientCapabilities | null {
    return this.#clientCapabilities ?? null;
  }
  public get isReady(): boolean {
    return this.#connectionState === "ready";
  }
  public get loggingLevel(): LoggingLevel {
    return this.#loggingLevel;
  }
  public get roots(): Root[] {
    return this.#roots;
  }
  public get server(): Server {
    return this.#server;
  }
  #auth: T | undefined;
  #capabilities: ServerCapabilities = {};
  #clientCapabilities?: ClientCapabilities;
  #connectionState: "closed" | "connecting" | "error" | "ready" = "connecting";
  #logger: Logger;
  #loggingLevel: LoggingLevel = "info";
  #needsEventLoopFlush: boolean = false;
  #pingConfig?: {
    enabled: boolean;
    interval: number;
    logLevel: "debug" | "warning" | "none";
  };

  #pingInterval: null | ReturnType<typeof setInterval> = null;

  #prompts: Prompt<T>[] = [];
  #resources: Resource<T>[] = [];
  #resourceTemplates: ResourceTemplate<T>[] = [];
  #roots: Root[] = [];
  #rootsConfig?: {
    listChanged?: boolean;
  };
  #server: Server;
  #tools: Tool<T>[] = [];
  #utils?: {
    streamContent?: (
      content: Content,
      context: Context<T>,
      progress?: Progress,
    ) => Promise<ContentResult>;
  };

  constructor({
    auth,
    instructions,
    logger,
    name,
    ping,
    prompts,
    resources,
    resourcesTemplates,
    roots,
    tools,
    transportType,
    utils,
    version,
  }: {
    auth?: T;
    instructions?: string;
    logger: Logger;
    name: string;
    ping?: {
      enabled: boolean;
      interval: number;
      logLevel: "debug" | "warning" | "none";
    };
    prompts: Prompt<T>[];
    resources: Resource<T>[];
    resourcesTemplates: InputResourceTemplate<T>[];
    roots?: {
      listChanged?: boolean;
    };
    tools: Tool<T>[];
    transportType?: "httpStream" | "stdio";
    utils?: {
      streamContent?: (
        content: Content,
        context: Context<T>,
        progress?: Progress,
      ) => Promise<ContentResult>;
    };
    version: string;
  }) {
    super();

    this.#auth = auth;
    this.#logger = logger;
    this.#pingConfig = ping;
    this.#rootsConfig = roots;
    this.#needsEventLoopFlush = transportType === "httpStream";

    if (tools.length) {
      this.#capabilities.tools = {};
    }

    if (resources.length || resourcesTemplates.length) {
      this.#capabilities.resources = {};
    }

    if (prompts.length) {
      for (const prompt of prompts) {
        this.addPrompt(prompt);
      }

      this.#capabilities.prompts = {};
    }

    this.#capabilities.logging = {};

    this.#server = new Server(
      { name: name, version: version },
      { capabilities: this.#capabilities, instructions: instructions },
    );

    this.#utils = utils;

    setupErrorHandling(this.#server, this.#logger);
    setupLoggingHandlers(this.#server, this.#loggingLevel, (level) => {
      this.#loggingLevel = level;
    });
    setupRootsHandlers(
      this.#server, 
      this.#roots, 
      this.#rootsConfig, 
      this.#logger, 
      (event: string, data: any) => this.emit(event as any, data)
    );
    setupCompleteHandlers(
      this.#server, 
      this.#prompts, 
      this.#tools, 
      this.#resourceTemplates, 
      this.#auth
    );

    if (tools.length) {
      setupToolHandlers(
        this.#server, 
        tools, 
        this.#logger, 
        this.#utils, 
        this.#auth, 
        this.#needsEventLoopFlush
      );
    }

    if (resources.length || resourcesTemplates.length) {
      for (const resource of resources) {
        this.addResource(resource);
      }

      setupResourceHandlers(this.#server, resources, this.#resourceTemplates, this.#auth);

      if (resourcesTemplates.length) {
        for (const resourceTemplate of resourcesTemplates) {
          this.addResourceTemplate(resourceTemplate);
        }

        // setupResourceTemplateHandlers(this.#server, resourcesTemplates);
      }
    }

    if (prompts.length) {
      setupPromptHandlers(this.#server, prompts, this.#auth);
    }
  }

  public async close() {
    this.#connectionState = "closed";

    if (this.#pingInterval) {
      clearInterval(this.#pingInterval);
    }

    try {
      await this.#server.close();
    } catch (error) {
      this.#logger.error("[FastMCP error]", "could not close server", error);
    }
  }

  public async connect(transport: Transport) {
    if (this.#server.transport) {
      throw new Error("Server is already connected");
    }

    this.#connectionState = "connecting";

    try {
      await this.#server.connect(transport);

      let attempt = 0;
      const maxAttempts = 10;
      const retryDelay = 100;

      while (attempt++ < maxAttempts) {
        const capabilities = this.#server.getClientCapabilities();

        if (capabilities) {
          this.#clientCapabilities = capabilities;
          break;
        }

        await delay(retryDelay);
      }

      if (!this.#clientCapabilities) {
        this.#logger.warn(
          `[FastMCP warning] could not infer client capabilities after ${maxAttempts} attempts. Connection may be unstable.`,
        );
      }

      if (
        this.#clientCapabilities?.roots?.listChanged &&
        typeof this.#server.listRoots === "function"
      ) {
        try {
          const roots = await this.#server.listRoots();
          this.#roots = roots?.roots || [];
        } catch (e) {
          if (e instanceof McpError && e.code === ErrorCode.MethodNotFound) {
            this.#logger.debug(
              "[FastMCP debug] listRoots method not supported by client",
            );
          } else {
            this.#logger.error(
              `[FastMCP error] received error listing roots.\n\n${
                e instanceof Error ? e.stack : JSON.stringify(e)
              }`,
            );
          }
        }
      }

      if (this.#clientCapabilities) {
        const pingConfig = this.#getPingConfig(transport);

        if (pingConfig.enabled) {
          this.#pingInterval = setInterval(async () => {
            try {
              await this.#server.ping();
            } catch {
              const logLevel = pingConfig.logLevel;

              if (logLevel === "debug") {
                this.#logger.debug("[FastMCP debug] server ping failed");
              } else if (logLevel === "warning") {
                this.#logger.warn(
                  "[FastMCP warning] server is not responding to ping",
                );
              }
            }
          }, pingConfig.interval);
        }
      }

      this.#connectionState = "ready";

      this.emit("ready");
    } catch (error) {
      this.#connectionState = "error";

      this.emit("error", { error: error as Error });

      throw error;
    }
  }

  public async waitForReady(): Promise<void> {
    if (this.#connectionState === "ready") {
      return;
    }

    return new Promise((resolve, reject) => {
      const onReady = () => {
        this.off("error", onError);
        resolve();
      };

      const onError = (event: { error: Error }) => {
        this.off("ready", onReady);
        reject(event.error);
      };

      this.once("ready", onReady);
      this.once("error", onError);
    });
  }

  private addPrompt(prompt: Prompt<T>) {
    this.#prompts.push(prompt);
  }

  private addResource(resource: Resource<T>) {
    this.#resources.push(resource);
  }

  private addResourceTemplate(resourceTemplate: InputResourceTemplate<T>) {
    const template: ResourceTemplate<T> = {
      ...resourceTemplate,
      uriTemplate: resourceTemplate.uriTemplate,
    };

    this.#resourceTemplates.push(template);
  }

  #getPingConfig(_transport: Transport): {
    enabled: boolean;
    interval: number;
    logLevel: "debug" | "warning" | "none";
  } {
    if (!this.#pingConfig) {
      return {
        enabled: false,
        interval: 30000,
        logLevel: "none",
      };
    }

    return this.#pingConfig;
  }
}
