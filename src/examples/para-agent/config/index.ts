/**
 * Configuration management for PARA Automation Agent
 */

import { NotionConfig } from '../tools/notion.js';
import { LinearConfig } from '../tools/linear.js';
import { SlackConfig } from '../tools/slack.js';
import { SchedulerConfig } from '../scheduler/index.js';

export interface ValkeyConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
  ttl: {
    taskScores: number;      // Task score cache TTL in seconds
    apiResponses: number;    // API response cache TTL
    opportunities: number;   // Strategic opportunities cache TTL
    coherence: number;       // Coherence check results TTL
  };
  enabled: boolean;
}

export interface PARAConfig {
  // Tool configurations
  notion: NotionConfig;
  linear: LinearConfig;
  slack: SlackConfig;

  // Scheduler configuration
  scheduler: SchedulerConfig;

  // Caching configuration
  valkey: ValkeyConfig;

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
      valkey: {
        host: process.env.VALKEY_HOST || 'localhost',
        port: parseInt(process.env.VALKEY_PORT || '6379'),
        password: process.env.VALKEY_PASSWORD,
        db: parseInt(process.env.VALKEY_DB || '0'),
        keyPrefix: process.env.VALKEY_KEY_PREFIX || 'para:',
        ttl: {
          taskScores: parseInt(process.env.VALKEY_TTL_TASK_SCORES || '3600'), // 1 hour
          apiResponses: parseInt(process.env.VALKEY_TTL_API_RESPONSES || '300'), // 5 minutes
          opportunities: parseInt(process.env.VALKEY_TTL_OPPORTUNITIES || '1800'), // 30 minutes
          coherence: parseInt(process.env.VALKEY_TTL_COHERENCE || '900') // 15 minutes
        },
        enabled: process.env.VALKEY_ENABLED !== 'false'
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
    const required = [
      'NOTION_API_KEY',
      'NOTION_JOTS_DB',
      'NOTION_TASKS_DB',
      'NOTION_PROJECTS_DB',
      'NOTION_AREAS_DB',
      'NOTION_RESOURCES_DB',
      'NOTION_ARCHIVES_DB',
      'SLACK_BOT_TOKEN',
      'SLACK_CHANNEL_ID'
    ];

    // Add Valkey vars if enabled
    if (this.config.valkey.enabled) {
      required.push(
        'VALKEY_HOST',
        'VALKEY_PORT'
      );
    }

    // Optional vars
    const optional = [
      'LINEAR_API_KEY', // Optional but recommended
      'TZ', // Optional
      'VALKEY_PASSWORD', // Optional
      'VALKEY_DB', // Optional
      'VALKEY_KEY_PREFIX', // Optional
      'VALKEY_TTL_TASK_SCORES', // Optional
      'VALKEY_TTL_API_RESPONSES', // Optional
      'VALKEY_TTL_OPPORTUNITIES', // Optional
      'VALKEY_TTL_COHERENCE', // Optional
      'VALKEY_ENABLED' // Optional
    ];

    return [...required, ...optional];
  }

  /**
   * Export configuration as environment variables
   */
  exportAsEnvVars(): Record<string, string> {
    const envVars: Record<string, string> = {
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
      LOG_LEVEL: this.config.logLevel,
      VALKEY_ENABLED: this.config.valkey.enabled.toString(),
      VALKEY_HOST: this.config.valkey.host,
      VALKEY_PORT: this.config.valkey.port.toString(),
      VALKEY_DB: this.config.valkey.db.toString(),
      VALKEY_KEY_PREFIX: this.config.valkey.keyPrefix,
      VALKEY_TTL_TASK_SCORES: this.config.valkey.ttl.taskScores.toString(),
      VALKEY_TTL_API_RESPONSES: this.config.valkey.ttl.apiResponses.toString(),
      VALKEY_TTL_OPPORTUNITIES: this.config.valkey.ttl.opportunities.toString(),
      VALKEY_TTL_COHERENCE: this.config.valkey.ttl.coherence.toString()
    };

    // Add optional password if set
    if (this.config.valkey.password) {
      envVars.VALKEY_PASSWORD = this.config.valkey.password;
    }

    return envVars;
  }
}
