/**
 * Strategic Opportunities Identification Engine
 * Finds cross-area impacts, building blocks, and delegation candidates
 */

import { PARADatabase, StrategicOpportunity, PARAProject, PARATask } from '../types/para.js';
import { TaskScoreResult } from '../types/task.js';

export interface OpportunityAnalysis {
  opportunities: StrategicOpportunity[];
  analysisTimestamp: Date;
  totalPotentialValue: number;
  opportunitiesByType: Record<string, number>;
}

export class OpportunitiesEngine {
  /**
   * Analyze the database for strategic opportunities
   */
  analyzeOpportunities(database: PARADatabase, taskScores?: Map<string, TaskScoreResult>): OpportunityAnalysis {
    const opportunities: StrategicOpportunity[] = [];

    // Find building block opportunities
    opportunities.push(...this.findBuildingBlocks(database));

    // Find near-completion projects
    opportunities.push(...this.findNearCompletionProjects(database));

    // Find cross-area impact opportunities
    opportunities.push(...this.findCrossAreaImpacts(database));

    // Find high-dependency items
    opportunities.push(...this.findHighDependencyItems(database));

    // Find delegation candidates
    opportunities.push(...this.findDelegationCandidates(database, taskScores));

    // Calculate total potential value
    const totalPotentialValue = opportunities.reduce((sum, opp) => sum + opp.potentialValue, 0);

    // Count by type
    const opportunitiesByType: Record<string, number> = {};
    opportunities.forEach(opp => {
      opportunitiesByType[opp.type] = (opportunitiesByType[opp.type] || 0) + 1;
    });

    return {
      opportunities,
      analysisTimestamp: new Date(),
      totalPotentialValue,
      opportunitiesByType
    };
  }

  /**
   * Find projects that could serve as building blocks for other areas
   */
  private findBuildingBlocks(database: PARADatabase): StrategicOpportunity[] {
    const opportunities: StrategicOpportunity[] = [];

    database.projects.forEach(project => {
      if (project.stage === 'archives' || project.completedAt) {
        // Analyze completed projects for reusable components
        const reusableComponents = this.analyzeReusableComponents(project, database);

        if (reusableComponents.length > 0) {
          const affectedItems = this.findAffectedItems(project, database);

          opportunities.push({
            id: `building-block-${project.id}`,
            type: 'building_block',
            title: `Building Block: ${project.title}`,
            description: `Completed project "${project.title}" contains ${reusableComponents.length} reusable components that could accelerate ${affectedItems.length} other initiatives`,
            affectedItems: affectedItems.map(item => item.id),
            potentialValue: reusableComponents.length * 10 + affectedItems.length * 5, // Estimated value
            urgency: 'medium',
            detectedAt: new Date()
          });
        }
      }
    });

    return opportunities;
  }

  /**
   * Find projects that are close to completion and would unlock other initiatives
   */
  private findNearCompletionProjects(database: PARADatabase): StrategicOpportunity[] {
    const opportunities: StrategicOpportunity[] = [];

    database.projects.forEach(project => {
      if (project.stage !== 'archives' && !project.completedAt) {
        const progress = project.progress || 0;
        const dependencies = project.dependencies || [];

        // Projects with high progress (>80%) that block other items
        if (progress > 80) {
          const blockedItems = this.findBlockedItems(project.id, database);

          if (blockedItems.length > 0) {
            opportunities.push({
              id: `near-completion-${project.id}`,
              type: 'near_completion',
              title: `Near Completion: ${project.title}`,
              description: `Project "${project.title}" is ${progress}% complete and would unblock ${blockedItems.length} other initiatives upon completion`,
              affectedItems: blockedItems.map(item => item.id),
              potentialValue: blockedItems.length * 15, // High value for unblocking
              urgency: 'high',
              detectedAt: new Date()
            });
          }
        }
      }
    });

    return opportunities;
  }

  /**
   * Find items with significant cross-area impact
   */
  private findCrossAreaImpacts(database: PARADatabase): StrategicOpportunity[] {
    const opportunities: StrategicOpportunity[] = [];

    // Analyze tasks and projects for cross-area connections
    const allItems = [...database.tasks, ...database.projects];

    allItems.forEach(item => {
      const crossAreaImpact = item.crossAreaImpact || [];
      const relatedAreas = this.findRelatedAreas(item, database);

      const totalImpact = crossAreaImpact.length + relatedAreas.length;

      if (totalImpact >= 3) { // Significant cross-area impact
        const affectedItems = this.findAffectedItems(item, database);

        opportunities.push({
          id: `cross-area-${item.id}`,
          type: 'cross_area_impact',
          title: `Cross-Area Impact: ${item.title}`,
          description: `Item "${item.title}" impacts ${totalImpact} different areas and affects ${affectedItems.length} related items`,
          affectedItems: affectedItems.map(item => item.id),
          potentialValue: totalImpact * 8 + affectedItems.length * 3,
          urgency: totalImpact >= 5 ? 'high' : 'medium',
          detectedAt: new Date()
        });
      }
    });

    return opportunities;
  }

