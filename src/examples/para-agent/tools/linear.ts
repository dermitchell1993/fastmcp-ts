/**
 * Linear Integration Tools
 * Query issues, manage tasks, and sync with PARA stages
 */

import { FastMCP } from "../../FastMCP.js";
import { PARATask, PARAProject, PARAStage } from '../types/para.js';

export interface LinearConfig {
  apiKey: string;
  teamId?: string;
  projectIds?: Record<string, string>;
}

export class LinearTools {
  private config: LinearConfig;

  constructor(config: LinearConfig) {
    this.config = config;
  }

  /**
   * Query Linear issues by state/project
   */
  async queryIssues(filters?: {
    state?: string;
    project?: string;
    assignee?: string;
    priority?: number;
  }): Promise<any[]> {
    // Mock implementation - would use Linear GraphQL API
    return this.mockQueryIssues(filters);
  }

  /**
   * Get a specific Linear issue
   */
  async getIssue(issueId: string): Promise<any> {
    // Mock implementation
    return {
      id: issueId,
      title: "Sample Linear Issue",
      description: "Issue description",
      state: { name: "In Progress" },
      priority: 2,
      assignee: { name: "John Doe" },
      project: { name: "PARA Agent" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Update Linear issue
   */
  async updateIssue(issueId: string, updates: any): Promise<void> {
    // Mock implementation
    console.log(`Updating Linear issue ${issueId}:`, updates);
  }

  /**
   * Create subtasks from a project
   */
  async createSubtasks(projectId: string, subtasks: string[]): Promise<string[]> {
    // Mock implementation
    const createdIds = subtasks.map((_, i) => `subtask-${projectId}-${i + 1}`);
    console.log(`Created subtasks for project ${projectId}:`, createdIds);
    return createdIds;
  }

  /**
   * Convert Linear issue to PARA task
   */
  linearIssueToPARATask(issue: any): PARATask {
    return {
      id: issue.id,
      title: issue.title,
      description: issue.description,
      stage: this.mapLinearStateToPARAStage(issue.state?.name),
      priority: this.mapLinearPriorityToPARAPriority(issue.priority),
      tags: issue.labels?.map((l: any) => l.name) || [],
      createdAt: new Date(issue.createdAt),
      updatedAt: new Date(issue.updatedAt),
      dueDate: issue.dueDate ? new Date(issue.dueDate) : undefined,
      dependencies: [], // Would need to parse from description or custom fields
      blockers: [],
      crossAreaImpact: [],
      source: 'linear',
      sourceId: issue.id,
      metadata: {
        linearState: issue.state?.name,
        linearPriority: issue.priority,
        assignee: issue.assignee?.name,
        project: issue.project?.name
      }
    };
  }

  /**
   * Convert Linear project to PARA project
   */
  linearProjectToPARAProject(project: any): PARAProject {
    return {
      id: project.id,
      title: project.name,
      description: project.description,
      stage: 'projects',
      tasks: [], // Would query issues in this project
      areas: [],
      priority: 5, // Default priority
      tags: [],
      createdAt: new Date(project.createdAt),
      updatedAt: new Date(project.updatedAt),
      progress: project.progress || 0,
      buildingBlocks: [],
      dependencies: [],
      source: 'linear',
      sourceId: project.id,
      metadata: {
        linearState: project.state,
        lead: project.lead?.name
      }
    };
  }

  private mapLinearStateToPARAStage(stateName: string): PARAStage {
    const stateMap: Record<string, PARAStage> = {
      'Backlog': 'jots',
      'Todo': 'tasks',
      'In Progress': 'tasks',
      'In Review': 'tasks',
      'Done': 'archives',
      'Canceled': 'archives'
    };
    return stateMap[stateName] || 'tasks';
  }

  private mapLinearPriorityToPARAPriority(linearPriority: number): number {
    // Linear priority: 0 (No priority), 1 (Urgent), 2 (High), 3 (Medium), 4 (Low)
    // PARA priority: 1-10 scale
    const priorityMap = [5, 9, 7, 5, 3]; // Default to 5 for unknown
    return priorityMap[linearPriority] || 5;
  }

  private mockQueryIssues(filters?: any): any[] {
    return [
      {
        id: 'LIN-1',
        title: 'Implement Task Score calculation',
        description: 'Build the core algorithm for calculating task priorities based on Amplenote methodology',
        state: { name: 'In Progress' },
        priority: 2,
        assignee: { name: 'John Doe' },
        project: { name: 'PARA Agent' },
        labels: [{ name: 'development' }, { name: 'algorithm' }],
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'LIN-2',
        title: 'Set up Notion integration',
        description: 'Connect to Notion API for database synchronization',
        state: { name: 'Todo' },
        priority: 1,
        assignee: { name: 'Jane Smith' },
        project: { name: 'PARA Agent' },
        labels: [{ name: 'integration' }, { name: 'api' }],
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
  }
}

/**
 * Register Linear tools with FastMCP server
 */
export function registerLinearTools(server: FastMCP, linearTools: LinearTools) {
  server.addTool({
    name: "query_linear_issues",
    description: "Query Linear issues with optional filters",
    parameters: {
      type: "object",
      properties: {
        state: {
          type: "string",
          description: "Filter by issue state (e.g., 'In Progress', 'Todo')"
        },
        project: {
          type: "string",
          description: "Filter by project name"
        },
        assignee: {
          type: "string",
          description: "Filter by assignee name"
        },
        priority: {
          type: "number",
          description: "Filter by priority (1-4 in Linear scale)"
        }
      }
    },
    execute: async (filters: any) => {
      try {
        const issues = await linearTools.queryIssues(filters);
        return {
          count: issues.length,
          issues: issues.map(issue => ({
            id: issue.id,
            title: issue.title,
            state: issue.state?.name,
            priority: issue.priority,
            assignee: issue.assignee?.name,
            project: issue.project?.name,
            tags: issue.labels?.map((l: any) => l.name) || []
          }))
        };
      } catch (error) {
        return { error: `Failed to query Linear issues: ${error.message}` };
      }
    }
  });

  server.addTool({
    name: "update_linear_issue",
    description: "Update a Linear issue's properties",
    parameters: {
      type: "object",
      properties: {
        issueId: {
          type: "string",
          description: "ID of the Linear issue to update"
        },
        updates: {
          type: "object",
          description: "Updates to apply to the issue",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            state: { type: "string" },
            priority: { type: "number" },
            assigneeId: { type: "string" }
          }
        }
      },
      required: ["issueId", "updates"]
    },
    execute: async ({ issueId, updates }: { issueId: string; updates: any }) => {
      try {
        await linearTools.updateIssue(issueId, updates);
        return {
          success: true,
          message: `Updated Linear issue ${issueId}`,
          issueId,
          updates
        };
      } catch (error) {
        return { error: `Failed to update Linear issue: ${error.message}` };
      }
    }
  });

  server.addTool({
    name: "create_linear_subtasks",
    description: "Create subtasks for a Linear project",
    parameters: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "ID of the Linear project"
        },
        subtasks: {
          type: "array",
          items: { type: "string" },
          description: "List of subtask titles to create"
        }
      },
      required: ["projectId", "subtasks"]
    },
    execute: async ({ projectId, subtasks }: { projectId: string; subtasks: string[] }) => {
      try {
        const createdIds = await linearTools.createSubtasks(projectId, subtasks);
        return {
          success: true,
          message: `Created ${createdIds.length} subtasks for project ${projectId}`,
          projectId,
          subtasks: createdIds
        };
      } catch (error) {
        return { error: `Failed to create subtasks: ${error.message}` };
      }
    }
  });
}

