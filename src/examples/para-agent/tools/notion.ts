/**
 * Notion Integration Tools
 * Query databases, manage pages, and sync with PARA stages
 */

import { FastMCP } from "../../FastMCP.js";
import { PARATask, PARAProject, PARAResource, PARAStage } from '../types/para.js';
import { ValkeyCache } from '../cache/valkey.js';

export interface NotionConfig {
  apiKey: string;
  databaseIds: {
    jots: string;
    tasks: string;
    projects: string;
    areas: string;
    resources: string;
    archives: string;
  };
}

export class NotionTools {
  private config: NotionConfig;
  private cache: ValkeyCache;

  constructor(config: NotionConfig, cache?: ValkeyCache) {
    this.config = config;
    this.cache = cache || new ValkeyCache({
      host: 'localhost',
      port: 6379,
      db: 0,
      keyPrefix: 'para:notion:',
      ttl: {
        taskScores: 3600,
        apiResponses: 300,
        opportunities: 1800,
        coherence: 900
      },
      enabled: false // Disabled by default if not provided
    });
  }

  /**
   * Query Notion database for items at a specific PARA stage with caching
   */
  async queryStage(stage: PARAStage, filters?: any): Promise<any[]> {
    const databaseId = this.config.databaseIds[stage];
    if (!databaseId) {
      throw new Error(`No database configured for stage: ${stage}`);
    }

    // Check cache first
    const cacheKey = `stage:${stage}:${JSON.stringify(filters || {})}`;
    const cachedResult = await this.cache.getCachedAPIResponse('notion', { stage, filters });

    if (cachedResult) {
      return cachedResult;
    }

    // This would make actual Notion API calls
    // For now, return mock data structure
    const result = this.mockQueryDatabase(databaseId, stage, filters);

    // Cache the result
    await this.cache.cacheAPIResponse('notion', { stage, filters }, result);

    return result;
  }

  /**
   * Get a specific Notion page by ID
   */
  async getPage(pageId: string): Promise<any> {
    // Mock implementation
    return {
      id: pageId,
      properties: {
        title: "Sample Page",
        stage: "tasks",
        tags: ["urgent", "important"]
      },
      content: "Page content here..."
    };
  }

  /**
   * Update page properties
   */
  async updatePage(pageId: string, properties: any): Promise<void> {
    // Mock implementation - would update Notion page
    console.log(`Updating Notion page ${pageId} with properties:`, properties);
  }

  /**
   * Move page to different database (stage transition)
   */
  async moveToStage(pageId: string, newStage: PARAStage): Promise<void> {
    const newDatabaseId = this.config.databaseIds[newStage];
    // Mock implementation
    console.log(`Moving page ${pageId} to ${newStage} database: ${newDatabaseId}`);
  }

  /**
   * Convert Notion page to PARA task
   */
  notionPageToPARATask(page: any): PARATask {
    return {
      id: page.id,
      title: page.properties?.title || page.properties?.Name || "Untitled",
      description: page.properties?.description,
      stage: page.properties?.stage || 'tasks',
      priority: page.properties?.priority,
      tags: page.properties?.tags || [],
      createdAt: new Date(page.created_time),
      updatedAt: new Date(page.last_edited_time),
      dueDate: page.properties?.due_date ? new Date(page.properties.due_date) : undefined,
      dependencies: page.properties?.dependencies || [],
      blockers: page.properties?.blockers || [],
      crossAreaImpact: page.properties?.cross_area_impact || [],
      source: 'notion',
      sourceId: page.id,
      metadata: page.properties
    };
  }

  /**
   * Convert Notion page to PARA project
   */
  notionPageToPARAProject(page: any): PARAProject {
    return {
      id: page.id,
      title: page.properties?.title || page.properties?.Name || "Untitled",
      description: page.properties?.description,
      stage: page.properties?.stage || 'projects',
      tasks: page.properties?.tasks || [],
      areas: page.properties?.areas || [],
      priority: page.properties?.priority,
      tags: page.properties?.tags || [],
      createdAt: new Date(page.created_time),
      updatedAt: new Date(page.last_edited_time),
      dueDate: page.properties?.due_date ? new Date(page.properties.due_date) : undefined,
      progress: page.properties?.progress || 0,
      buildingBlocks: page.properties?.building_blocks || [],
      dependencies: page.properties?.dependencies || [],
      source: 'notion',
      sourceId: page.id,
      metadata: page.properties
    };
  }

  /**
   * Convert Notion page to PARA resource
   */
  notionPageToPARAResource(page: any): PARAResource {
    return {
      id: page.id,
      title: page.properties?.title || page.properties?.Name || "Untitled",
      description: page.properties?.description,
      type: page.properties?.type || 'note',
      content: page.properties?.content,
      url: page.properties?.url,
      tags: page.properties?.tags || [],
      createdAt: new Date(page.created_time),
      updatedAt: new Date(page.last_edited_time),
      lastAccessed: page.properties?.last_accessed ? new Date(page.properties.last_accessed) : undefined,
      accessCount: page.properties?.access_count || 0,
      relatedAreas: page.properties?.related_areas || [],
      source: 'notion',
      sourceId: page.id,
      metadata: page.properties
    };
  }

