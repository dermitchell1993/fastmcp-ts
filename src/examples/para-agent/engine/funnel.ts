/**
 * PARA Funnel Automation Engine
 * Handles automatic movement of items between stages based on rules
 */

import { PARATask, PARAProject, PARAResource, PARAStage, PARADatabase } from '../types/para.js';
import { TaskScoreResult } from '../types/task.js';
import { NotionTools } from '../tools/notion.js';
import { LinearTools } from '../tools/linear.js';

export interface FunnelTransitionRule {
  fromStage: PARAStage;
  toStage: PARAStage;
  condition: (item: any, context: FunnelContext) => boolean;
  priority: number; // Higher priority rules are checked first
  description: string;
}

export interface FunnelContext {
  taskScore?: TaskScoreResult;
  relatedItems: {
    tasks: PARATask[];
    projects: PARAProject[];
    resources: PARAResource[];
  };
  ageInDays: number;
  hasDependencies: boolean;
  isBlocked: boolean;
  progress?: number;
  lastActivity?: Date;
}

export interface TransitionResult {
  itemId: string;
  fromStage: PARAStage;
  toStage: PARAStage;
  reason: string;
  timestamp: Date;
  success: boolean;
  error?: string;
}

export class FunnelAutomationEngine {
  private rules: FunnelTransitionRule[] = [];
  private notionTools: NotionTools;
  private linearTools: LinearTools;

  constructor(notionTools: NotionTools, linearTools: LinearTools) {
    this.notionTools = notionTools;
    this.linearTools = linearTools;
    this.initializeRules();
  }

  /**
   * Initialize the default transition rules
   */
  private initializeRules(): void {
    // Jots → Tasks: When jot has enough detail or age threshold
    this.addRule({
      fromStage: 'jots',
      toStage: 'tasks',
      condition: (item, context) => {
        // Promote if jot is detailed enough or old enough
        const hasDetail = item.description && item.description.length > 50;
        const isOld = context.ageInDays > 7;
        const hasTags = item.tags && item.tags.length > 0;
        return hasDetail || (isOld && hasTags);
      },
      priority: 10,
      description: "Promote detailed or aged jots to tasks"
    });

    // Tasks → Projects: When task becomes complex with subtasks
    this.addRule({
      fromStage: 'tasks',
      toStage: 'projects',
      condition: (item, context) => {
        // Promote if task has dependencies or is part of a larger effort
        return context.hasDependencies || (item.metadata?.subtasks?.length > 0);
      },
      priority: 8,
      description: "Promote complex tasks with dependencies to projects"
    });

    // Tasks/Projects → Archives: When completed
    this.addRule({
      fromStage: 'tasks',
      toStage: 'archives',
      condition: (item) => {
        return item.completedAt !== undefined || item.metadata?.status === 'completed';
      },
      priority: 15,
      description: "Archive completed tasks"
    });

    this.addRule({
      fromStage: 'projects',
      toStage: 'archives',
      condition: (item, context) => {
        return context.progress === 100 || item.completedAt !== undefined;
      },
      priority: 15,
      description: "Archive completed projects"
    });

    // Projects → Areas: When project becomes ongoing area of focus
    this.addRule({
      fromStage: 'projects',
      toStage: 'areas',
      condition: (item, context) => {
        // Promote if project has been active for a long time or has many related items
        const longRunning = context.ageInDays > 30;
        const hasManyTasks = context.relatedItems.tasks.length > 5;
        return longRunning && hasManyTasks;
      },
      priority: 5,
      description: "Promote long-running projects to areas"
    });

    // Resources → Archives: When outdated or unused
    this.addRule({
      fromStage: 'resources',
      toStage: 'archives',
      condition: (item, context) => {
        // Archive if not accessed recently and not linked to active items
        const notAccessedRecently = context.lastActivity &&
          (new Date().getTime() - context.lastActivity.getTime()) > (90 * 24 * 60 * 60 * 1000); // 90 days
        const noActiveLinks = context.relatedItems.tasks.length === 0 &&
                             context.relatedItems.projects.length === 0;
        return notAccessedRecently && noActiveLinks;
      },
      priority: 3,
      description: "Archive unused resources"
    });

    // Areas → Resources: When area becomes reference material
    this.addRule({
      fromStage: 'areas',
      toStage: 'resources',
      condition: (item, context) => {
        // Convert to resource if area has been inactive but still valuable
        const inactive = context.lastActivity &&
          (new Date().getTime() - context.lastActivity.getTime()) > (180 * 24 * 60 * 60 * 1000); // 6 months
        const hasResources = context.relatedItems.resources.length > 0;
        return inactive && hasResources;
      },
      priority: 2,
      description: "Convert inactive areas to resources"
    });
  }