  /**
   * Find items with high dependency counts (bottlenecks)
   */
  private findHighDependencyItems(database: PARADatabase): StrategicOpportunity[] {
    const opportunities: StrategicOpportunity[] = [];

    // Count dependencies for each item
    const dependencyCounts: Record<string, number> = {};

    database.tasks.forEach(task => {
      task.dependencies?.forEach(dep => {
        dependencyCounts[dep] = (dependencyCounts[dep] || 0) + 1;
      });
    });

    database.projects.forEach(project => {
      project.dependencies?.forEach(dep => {
        dependencyCounts[dep] = (dependencyCounts[dep] || 0) + 1;
      });
    });

    // Find items with high dependency counts
    Object.entries(dependencyCounts).forEach(([itemId, count]) => {
      if (count >= 5) { // High dependency threshold
        const item = this.findItemById(database, itemId);
        if (item && item.stage !== 'archives') {
          opportunities.push({
            id: `high-dependency-${itemId}`,
            type: 'high_dependency',
            title: `Dependency Bottleneck: ${item.title}`,
            description: `Item "${item.title}" is blocking ${count} other items and needs attention`,
            affectedItems: [itemId], // Could expand to show dependent items
            potentialValue: count * 12, // High value for bottlenecks
            urgency: 'high',
            detectedAt: new Date()
          });
        }
      }
    });

    return opportunities;
  }

  /**
   * Find tasks/projects suitable for delegation
   */
  private findDelegationCandidates(
    database: PARADatabase,
    taskScores?: Map<string, TaskScoreResult>
  ): StrategicOpportunity[] {
    const opportunities: StrategicOpportunity[] = [];

    const allItems = [...database.tasks, ...database.projects];

    allItems.forEach(item => {
      if (item.stage !== 'archives' && !item.completedAt) {
        const score = taskScores?.get(item.id);
        const isDelegable = this.assessDelegability(item, score);

        if (isDelegable.suitable) {
          opportunities.push({
            id: `delegation-${item.id}`,
            type: 'delegation_candidate',
            title: `Delegation Candidate: ${item.title}`,
            description: `${item.title} is suitable for delegation. ${isDelegable.reason}`,
            affectedItems: [item.id],
            potentialValue: isDelegable.value,
            urgency: 'medium',
            detectedAt: new Date()
          });
        }
      }
    });

    return opportunities;
  }

  /**
   * Analyze reusable components in a completed project
   */
  private analyzeReusableComponents(project: PARAProject, database: PARADatabase): string[] {
    const components: string[] = [];

    // Look for patterns in task names, tags, etc.
    const tasks = database.tasks.filter(t => project.tasks?.includes(t.id));

    // Find common patterns
    const commonTags = this.findCommonTags(tasks);
    if (commonTags.length > 0) {
      components.push(`${commonTags.length} common processes/patterns`);
    }

    // Check for documentation or templates created
    const documentationTasks = tasks.filter(t =>
      t.tags?.some(tag => tag.toLowerCase().includes('doc')) ||
      t.title.toLowerCase().includes('document')
    );
    if (documentationTasks.length > 0) {
      components.push(`${documentationTasks.length} documentation/templates`);
    }

    // Check for tools or systems built
    const toolTasks = tasks.filter(t =>
      t.tags?.some(tag => tag.toLowerCase().includes('tool')) ||
      t.title.toLowerCase().includes('build') ||
      t.title.toLowerCase().includes('create')
    );
    if (toolTasks.length > 0) {
      components.push(`${toolTasks.length} tools/systems`);
    }

    return components;
  }

  /**
   * Find items that would be affected by completing/unblocking another item
   */
  private findAffectedItems(item: PARATask | PARAProject, database: PARADatabase): (PARATask | PARAProject)[] {
    const affected: (PARATask | PARAProject)[] = [];

    // Find items that depend on this item
    database.tasks.forEach(task => {
      if (task.dependencies?.includes(item.id)) {
        affected.push(task);
      }
    });

    database.projects.forEach(project => {
      if (project.dependencies?.includes(item.id)) {
        affected.push(project);
      }
    });

    // Find items in the same areas
    if (item.crossAreaImpact) {
      item.crossAreaImpact.forEach(area => {
        affected.push(...database.tasks.filter(t => t.crossAreaImpact?.includes(area)));
        affected.push(...database.projects.filter(p => p.areas?.includes(area)));
      });
    }

    return [...new Set(affected)]; // Remove duplicates
  }