  // Mock implementations for development
  private mockQueryDatabase(databaseId: string, stage: PARAStage, filters?: any): any[] {
    // Return mock data based on stage
    const mockPages = [];

    switch (stage) {
      case 'jots':
        mockPages.push({
          id: 'jot-1',
          created_time: new Date().toISOString(),
          last_edited_time: new Date().toISOString(),
          properties: {
            title: 'Quick idea about productivity automation',
            stage: 'jots',
            tags: ['productivity', 'automation']
          }
        });
        break;

      case 'tasks':
        mockPages.push({
          id: 'task-1',
          created_time: new Date().toISOString(),
          last_edited_time: new Date().toISOString(),
          properties: {
            title: 'Implement Task Score calculation',
            description: 'Build the core algorithm for calculating task priorities',
            stage: 'tasks',
            priority: 8,
            tags: ['development', 'algorithm'],
            due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
            dependencies: [],
            blockers: ['task-2'],
            cross_area_impact: ['development', 'productivity']
          }
        });
        break;

      case 'projects':
        mockPages.push({
          id: 'project-1',
          created_time: new Date().toISOString(),
          last_edited_time: new Date().toISOString(),
          properties: {
            title: 'PARA Automation Agent',
            description: 'Central coordination system for productivity management',
            stage: 'projects',
            tasks: ['task-1', 'task-2'],
            areas: ['productivity', 'development'],
            priority: 9,
            tags: ['automation', 'productivity'],
            progress: 25,
            building_blocks: ['future-ai-integration']
          }
        });
        break;

      case 'resources':
        mockPages.push({
          id: 'resource-1',
          created_time: new Date().toISOString(),
          last_edited_time: new Date().toISOString(),
          properties: {
            title: 'Amplenote Task Score Documentation',
            type: 'link',
            url: 'https://www.amplenote.com/help/task-scoring',
            tags: ['reference', 'productivity'],
            access_count: 5,
            related_areas: ['productivity']
          }
        });
        break;
    }

    return mockPages;
  }
}

/**
 * Register Notion tools with FastMCP server
 */
export function registerNotionTools(server: FastMCP, notionTools: NotionTools) {
  server.addTool({
    name: "query_notion_stage",
    description: "Query Notion database for items at a specific PARA stage",
    parameters: {
      type: "object",
      properties: {
        stage: {
          type: "string",
          enum: ["jots", "tasks", "projects", "areas", "resources", "archives"],
          description: "PARA stage to query"
        },
        filters: {
          type: "object",
          description: "Optional filters to apply to the query"
        }
      },
      required: ["stage"]
    },
    execute: async ({ stage, filters }: { stage: PARAStage; filters?: any }) => {
      try {
        const results = await notionTools.queryStage(stage, filters);
        return {
          stage,
          count: results.length,
          items: results.map(page => ({
            id: page.id,
            title: page.properties?.title || page.properties?.Name,
            tags: page.properties?.tags || [],
            updated: page.last_edited_time
          }))
        };
      } catch (error) {
        return { error: `Failed to query ${stage}: ${error.message}` };
      }
    }
  });

  server.addTool({
    name: "move_notion_item",
    description: "Move a Notion item to a different PARA stage",
    parameters: {
      type: "object",
      properties: {
        itemId: {
          type: "string",
          description: "ID of the Notion item to move"
        },
        newStage: {
          type: "string",
          enum: ["jots", "tasks", "projects", "areas", "resources", "archives"],
          description: "New PARA stage for the item"
        }
      },
      required: ["itemId", "newStage"]
    },
    execute: async ({ itemId, newStage }: { itemId: string; newStage: PARAStage }) => {
      try {
        await notionTools.moveToStage(itemId, newStage);
        return {
          success: true,
          message: `Item ${itemId} moved to ${newStage}`,
          itemId,
          newStage
        };
      } catch (error) {
        return { error: `Failed to move item: ${error.message}` };
      }
    }
  });

  server.addTool({
    name: "update_notion_properties",
    description: "Update properties of a Notion item",
    parameters: {
      type: "object",
      properties: {
        itemId: {
          type: "string",
          description: "ID of the Notion item to update"
        },
        properties: {
          type: "object",
          description: "Properties to update on the item"
        }
      },
      required: ["itemId", "properties"]
    },
    execute: async ({ itemId, properties }: { itemId: string; properties: any }) => {
      try {
        await notionTools.updatePage(itemId, properties);
        return {
          success: true,
          message: `Updated properties for item ${itemId}`,
          itemId,
          updatedProperties: properties
        };
      } catch (error) {
        return { error: `Failed to update properties: ${error.message}` };
      }
    }
  });
}
