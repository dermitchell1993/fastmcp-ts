#!/usr/bin/env node

import { FastMCP } from "../FastMCP.js";
import { ConfigManager } from './config/index.js';
import { NotionTools, registerNotionTools } from './tools/notion.js';
import { LinearTools, registerLinearTools } from './tools/linear.js';
import { SlackTools, registerSlackTools } from './tools/slack.js';
import { TaskScoreEngine } from './engine/taskScore.js';
import { FunnelAutomationEngine } from './engine/funnel.js';
import { CoherenceEngine } from './engine/coherence.js';
import { OpportunitiesEngine } from './engine/opportunities.js';
import { AutomationScheduler } from './scheduler/index.js';
import { ValkeyCache } from './cache/valkey.js';

/**
 * PARA Automation Agent - Central coordination system for productivity management
 *
 * This MCP server provides tools for:
 * - Querying Notion databases for tasks, projects, and notes
 * - Calculating Task Scores based on Amplenote-style ranking
 * - Automating PARA funnel transitions (Jots → Tasks → Projects → Areas → Resources → Archives)
 * - Maintaining database coherence across platforms
 * - Identifying strategic opportunities
 * - Sending periodic summaries via Slack
 * - Integrating with Linear for issue management
 */

// Initialize configuration
const configManager = new ConfigManager();
const config = configManager.getConfig();

// Validate configuration
const validation = configManager.validateConfig();
if (!validation.valid) {
  console.error('Configuration validation failed:');
  validation.errors.forEach(error => console.error(`- ${error}`));
  console.error('\nRequired environment variables:');
  configManager.getRequiredEnvVars().forEach(env => console.log(`- ${env}`));
  process.exit(1);
}

// Initialize Valkey cache
const valkeyCache = new ValkeyCache(config.valkey);
await valkeyCache.connect().catch(error => {
  console.warn('Failed to connect to Valkey cache:', error.message);
  console.warn('Continuing without caching...');
});

// Initialize tools and engines
const notionTools = new NotionTools(config.notion, valkeyCache);
const linearTools = new LinearTools(config.linear, valkeyCache);
const slackTools = new SlackTools(config.slack, valkeyCache);

const taskScoreEngine = new TaskScoreEngine(undefined, config.valkey);
const funnelEngine = new FunnelAutomationEngine(notionTools, linearTools);
const coherenceEngine = new CoherenceEngine(notionTools, linearTools);
const opportunitiesEngine = new OpportunitiesEngine();

const scheduler = new AutomationScheduler(
  config.scheduler,
  taskScoreEngine,
  funnelEngine,
  coherenceEngine,
  opportunitiesEngine,
  slackTools,
  notionTools,
  linearTools
);

// Initialize MCP server
const server = new FastMCP({
  name: "para-automation-agent",
  version: "0.1.0",
  description: "PARA productivity automation system with Task Score calculation and cross-platform coordination"
});

// Register all tool sets
registerNotionTools(server, notionTools);
registerLinearTools(server, linearTools);
registerSlackTools(server, slackTools);

// Core PARA tools
server.addTool({
  name: "get_para_status",
  description: "Get the current status of the PARA automation system",
  parameters: {
    type: "object",
    properties: {},
    required: []
  },
  execute: async () => {
    const schedulerStatus = scheduler.getStatus();

    return {
      status: "active",
      message: "PARA automation agent is running and coordinating productivity systems.",
      features: [
        "Notion database integration",
        "Linear issue synchronization",
        "Task Score calculation",
        "PARA funnel automation",
        "Database coherence maintenance",
        "Strategic opportunities identification",
        "Slack summary notifications"
      ],
      scheduler: {
        isRunning: schedulerStatus.isRunning,
        lastRuns: schedulerStatus.lastRuns,
        config: schedulerStatus.config
      },
      integrations: {
        notion: config.notion.apiKey ? "configured" : "missing API key",
        linear: config.linear.apiKey ? "configured" : "missing API key",
        slack: config.slack.botToken ? "configured" : "missing bot token"
      }
    };
  }
});