  /**
   * Find items blocked by the given item
   */
  private findBlockedItems(itemId: string, database: PARADatabase): (PARATask | PARAProject)[] {
    const blocked: (PARATask | PARAProject)[] = [];

    database.tasks.forEach(task => {
      if (task.dependencies?.includes(itemId)) {
        blocked.push(task);
      }
    });

    database.projects.forEach(project => {
      if (project.dependencies?.includes(itemId)) {
        blocked.push(project);
      }
    });

    return blocked;
  }

  /**
   * Find areas related to an item
   */
  private findRelatedAreas(item: PARATask | PARAProject, database: PARADatabase): string[] {
    const areas = new Set<string>();

    // Direct area assignments
    if ((item as PARAProject).areas) {
      (item as PARAProject).areas?.forEach(area => areas.add(area));
    }

    // Cross-area impact
    item.crossAreaImpact?.forEach(area => areas.add(area));

    // Related items' areas
    const relatedItems = this.findAffectedItems(item, database);
    relatedItems.forEach(relatedItem => {
      if ((relatedItem as PARAProject).areas) {
        (relatedItem as PARAProject).areas?.forEach(area => areas.add(area));
      }
    });

    return Array.from(areas);
  }

  /**
   * Find an item by ID across all collections
   */
  private findItemById(database: PARADatabase, itemId: string): PARATask | PARAProject | null {
    return database.tasks.find(t => t.id === itemId) ||
           database.projects.find(p => p.id === itemId) ||
           null;
  }

  /**
   * Find common tags among a set of tasks
   */
  private findCommonTags(tasks: PARATask[]): string[] {
    if (tasks.length === 0) return [];

    const tagCounts: Record<string, number> = {};
    tasks.forEach(task => {
      task.tags?.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    // Return tags that appear in at least 50% of tasks
    const threshold = Math.ceil(tasks.length * 0.5);
    return Object.entries(tagCounts)
      .filter(([, count]) => count >= threshold)
      .map(([tag]) => tag);
  }

  /**
   * Assess if an item is suitable for delegation
   */
  private assessDelegability(
    item: PARATask | PARAProject,
    score?: TaskScoreResult
  ): { suitable: boolean; reason: string; value: number } {
    let suitable = false;
    let reason = '';
    let value = 0;

    // Check if item has clear deliverables and requirements
    const hasClearScope = item.description && item.description.length > 100;
    const hasTags = item.tags && item.tags.length > 0;

    // Check if it's not too critical (based on score or priority)
    const priority = item.priority || 5;
    const notTooCritical = priority < 8;

    // Check if it's well-defined but not too complex
    const complexity = this.assessComplexity(item);
    const wellDefined = complexity < 7; // Not too complex

    if (hasClearScope && hasTags && notTooCritical && wellDefined) {
      suitable = true;
      reason = 'Well-defined task with clear scope and appropriate complexity for delegation.';
      value = 20; // Base delegation value

      // Bonus for good task score
      if (score && score.colorCode === 'gold') {
        value += 10;
        reason += ' Task score indicates good delegation candidate.';
      }
    } else {
      reason = 'Item may not be suitable for delegation due to ';
      const reasons = [];
      if (!hasClearScope) reasons.push('unclear scope');
      if (!hasTags) reasons.push('missing categorization');
      if (!notTooCritical) reasons.push('high criticality');
      if (!wellDefined) reasons.push('high complexity');
      reason += reasons.join(', ') + '.';
    }

    return { suitable, reason, value };
  }

  /**
   * Assess complexity of an item (1-10 scale)
   */
  private assessComplexity(item: PARATask | PARAProject): number {
    let complexity = 5; // baseline

    // Factor in dependencies
    const depCount = item.dependencies?.length || 0;
    complexity += Math.min(depCount * 0.5, 2);

    // Factor in description length (more detailed = more complex)
    if (item.description) {
      const descLength = item.description.length;
      if (descLength > 500) complexity += 1;
      else if (descLength < 50) complexity -= 1;
    }

    // Factor in tags (more specialized tags = more complex)
    const tagCount = item.tags?.length || 0;
    complexity += Math.min(tagCount * 0.3, 1.5);

    return Math.max(1, Math.min(10, complexity));
  }
}

