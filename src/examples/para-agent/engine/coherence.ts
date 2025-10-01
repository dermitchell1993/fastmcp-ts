/**
 * Database Coherence Maintenance Engine
 * Ensures consistency across PARA databases and platforms
 */

import { PARADatabase, CoherenceIssue, PARATask, PARAProject, PARAResource } from '../types/para.js';
import { NotionTools } from '../tools/notion.js';
import { LinearTools } from '../tools/linear.js';

export interface CoherenceCheck {
  name: string;
  description: string;
  check: (database: PARADatabase) => CoherenceIssue[];
  fix?: (issue: CoherenceIssue, database: PARADatabase) => Promise<boolean>;
  priority: number; // Higher = more critical
}

export interface CoherenceReport {
  timestamp: Date;
  totalIssues: number;
  issuesBySeverity: Record<'low' | 'medium' | 'high', number>;
  issuesByType: Record<string, number>;
  fixedIssues: number;
  remainingIssues: CoherenceIssue[];
}

export class CoherenceEngine {
  private checks: CoherenceCheck[] = [];
  private notionTools: NotionTools;
  private linearTools: LinearTools;

  constructor(notionTools: NotionTools, linearTools: LinearTools) {
    this.notionTools = notionTools;
    this.linearTools = linearTools;
    this.initializeChecks();
  }

  /**
   * Initialize standard coherence checks
   */
  private initializeChecks(): void {
    // Check for broken links/references
    this.addCheck({
      name: 'broken_links',
      description: 'Find items with references to non-existent items',
      priority: 8,
      check: (database) => {
        const issues: CoherenceIssue[] = [];

        // Check task dependencies
        database.tasks.forEach(task => {
          task.dependencies?.forEach(depId => {
            if (!this.itemExists(database, depId)) {
              issues.push({
                id: `broken-link-${task.id}-${depId}`,
                type: 'broken_link',
                severity: 'medium',
                description: `Task "${task.title}" references non-existent dependency "${depId}"`,
                affectedItems: [task.id],
                detectedAt: new Date()
              });
            }
          });
        });

        // Check project task references
        database.projects.forEach(project => {
          project.tasks?.forEach(taskId => {
            if (!database.tasks.find(t => t.id === taskId)) {
              issues.push({
                id: `broken-link-${project.id}-${taskId}`,
                type: 'broken_link',
                severity: 'high',
                description: `Project "${project.title}" references non-existent task "${taskId}"`,
                affectedItems: [project.id],
                detectedAt: new Date()
              });
            }
          });
        });

        return issues;
      },
      fix: async (issue, database) => {
        // Remove broken references
        const affectedItem = this.findItemById(database, issue.affectedItems[0]);
        if (!affectedItem) return false;

        if (affectedItem.dependencies) {
          affectedItem.dependencies = affectedItem.dependencies.filter(dep =>
            this.itemExists(database, dep)
          );
        }

        if ((affectedItem as any).tasks) {
          (affectedItem as any).tasks = (affectedItem as any).tasks.filter((taskId: string) =>
            database.tasks.find(t => t.id === taskId)
          );
        }

        // Update in source system
        if (affectedItem.source === 'notion') {
          await this.notionTools.updatePage(affectedItem.id, {
            dependencies: affectedItem.dependencies,
            tasks: (affectedItem as any).tasks
          });
        }

        return true;
      }
    });

    // Check for orphaned items
    this.addCheck({
      name: 'orphaned_items',
      description: 'Find items not referenced by any other items',
      priority: 5,
      check: (database) => {
        const issues: CoherenceIssue[] = [];
        const referencedIds = new Set<string>();

        // Collect all referenced IDs
        database.tasks.forEach(task => {
          task.dependencies?.forEach(dep => referencedIds.add(dep));
          task.blockers?.forEach(blocker => referencedIds.add(blocker));
        });

        database.projects.forEach(project => {
          project.tasks?.forEach(task => referencedIds.add(task));
          project.dependencies?.forEach(dep => referencedIds.add(dep));
        });

        database.areas.forEach(area => {
          area.projects?.forEach(project => referencedIds.add(project));
        });

        database.resources.forEach(resource => {
          resource.relatedAreas?.forEach(area => referencedIds.add(area));
        });

        // Find orphaned tasks (not referenced and not referencing others)
        database.tasks.forEach(task => {
          const isReferenced = referencedIds.has(task.id);
          const hasReferences = (task.dependencies?.length || 0) > 0 ||
                               (task.blockers?.length || 0) > 0;

          if (!isReferenced && !hasReferences && task.stage !== 'archives') {
            issues.push({
              id: `orphaned-${task.id}`,
              type: 'orphaned_item',
              severity: 'low',
              description: `Task "${task.title}" is not connected to any other items`,
              affectedItems: [task.id],
              suggestedFix: 'Consider archiving or connecting to related items',
              detectedAt: new Date()
            });
          }
        });

        return issues;
      }
    });

    // Check for inconsistent tagging
    this.addCheck({
      name: 'inconsistent_tags',
      description: 'Find items with inconsistent or duplicate tags',
      priority: 4,
      check: (database) => {
        const issues: CoherenceIssue[] = [];
        const tagCounts: Record<string, number> = {};

        // Count tag usage
        [...database.tasks, ...database.projects, ...database.areas, ...database.resources]
          .forEach(item => {
            item.tags?.forEach(tag => {
              tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            });
          });

        // Find items with very similar tags (potential duplicates)
        const tags = Object.keys(tagCounts);
        for (let i = 0; i < tags.length; i++) {
          for (let j = i + 1; j < tags.length; j++) {
            const similarity = this.calculateTagSimilarity(tags[i], tags[j]);
            if (similarity > 0.8) {
              issues.push({
                id: `similar-tags-${tags[i]}-${tags[j]}`,
                type: 'inconsistent_tags',
                severity: 'low',
                description: `Similar tags found: "${tags[i]}" and "${tags[j]}" (similarity: ${(similarity * 100).toFixed(0)}%)`,
                affectedItems: [], // Would need to find items with these tags
                suggestedFix: 'Consider standardizing tag names',
                detectedAt: new Date()
              });
            }
          }
        }

        return issues;
      }
    });

    // Check for missing metadata standardization
    this.addCheck({
      name: 'missing_metadata',
      description: 'Find items missing required metadata fields',
      priority: 6,
      check: (database) => {
        const issues: CoherenceIssue[] = [];

        database.tasks.forEach(task => {
          if (!task.priority) {
            issues.push({
              id: `missing-priority-${task.id}`,
              type: 'missing_metadata',
              severity: 'low',
              description: `Task "${task.title}" is missing priority`,
              affectedItems: [task.id],
              suggestedFix: 'Set a priority level (1-10)',
              detectedAt: new Date()
            });
          }
        });

        database.projects.forEach(project => {
          if (!project.progress) {
            issues.push({
              id: `missing-progress-${project.id}`,
              type: 'missing_metadata',
              severity: 'medium',
              description: `Project "${project.title}" is missing progress tracking`,
              affectedItems: [project.id],
              suggestedFix: 'Set progress percentage (0-100)',
              detectedAt: new Date()
            });
          }
        });

        return issues;
      }
    });
  }

