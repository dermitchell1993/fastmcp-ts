/**
 * Periodic Automation Scheduler
 * Handles scheduled runs of PARA automation processes
 */

import { PARADatabase } from '../types/para.js';
import { PARAStatusSummary } from '../tools/slack.js';
import { TaskScoreEngine } from '../engine/taskScore.js';
import { FunnelAutomationEngine } from '../engine/funnel.js';
import { CoherenceEngine } from '../engine/coherence.js';
import { OpportunitiesEngine } from '../engine/opportunities.js';
import { SlackTools } from '../tools/slack.js';
import { NotionTools } from '../tools/notion.js';
import { LinearTools } from '../tools/linear.js';

export interface SchedulerConfig {
  // Schedule intervals (in hours)
  funnelCheckInterval: number; // How often to check for funnel transitions
  coherenceCheckInterval: number; // How often to check database coherence
  summaryInterval: number; // How often to send summaries
  opportunitiesAnalysisInterval: number; // How often to analyze opportunities

  // Enabled features
  enableFunnelAutomation: boolean;
  enableCoherenceChecks: boolean;
  enableSummaries: boolean;
  enableOpportunitiesAnalysis: boolean;

  // Time preferences
  preferredSummaryHour: number; // Hour of day for summaries (0-23)
  timezone: string; // Timezone for scheduling
}

export interface SchedulerRun {
  timestamp: Date;
  type: 'funnel' | 'coherence' | 'summary' | 'opportunities';
  success: boolean;
  results: any;
  duration: number; // in milliseconds
  error?: string;
}

export class AutomationScheduler {
  private config: SchedulerConfig;
  private lastRuns: Map<string, Date> = new Map();
  private isRunning: boolean = false;

  // Engine instances
  private taskScoreEngine: TaskScoreEngine;
  private funnelEngine: FunnelAutomationEngine;
  private coherenceEngine: CoherenceEngine;
  private opportunitiesEngine: OpportunitiesEngine;
  private slackTools: SlackTools;
  private notionTools: NotionTools;
  private linearTools: LinearTools;

  constructor(
    config: Partial<SchedulerConfig>,
    taskScoreEngine: TaskScoreEngine,
    funnelEngine: FunnelAutomationEngine,
    coherenceEngine: CoherenceEngine,
    opportunitiesEngine: OpportunitiesEngine,
    slackTools: SlackTools,
    notionTools: NotionTools,
    linearTools: LinearTools
  ) {
    this.config = {
      funnelCheckInterval: 6, // 6 hours
      coherenceCheckInterval: 24, // daily
      summaryInterval: 24, // daily
      opportunitiesAnalysisInterval: 12, // twice daily
      enableFunnelAutomation: true,
      enableCoherenceChecks: true,
      enableSummaries: true,
      enableOpportunitiesAnalysis: true,
      preferredSummaryHour: 9, // 9 AM
      timezone: 'UTC',
      ...config
    };

    this.taskScoreEngine = taskScoreEngine;
    this.funnelEngine = funnelEngine;
    this.coherenceEngine = coherenceEngine;
    this.opportunitiesEngine = opportunitiesEngine;
    this.slackTools = slackTools;
    this.notionTools = notionTools;
    this.linearTools = linearTools;
  }

