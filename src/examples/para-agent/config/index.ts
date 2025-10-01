/**
 * Configuration management for PARA Automation Agent
 */

import { NotionConfig } from '../tools/notion.js';
import { LinearConfig } from '../tools/linear.js';
import { SlackConfig } from '../tools/slack.js';
import { SchedulerConfig } from '../scheduler/index.js';

export interface PARAConfig {
  // Tool configurations
  notion: NotionConfig;
  linear: LinearConfig;
  slack: SlackConfig;

  // Scheduler configuration
  scheduler: SchedulerConfig;

  // General settings
  timezone: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';

  // PARA-specific settings
  defaultStages: {
    jots: string; // Database ID
    tasks: string;
    projects: string;
    areas: string;
    resources: string;
    archives: string;
  };

  // Task score settings
  taskScore: {
    enabled: boolean;
    updateInterval: number; // hours
    decayEnabled: boolean;
  };

  // Integration settings
  integrations: {
    codegen: {
      enabled: boolean;
      webhookUrl?: string;
    };
    kiloCode: {
      enabled: boolean;
      apiUrl?: string;
    };
  };
}

export class ConfigManager {
  private config: PARAConfig;

  constructor(configPath?: string) {
    // Load from environment variables or config file
    this.config = this.loadConfig(configPath);
  }

  /**
   * Load configuration from environment variables and optional file
   */
  private loadConfig(configPath?: string): PARAConfig {
    // Default configuration
    const defaultConfig: PARAConfig = {
      notion: {
        apiKey: process.env.NOTION_API_KEY || '',
        databaseIds: {
          jots: process.env.NOTION_JOTS_DB || '',
          tasks: process.env.NOTION_TASKS_DB || '',
          projects: process.env.NOTION_PROJECTS_DB || '',
          areas: process.env.NOTION_AREAS_DB || '',
          resources: process.env.NOTION_RESOURCES_DB || '',
          archives: process.env.NOTION_ARCHIVES_DB || ''
        }
      },
      linear: {
        apiKey: process.env.LINEAR_API_KEY || '',
        teamId: process.env.LINEAR_TEAM_ID,
        projectIds: {}
      },
      slack: {
        botToken: process.env.SLACK_BOT_TOKEN || '',
        channelId: process.env.SLACK_CHANNEL_ID || '',
        userId: process.env.SLACK_USER_ID
      },
      scheduler: {
        funnelCheckInterval: 6,
        coherenceCheckInterval: 24,
        summaryInterval: 24,
        opportunitiesAnalysisInterval: 12,
        enableFunnelAutomation: true,
        enableCoherenceChecks: true,
        enableSummaries: true,
        enableOpportunitiesAnalysis: true,
        preferredSummaryHour: 9,
        timezone: process.env.TZ || 'UTC'
      },
      timezone: process.env.TZ || 'UTC',
      logLevel: (process.env.LOG_LEVEL as any) || 'info',
      defaultStages: {
        jots: process.env.NOTION_JOTS_DB || '',
        tasks: process.env.NOTION_TASKS_DB || '',
        projects: process.env.NOTION_PROJECTS_DB || '',
        areas: process.env.NOTION_AREAS_DB || '',
        resources: process.env.NOTION_RESOURCES_DB || '',
        archives: process.env.NOTION_ARCHIVES_DB || ''
      },
      taskScore: {
        enabled: true,
        updateInterval: 12,
        decayEnabled: true
      },
      integrations: {
        codegen: {
          enabled: false
        },
        kiloCode: {
          enabled: false
        }
      }
    };

    // TODO: Load from config file if provided
    // For now, return default config
    return defaultConfig;
  }

  /**
   * Get the full configuration
   */
  getConfig(): PARAConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<PARAConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Validate configuration
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required API keys
    if (!this.config.notion.apiKey) {
      errors.push('Notion API key is required');
    }

    if (!this.config.slack.botToken) {
      errors.push('Slack bot token is required');
    }

    // Check database IDs
    Object.entries(this.config.notion.databaseIds).forEach(([stage, id]) => {
      if (!id) {
        errors.push(`Notion database ID for ${stage} is required`);
      }
    });

    if (!this.config.slack.channelId) {
      errors.push('Slack channel ID is required');
    }

    // Validate scheduler intervals
    if (this.config.scheduler.funnelCheckInterval < 1) {
      errors.push('Funnel check interval must be at least 1 hour');
    }

    if (this.config.scheduler.summaryInterval < 1) {
      errors.push('Summary interval must be at least 1 hour');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get environment variables needed for this configuration
   */
  getRequiredEnvVars(): string[] {
    return [
      'NOTION_API_KEY',
      'NOTION_JOTS_DB',
      'NOTION_TASKS_DB',
      'NOTION_PROJECTS_DB',
      'NOTION_AREAS_DB',
      'NOTION_RESOURCES_DB',
      'NOTION_ARCHIVES_DB',
      'SLACK_BOT_TOKEN',
      'SLACK_CHANNEL_ID',
      'LINEAR_API_KEY', // Optional but recommended
      'TZ' // Optional
    ];
  }

  /**
   * Export configuration as environment variables
   */
  exportAsEnvVars(): Record<string, string> {
    return {
      NOTION_API_KEY: this.config.notion.apiKey,
      NOTION_JOTS_DB: this.config.notion.databaseIds.jots,
      NOTION_TASKS_DB: this.config.notion.databaseIds.tasks,
      NOTION_PROJECTS_DB: this.config.notion.databaseIds.projects,
      NOTION_AREAS_DB: this.config.notion.databaseIds.areas,
      NOTION_RESOURCES_DB: this.config.notion.databaseIds.resources,
      NOTION_ARCHIVES_DB: this.config.notion.databaseIds.archives,
      SLACK_BOT_TOKEN: this.config.slack.botToken,
      SLACK_CHANNEL_ID: this.config.slack.channelId,
      SLACK_USER_ID: this.config.slack.userId || '',
      LINEAR_API_KEY: this.config.linear.apiKey,
      LINEAR_TEAM_ID: this.config.linear.teamId || '',
      TZ: this.config.timezone,
      LOG_LEVEL: this.config.logLevel
    };
  }
}