  /**
   * Add a custom transition rule
   */
  addRule(rule: FunnelTransitionRule): void {
    this.rules.push(rule);
    // Sort by priority (highest first)
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Process all items in the database for potential transitions
   */
  async processFunnel(database: PARADatabase): Promise<TransitionResult[]> {
    const results: TransitionResult[] = [];

    // Process each stage in order
    const stages: PARAStage[] = ['jots', 'tasks', 'projects', 'areas', 'resources'];

    for (const stage of stages) {
      const items = this.getItemsForStage(database, stage);

      for (const item of items) {
        const result = await this.processItem(item, stage, database);
        if (result) {
          results.push(result);
        }
      }
    }

    return results;
  }

  /**
   * Process a single item for potential transition
   */
  private async processItem(
    item: any,
    currentStage: PARAStage,
    database: PARADatabase
  ): Promise<TransitionResult | null> {
    const context = this.buildContext(item, currentStage, database);

    // Find applicable rules for this stage
    const applicableRules = this.rules.filter(rule => rule.fromStage === currentStage);

    for (const rule of applicableRules) {
      if (rule.condition(item, context)) {
        // Attempt the transition
        const success = await this.executeTransition(item, rule.toStage);

        return {
          itemId: item.id,
          fromStage: currentStage,
          toStage: rule.toStage,
          reason: rule.description,
          timestamp: new Date(),
          success,
          error: success ? undefined : "Transition failed"
        };
      }
    }

    return null;
  }

  /**
   * Build context for transition evaluation
   */
  private buildContext(item: any, stage: PARAStage, database: PARADatabase): FunnelContext {
    const now = new Date();
    const createdAt = item.createdAt || new Date();
    const ageInDays = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

    // Find related items
    const relatedTasks = database.tasks.filter(t =>
      t.dependencies?.includes(item.id) ||
      t.blockers?.includes(item.id) ||
      item.dependencies?.includes(t.id)
    );

    const relatedProjects = database.projects.filter(p =>
      p.tasks?.includes(item.id) ||
      p.dependencies?.includes(item.id) ||
      item.tasks?.includes(p.id)
    );

    const relatedResources = database.resources.filter(r =>
      r.relatedAreas?.includes(item.id) ||
      item.resources?.includes(r.id)
    );

    return {
      relatedItems: {
        tasks: relatedTasks,
        projects: relatedProjects,
        resources: relatedResources
      },
      ageInDays,
      hasDependencies: (item.dependencies?.length > 0) || (item.tasks?.length > 0),
      isBlocked: relatedTasks.some(t => t.blockers?.includes(item.id)),
      progress: item.progress,
      lastActivity: item.updatedAt || item.lastAccessed
    };
  }

  /**
   * Execute the actual transition
   */
  private async executeTransition(item: any, newStage: PARAStage): Promise<boolean> {
    try {
      if (item.source === 'notion') {
        await this.notionTools.moveToStage(item.id, newStage);
      } else if (item.source === 'linear') {
        // For Linear, we might update state instead of moving databases
        const stateUpdate = this.mapPARAStageToLinearState(newStage);
        if (stateUpdate) {
          await this.linearTools.updateIssue(item.id, { state: stateUpdate });
        }
      }

      // Update local item
      item.stage = newStage;
      item.updatedAt = new Date();

      return true;
    } catch (error) {
      console.error(`Failed to transition item ${item.id} to ${newStage}:`, error);
      return false;
    }
  }

  /**
   * Get items for a specific stage from the database
   */
  private getItemsForStage(database: PARADatabase, stage: PARAStage): any[] {
    switch (stage) {
      case 'jots':
      case 'tasks':
        return database.tasks.filter(t => t.stage === stage);
      case 'projects':
        return database.projects.filter(p => p.stage === stage);
      case 'areas':
        return database.areas.filter(a => a.stage === stage);
      case 'resources':
        return database.resources.filter(r => r.stage === stage);
      default:
        return [];
    }
  }

  /**
   * Map PARA stage to Linear state (simplified)
   */
  private mapPARAStageToLinearState(stage: PARAStage): string | null {
    const stateMap: Partial<Record<PARAStage, string>> = {
      'jots': 'Backlog',
      'tasks': 'Todo',
      'archives': 'Done'
    };
    return stateMap[stage] || null;
  }

  /**
   * Get all transition rules
   */
  getRules(): FunnelTransitionRule[] {
    return [...this.rules];
  }

  /**
   * Add a custom rule
   */
  addCustomRule(rule: Omit<FunnelTransitionRule, 'priority'> & { priority?: number }): void {
    this.addRule({
      ...rule,
      priority: rule.priority || 1
    });
  }
}