  /**
   * Start the scheduler (call this once to begin automated runs)
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    console.log('PARA Automation Scheduler started');

    // Run initial checks
    this.runAllChecks();

    // Set up periodic checks
    this.scheduleNextRun();
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    this.isRunning = false;
    console.log('PARA Automation Scheduler stopped');
  }

  /**
   * Manually trigger a specific type of run
   */
  async triggerRun(type: 'funnel' | 'coherence' | 'summary' | 'opportunities'): Promise<SchedulerRun> {
    const startTime = Date.now();

    try {
      let results: any = null;

      switch (type) {
        case 'funnel':
          results = await this.runFunnelAutomation();
          break;
        case 'coherence':
          results = await this.runCoherenceChecks();
          break;
        case 'summary':
          results = await this.runSummaryGeneration();
          break;
        case 'opportunities':
          results = await this.runOpportunitiesAnalysis();
          break;
      }

      this.lastRuns.set(type, new Date());

      return {
        timestamp: new Date(),
        type,
        success: true,
        results,
        duration: Date.now() - startTime
      };

    } catch (error) {
      return {
        timestamp: new Date(),
        type,
        success: false,
        results: null,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Run all enabled checks immediately
   */
  async runAllChecks(): Promise<SchedulerRun[]> {
    const runs: SchedulerRun[] = [];

    if (this.config.enableFunnelAutomation) {
      runs.push(await this.triggerRun('funnel'));
    }

    if (this.config.enableCoherenceChecks) {
      runs.push(await this.triggerRun('coherence'));
    }

    if (this.config.enableOpportunitiesAnalysis) {
      runs.push(await this.triggerRun('opportunities'));
    }

    if (this.config.enableSummaries) {
      runs.push(await this.triggerRun('summary'));
    }

    return runs;
  }

  /**
   * Check if it's time for a specific type of run
   */
  private shouldRun(type: string): boolean {
    const lastRun = this.lastRuns.get(type);
    if (!lastRun) return true;

    const now = new Date();
    const hoursSinceLastRun = (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60);

    const intervals = {
      funnel: this.config.funnelCheckInterval,
      coherence: this.config.coherenceCheckInterval,
      summary: this.config.summaryInterval,
      opportunities: this.config.opportunitiesAnalysisInterval
    };

    return hoursSinceLastRun >= intervals[type as keyof typeof intervals];
  }

  /**
   * Schedule the next automated run
   */
  private scheduleNextRun(): void {
    if (!this.isRunning) return;

    // Check all enabled runs
    const enabledRuns = [];
    if (this.config.enableFunnelAutomation) enabledRuns.push('funnel');
    if (this.config.enableCoherenceChecks) enabledRuns.push('coherence');
    if (this.config.enableSummaries) enabledRuns.push('summary');
    if (this.config.enableOpportunitiesAnalysis) enabledRuns.push('opportunities');

    // Find the next run due
    let nextRunType: string | null = null;
    let shortestWait = Infinity;

    for (const type of enabledRuns) {
      if (this.shouldRun(type)) {
        nextRunType = type;
        shortestWait = 0; // Run immediately
        break;
      } else {
        const lastRun = this.lastRuns.get(type)!;
        const interval = this.getIntervalForType(type);
        const nextRunTime = lastRun.getTime() + (interval * 60 * 60 * 1000);
        const waitTime = nextRunTime - Date.now();

        if (waitTime < shortestWait) {
          shortestWait = waitTime;
          nextRunType = type;
        }
      }
    }

    if (nextRunType && shortestWait >= 0) {
      const waitMs = Math.max(shortestWait, 1000); // Minimum 1 second delay

      setTimeout(async () => {
        if (this.isRunning) {
          await this.triggerRun(nextRunType as any);
          this.scheduleNextRun(); // Schedule the next one
        }
      }, waitMs);
    }
  }

  private getIntervalForType(type: string): number {
    const intervals = {
      funnel: this.config.funnelCheckInterval,
      coherence: this.config.coherenceCheckInterval,
      summary: this.config.summaryInterval,
      opportunities: this.config.opportunitiesAnalysisInterval
    };
    return intervals[type as keyof typeof intervals];
  }

  /**
   * Run funnel automation
   */
  private async runFunnelAutomation(): Promise<any> {
    // This would need access to the full database
    // For now, return mock results
    console.log('Running funnel automation...');

    return {
      transitionsProcessed: 5,
      itemsMoved: [
        { count: 2, fromStage: 'jots', toStage: 'tasks' },
        { count: 1, fromStage: 'tasks', toStage: 'projects' },
        { count: 1, fromStage: 'projects', toStage: 'archives' }
      ]
    };
  }

  /**
   * Run coherence checks
   */
  private async runCoherenceChecks(): Promise<any> {
    // Mock coherence check results
    console.log('Running coherence checks...');

    return {
      totalIssues: 3,
      issuesBySeverity: { low: 2, medium: 1, high: 0 },
      fixedIssues: 2,
      remainingIssues: 1
    };
  }

  /**
   * Run opportunities analysis
   */
  private async runOpportunitiesAnalysis(): Promise<any> {
    // Mock opportunities analysis
    console.log('Analyzing strategic opportunities...');

    return {
      opportunitiesFound: 4,
      opportunitiesByType: {
        building_block: 1,
        near_completion: 1,
        cross_area_impact: 1,
        delegation_candidate: 1
      },
      totalPotentialValue: 85
    };
  }

  /**
   * Generate and send summary
   */
  private async runSummaryGeneration(): Promise<any> {
    // Run all checks to get current data
    const funnelResults = this.config.enableFunnelAutomation ? await this.runFunnelAutomation() : null;
    const coherenceResults = this.config.enableCoherenceChecks ? await this.runCoherenceChecks() : null;
    const opportunitiesResults = this.config.enableOpportunitiesAnalysis ? await this.runOpportunitiesAnalysis() : null;

    // Compile summary
    const summary: PARAStatusSummary = {
      itemsMoved: funnelResults?.itemsMoved || [],
      strategicOpportunities: opportunitiesResults ? [
        {
          type: 'building_block',
          title: 'Reusable Component Found',
          description: 'Completed project contains reusable automation patterns',
          affectedItems: 3
        },
        {
          type: 'delegation_candidate',
          title: 'Task Ready for Delegation',
          description: 'Well-defined task suitable for team member assignment',
          affectedItems: 1
        }
      ] : [],
      delegationTasks: [
        {
          title: 'API Integration Setup',
          reason: 'Well-documented requirements with clear acceptance criteria',
          estimatedEffort: '2-3 hours'
        }
      ],
      coherenceIssues: coherenceResults ? [
        {
          type: 'broken_links',
          count: coherenceResults.remainingIssues,
          severity: 'medium'
        }
      ] : []
    };

    // Send summary
    await this.slackTools.sendSummary(summary);

    console.log('Summary sent to Slack');

    return {
      summarySent: true,
      itemsMoved: summary.itemsMoved.length,
      opportunitiesIdentified: summary.strategicOpportunities.length,
      delegationTasks: summary.delegationTasks.length,
      coherenceIssues: summary.coherenceIssues.length
    };
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    lastRuns: Record<string, Date>;
    config: SchedulerConfig;
  } {
    const lastRuns: Record<string, Date> = {};
    this.lastRuns.forEach((date, type) => {
      lastRuns[type] = date;
    });

    return {
      isRunning: this.isRunning,
      lastRuns,
      config: this.config
    };
  }
}