server.addTool({
  name: "calculate_task_score",
  description: "Calculate Task Score for a specific item using Amplenote-style ranking with caching",
  parameters: {
    type: "object",
    properties: {
      itemId: {
        type: "string",
        description: "ID of the item to score"
      },
      itemType: {
        type: "string",
        enum: ["task", "project"],
        description: "Type of item to score"
      },
      includeContext: {
        type: "boolean",
        description: "Whether to include related items context for scoring",
        default: true
      }
    },
    required: ["itemId", "itemType"]
  },
  execute: async ({ itemId, itemType, includeContext }) => {
    try {
      // This would need to fetch the actual item data from Notion/Linear
      // For now, return a mock score with caching
      const mockScore = await taskScoreEngine.calculateTaskScore({
        id: itemId,
        title: "Sample Task",
        description: "Task description",
        stage: "tasks",
        priority: 5,
        tags: ["sample"],
        createdAt: new Date(),
        updatedAt: new Date(),
        source: "notion",
        sourceId: itemId
      });

      return {
        itemId,
        itemType,
        score: mockScore.totalScore,
        colorCode: mockScore.colorCode,
        breakdown: mockScore.breakdown,
        factors: mockScore.factors,
        lastCalculated: mockScore.lastCalculated,
        cached: true // Indicate this came from cache or was cached
      };
    } catch (error) {
      return { error: `Failed to calculate task score: ${error.message}` };
    }
  }
});

server.addTool({
  name: "run_funnel_automation",
  description: "Manually trigger PARA funnel automation to move items between stages",
  parameters: {
    type: "object",
    properties: {
      dryRun: {
        type: "boolean",
        description: "If true, only report what would be moved without making changes",
        default: false
      }
    }
  },
  execute: async ({ dryRun }) => {
    try {
      const run = await scheduler.triggerRun('funnel');
      return {
        success: run.success,
        timestamp: run.timestamp,
        duration: run.duration,
        results: run.results,
        dryRun,
        error: run.error
      };
    } catch (error) {
      return { error: `Failed to run funnel automation: ${error.message}` };
    }
  }
});

server.addTool({
  name: "check_database_coherence",
  description: "Check and fix database coherence issues across platforms",
  parameters: {
    type: "object",
    properties: {
      autoFix: {
        type: "boolean",
        description: "Whether to automatically fix found issues",
        default: false
      }
    }
  },
  execute: async ({ autoFix }) => {
    try {
      const run = await scheduler.triggerRun('coherence');
      return {
        success: run.success,
        timestamp: run.timestamp,
        duration: run.duration,
        results: run.results,
        autoFix,
        error: run.error
      };
    } catch (error) {
      return { error: `Failed to check coherence: ${error.message}` };
    }
  }
});

server.addTool({
  name: "analyze_strategic_opportunities",
  description: "Analyze the PARA database for strategic opportunities and building blocks",
  parameters: {
    type: "object",
    properties: {}
  },
  execute: async () => {
    try {
      const run = await scheduler.triggerRun('opportunities');
      return {
        success: run.success,
        timestamp: run.timestamp,
        duration: run.duration,
        results: run.results,
        error: run.error
      };
    } catch (error) {
      return { error: `Failed to analyze opportunities: ${error.message}` };
    }
  }
});

server.addTool({
  name: "send_manual_summary",
  description: "Manually trigger a PARA status summary to be sent via Slack",
  parameters: {
    type: "object",
    properties: {}
  },
  execute: async () => {
    try {
      const run = await scheduler.triggerRun('summary');
      return {
        success: run.success,
        timestamp: run.timestamp,
        duration: run.duration,
        results: run.results,
        error: run.error
      };
    } catch (error) {
      return { error: `Failed to send summary: ${error.message}` };
    }
  }
});

server.addTool({
  name: "get_scheduler_status",
  description: "Get the current status of the automation scheduler",
  parameters: {
    type: "object",
    properties: {}
  },
  execute: async () => {
    return scheduler.getStatus();
  }
});

server.addTool({
  name: "start_scheduler",
  description: "Start the automation scheduler for periodic runs",
  parameters: {
    type: "object",
    properties: {}
  },
  execute: async () => {
    try {
      scheduler.start();
      return {
        success: true,
        message: "PARA automation scheduler started",
        status: scheduler.getStatus()
      };
    } catch (error) {
      return { error: `Failed to start scheduler: ${error.message}` };
    }
  }
});

server.addTool({
  name: "stop_scheduler",
  description: "Stop the automation scheduler",
  parameters: {
    type: "object",
    properties: {}
  },
  execute: async () => {
    try {
      scheduler.stop();
      return {
        success: true,
        message: "PARA automation scheduler stopped"
      };
    } catch (error) {
      return { error: `Failed to stop scheduler: ${error.message}` };
    }
  }
});

// Start the scheduler automatically
scheduler.start();

console.log("🤖 PARA Automation Agent started successfully!");
console.log("Available tools:");
console.log("- Notion database queries and management");
console.log("- Linear issue synchronization");
console.log("- Task Score calculation");
console.log("- PARA funnel automation");
console.log("- Database coherence maintenance");
console.log("- Strategic opportunities analysis");
console.log("- Slack notifications and summaries");
console.log("- Periodic automation scheduling");

server.start();