  /**
   * Add a custom coherence check
   */
  addCheck(check: CoherenceCheck): void {
    this.checks.push(check);
    // Sort by priority (highest first)
    this.checks.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Run all coherence checks on the database
   */
  async runChecks(database: PARADatabase): Promise<CoherenceReport> {
    const allIssues: CoherenceIssue[] = [];

    for (const check of this.checks) {
      const issues = check.check(database);
      allIssues.push(...issues);
    }

    const issuesBySeverity = {
      low: allIssues.filter(i => i.severity === 'low').length,
      medium: allIssues.filter(i => i.severity === 'medium').length,
      high: allIssues.filter(i => i.severity === 'high').length
    };

    const issuesByType: Record<string, number> = {};
    allIssues.forEach(issue => {
      issuesByType[issue.type] = (issuesByType[issue.type] || 0) + 1;
    });

    return {
      timestamp: new Date(),
      totalIssues: allIssues.length,
      issuesBySeverity,
      issuesByType,
      fixedIssues: 0, // Will be updated after fixes
      remainingIssues: allIssues
    };
  }

  /**
   * Attempt to fix coherence issues
   */
  async fixIssues(issues: CoherenceIssue[], database: PARADatabase): Promise<number> {
    let fixedCount = 0;

    for (const issue of issues) {
      const check = this.checks.find(c => c.name === issue.type.split('_')[0]);
      if (check?.fix) {
        try {
          const fixed = await check.fix(issue, database);
          if (fixed) {
            issue.resolvedAt = new Date();
            fixedCount++;
          }
        } catch (error) {
          console.error(`Failed to fix issue ${issue.id}:`, error);
        }
      }
    }

    return fixedCount;
  }

  /**
   * Check if an item exists in the database
   */
  private itemExists(database: PARADatabase, itemId: string): boolean {
    return !!this.findItemById(database, itemId);
  }

  /**
   * Find an item by ID across all collections
   */
  private findItemById(database: PARADatabase, itemId: string): any {
    return database.tasks.find(t => t.id === itemId) ||
           database.projects.find(p => p.id === itemId) ||
           database.areas.find(a => a.id === itemId) ||
           database.resources.find(r => r.id === itemId);
  }

  /**
   * Calculate similarity between two tag strings
   */
  private calculateTagSimilarity(tag1: string, tag2: string): number {
    const longer = tag1.length > tag2.length ? tag1 : tag2;
    const shorter = tag1.length > tag2.length ? tag2 : tag1;

    if (longer.length === 0) return 1.0;

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Get all coherence checks
   */
  getChecks(): CoherenceCheck[] {
    return [...this.checks];
  }
}

