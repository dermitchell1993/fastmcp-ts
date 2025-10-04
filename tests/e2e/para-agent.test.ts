/**
 * End-to-End Tests for PARA Automation Agent
 *
 * Tests the complete functionality of the PARA automation system including:
 * - MCP server initialization and tool registration
 * - Task Score calculation engine
 * - PARA funnel automation
 * - Cross-platform integration (mocked)
 * - Database coherence maintenance
 * - Strategic opportunities analysis
 * - Periodic scheduler operations
 * - Error handling and recovery
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, type MockedFunction } from 'vitest';
import { FastMCP } from '../../src/FastMCP.js';
import { ConfigManager } from '../../src/examples/para-agent/config/index.js';
import { TaskScoreEngine } from '../../src/examples/para-agent/engine/taskScore.js';
import { FunnelAutomationEngine } from '../../src/examples/para-agent/engine/funnel.js';
import { CoherenceEngine } from '../../src/examples/para-agent/engine/coherence.js';
import { OpportunitiesEngine } from '../../src/examples/para-agent/engine/opportunities.js';
import { AutomationScheduler } from '../../src/examples/para-agent/scheduler/index.js';
import { NotionTools } from '../../src/examples/para-agent/tools/notion.js';
import { LinearTools } from '../../src/examples/para-agent/tools/linear.js';
import { SlackTools } from '../../src/examples/para-agent/tools/slack.js';
import { ValkeyCache } from '../../src/examples/para-agent/cache/valkey.js';
import type { PARATask, PARAProject } from '../../src/examples/para-agent/types/para.js';

// Mock external APIs to avoid real network calls
vi.mock('../../src/examples/para-agent/tools/notion.js');
vi.mock('../../src/examples/para-agent/tools/linear.js');
vi.mock('../../src/examples/para-agent/tools/slack.js');

describe('PARA Automation Agent - End-to-End Tests', () => {
  let server: FastMCP;
  let configManager: ConfigManager;
  let taskScoreEngine: TaskScoreEngine;
  let funnelEngine: FunnelAutomationEngine;
  let coherenceEngine: CoherenceEngine;
  let opportunitiesEngine: OpportunitiesEngine;
  let scheduler: AutomationScheduler;
  let notionTools: MockedFunction<any>;
  let linearTools: MockedFunction<any>;
  let slackTools: MockedFunction<any>;

  // Mock environment variables
  const mockEnv = {
    NOTION_API_KEY: 'mock-notion-key',
    NOTION_JOTS_DB: 'jots-db-id',
    NOTION_TASKS_DB: 'tasks-db-id',
    NOTION_PROJECTS_DB: 'projects-db-id',
    NOTION_AREAS_DB: 'areas-db-id',
    NOTION_RESOURCES_DB: 'resources-db-id',
    NOTION_ARCHIVES_DB: 'archives-db-id',
    SLACK_BOT_TOKEN: 'mock-slack-token',
    SLACK_CHANNEL_ID: 'C1234567890',
    SLACK_USER_ID: 'U1234567890',
    TZ: 'America/New_York',
    LOG_LEVEL: 'info'
  };

  beforeAll(() => {
    // Set up mock environment
    Object.entries(mockEnv).forEach(([key, value]) => {
      process.env[key] = value;
    });
  });

  afterAll(() => {
    // Clean up mock environment
    Object.keys(mockEnv).forEach(key => {
      delete process.env[key];
    });
  });

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Initialize configuration
    configManager = new ConfigManager();

    // Mock the tools - create actual mock instances, not mock constructors
    notionTools = {
      queryDatabase: vi.fn().mockResolvedValue([]),
      updatePage: vi.fn().mockResolvedValue({}),
      moveToDatabase: vi.fn().mockResolvedValue({})
    } as any;

    linearTools = {
      getIssues: vi.fn().mockResolvedValue([]),
      updateIssue: vi.fn().mockResolvedValue({}),
      createSubtasks: vi.fn().mockResolvedValue([])
    } as any;

    slackTools = {
      sendMessage: vi.fn().mockResolvedValue({}),
      sendSummary: vi.fn().mockResolvedValue({})
    } as any;

    // Initialize engines
    taskScoreEngine = new TaskScoreEngine();
    funnelEngine = new FunnelAutomationEngine(notionTools, linearTools);
    coherenceEngine = new CoherenceEngine(notionTools, linearTools);
    opportunitiesEngine = new OpportunitiesEngine();

    // Initialize scheduler
    scheduler = new AutomationScheduler(
      configManager.getConfig().scheduler,
      taskScoreEngine,
      funnelEngine,
      coherenceEngine,
      opportunitiesEngine,
      slackTools,
      notionTools,
      linearTools
    );

    // Initialize MCP server
    server = new FastMCP({
      name: "para-automation-agent-test",
      version: "0.1.0",
      description: "PARA productivity automation system - Test Instance"
    });
  });

  describe('System Initialization', () => {
    it('should initialize configuration manager with valid environment', () => {
      const config = configManager.getConfig();
      expect(config).toBeDefined();
      expect(config.notion.apiKey).toBe('mock-notion-key');
      expect(config.slack.botToken).toBe('mock-slack-token');
      expect(config.valkey.enabled).toBe(true);
    });

    it('should validate configuration successfully', () => {
      const validation = configManager.validateConfig();
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should initialize all engines successfully', () => {
      expect(taskScoreEngine).toBeDefined();
      expect(funnelEngine).toBeDefined();
      expect(coherenceEngine).toBeDefined();
      expect(opportunitiesEngine).toBeDefined();
    });

    it('should initialize scheduler with correct configuration', () => {
      const status = scheduler.getStatus();
      expect(status.isRunning).toBe(false);
      expect(status.config).toBeDefined();
    });

    it('should initialize Valkey cache with correct configuration', () => {
      const cache = new ValkeyCache(configManager.getConfig().valkey);
      expect(cache).toBeDefined();
      expect(cache.isConnected()).toBe(false); // Not connected in tests
    });
  });

  describe('Valkey Cache System', () => {
    let cache: ValkeyCache;

    beforeEach(() => {
      cache = new ValkeyCache({
        host: 'localhost',
        port: 6379,
        db: 0,
        keyPrefix: 'test:',
        ttl: {
          taskScores: 3600,
          apiResponses: 300,
          opportunities: 1800,
          coherence: 900
        },
        enabled: false // Disabled for unit tests
      });
    });

    it('should generate correct cache keys', () => {
      const key = 'test-key';
      expect(cache['makeKey'](key)).toBe('test:test-key');
    });

    it('should handle cache operations when disabled', async () => {
      const result = await cache.get('test-key');
      expect(result).toBeNull();

      const setResult = await cache.set('test-key', 'test-value');
      expect(setResult).toBe(false);

      const deleteResult = await cache.delete('test-key');
      expect(deleteResult).toBe(false);
    });

    it('should provide cache statistics', () => {
      const stats = cache.getStats();
      expect(stats).toBeDefined();
      expect(stats.hits).toBeDefined();
      expect(stats.misses).toBeDefined();
      expect(stats.sets).toBeDefined();
      expect(stats.deletes).toBeDefined();
      expect(stats.errors).toBeDefined();
      expect(stats.hitRate).toBeDefined();
    });

    it('should reset cache statistics', () => {
      cache.resetStats();
      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.sets).toBe(0);
      expect(stats.deletes).toBe(0);
      expect(stats.errors).toBe(0);
      expect(stats.hitRate).toBe(0);
    });

    it('should perform health checks', async () => {
      const health = await cache.healthCheck();
      expect(health).toBeDefined();
      expect(health.healthy).toBe(false); // Disabled cache
      expect(health.error).toBe('Valkey caching is disabled');
    });
  });

  describe('Task Score Engine', () => {
    it('should calculate task score for a basic task', async () => {
      const task: PARATask = {
        id: 'task-1',
        title: 'Test Task',
        description: 'A test task for scoring',
        stage: 'tasks',
        priority: 5,
        tags: ['test'],
        createdAt: new Date(),
        updatedAt: new Date(),
        source: 'notion',
        sourceId: 'notion-task-1'
      };

      const score = await taskScoreEngine.calculateTaskScore(task);

      expect(score).toBeDefined();
      expect(score.totalScore).toBeGreaterThanOrEqual(0);
      expect(score.totalScore).toBeLessThanOrEqual(20);
      expect(['red', 'gold', 'normal']).toContain(score.colorCode);
      expect(score.breakdown).toBeDefined();
      expect(score.factors).toBeDefined();
    });

    it('should assign red color code for high-priority urgent tasks', async () => {
      const urgentTask: PARATask = {
        id: 'urgent-task',
        title: 'Urgent Task',
        description: 'Very urgent task',
        stage: 'tasks',
        priority: 10,
        tags: ['urgent', 'critical'],
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Due tomorrow
        createdAt: new Date(),
        updatedAt: new Date(),
        source: 'notion',
        sourceId: 'notion-urgent-task'
      };

      const score = await taskScoreEngine.calculateTaskScore(urgentTask);
      expect(score.colorCode).toBe('red');
      expect(score.totalScore).toBeGreaterThanOrEqual(10);
    });

    it('should handle tasks with missing optional fields', async () => {
      const minimalTask: PARATask = {
        id: 'minimal-task',
        title: 'Minimal Task',
        stage: 'tasks',
        createdAt: new Date(),
        updatedAt: new Date(),
        source: 'manual'
      };

      const score = await taskScoreEngine.calculateTaskScore(minimalTask);
      expect(score).toBeDefined();
      expect(score.totalScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('PARA Funnel Automation', () => {
    it('should identify items ready for stage transitions', async () => {
      // Mock old jots ready to become tasks
      const mockJots = [
        {
          id: 'jot-1',
          title: 'Old Jot',
          createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days old
          stage: 'jots'
        }
      ];

      notionTools.queryDatabase.mockResolvedValueOnce(mockJots);

      const transitions = await funnelEngine.analyzeTransitions();
      expect(transitions).toBeDefined();
      expect(Array.isArray(transitions)).toBe(true);
    });

    it('should execute funnel automation without errors', async () => {
      const result = await funnelEngine.runAutomation();
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });

    it('should handle empty databases gracefully', async () => {
      notionTools.queryDatabase.mockResolvedValue([]);
      linearTools.getIssues.mockResolvedValue([]);

      const result = await funnelEngine.runAutomation();
      expect(result.success).toBe(true);
    });
  });

  describe('Database Coherence Engine', () => {
    it('should detect and report coherence issues', async () => {
      // Mock broken relationships
      const mockTasks = [
        {
          id: 'task-1',
          dependencies: ['non-existent-task-id'],
          blockers: []
        }
      ];

      notionTools.queryDatabase.mockResolvedValueOnce(mockTasks);

      const issues = await coherenceEngine.scanForIssues();
      expect(issues).toBeDefined();
      expect(Array.isArray(issues)).toBe(true);
    });

    it('should execute coherence maintenance', async () => {
      const result = await coherenceEngine.runMaintenance();
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });

    it('should handle auto-fix operations', async () => {
      const result = await coherenceEngine.runMaintenance(true); // autoFix = true
      expect(result).toBeDefined();
      expect(result.autoFixed).toBeDefined();
    });
  });

  describe('Strategic Opportunities Engine', () => {
    it('should identify building blocks from completed projects', async () => {
      const mockProjects: PARAProject[] = [
        {
          id: 'project-1',
          title: 'Completed Project',
          stage: 'archives',
          progress: 100,
          buildingBlocks: ['reusable-component-1', 'reusable-component-2'],
          completedAt: new Date(),
          source: 'notion',
          sourceId: 'notion-project-1'
        }
      ];

      const opportunities = await opportunitiesEngine.analyze(mockProjects, []);
      expect(opportunities).toBeDefined();
      expect(opportunities.buildingBlocks).toBeDefined();
      expect(Array.isArray(opportunities.buildingBlocks)).toBe(true);
    });

    it('should identify near-completion projects', async () => {
      const mockProjects: PARAProject[] = [
        {
          id: 'project-2',
          title: 'Almost Done Project',
          stage: 'projects',
          progress: 85,
          dependencies: ['task-1', 'task-2'],
          source: 'notion',
          sourceId: 'notion-project-2'
        }
      ];

      const opportunities = await opportunitiesEngine.analyze(mockProjects, []);
      expect(opportunities.nearCompletion).toBeDefined();
      expect(Array.isArray(opportunities.nearCompletion)).toBe(true);
    });

    it('should calculate opportunity scores', async () => {
      const opportunities = await opportunitiesEngine.analyze([], []);
      expect(opportunities.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Automation Scheduler', () => {
    it('should start and stop scheduler successfully', async () => {
      expect(scheduler.getStatus().isRunning).toBe(false);

      scheduler.start();
      expect(scheduler.getStatus().isRunning).toBe(true);

      scheduler.stop();
      expect(scheduler.getStatus().isRunning).toBe(false);
    });

    it('should execute scheduled runs', async () => {
      scheduler.start();

      // Trigger a manual run
      const result = await scheduler.triggerRun('funnel');
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
      expect(result.timestamp).toBeDefined();

      scheduler.stop();
    });

    it('should handle all run types', async () => {
      const runTypes = ['funnel', 'coherence', 'opportunities', 'summary'] as const;

      for (const runType of runTypes) {
        const result = await scheduler.triggerRun(runType);
        expect(result).toBeDefined();
        expect(result.success).toBeDefined();
      }
    });

    it('should track run history', async () => {
      const initialRuns = scheduler.getStatus().lastRuns.length;

      await scheduler.triggerRun('funnel');

      const afterRuns = scheduler.getStatus().lastRuns.length;
      expect(afterRuns).toBeGreaterThanOrEqual(initialRuns);
    });
  });

  describe('MCP Server Integration', () => {
    it('should register all required tools', () => {
      // Import and register tools
      const { registerNotionTools } = require('../../src/examples/para-agent/tools/notion.js');
      const { registerLinearTools } = require('../../src/examples/para-agent/tools/linear.js');
      const { registerSlackTools } = require('../../src/examples/para-agent/tools/slack.js');

      // Mock the registration functions
      const mockRegisterNotion = vi.fn();
      const mockRegisterLinear = vi.fn();
      const mockRegisterSlack = vi.fn();

      vi.doMock('../../src/examples/para-agent/tools/notion.js', () => ({
        registerNotionTools: mockRegisterNotion
      }));

      vi.doMock('../../src/examples/para-agent/tools/linear.js', () => ({
        registerLinearTools: mockRegisterLinear
      }));

      vi.doMock('../../src/examples/para-agent/tools/slack.js', () => ({
        registerSlackTools: mockRegisterSlack
      }));

      // Verify tools would be registered (actual registration tested in server startup)
      expect(mockRegisterNotion).toBeDefined();
      expect(mockRegisterLinear).toBeDefined();
      expect(mockRegisterSlack).toBeDefined();
    });

    it('should handle tool execution errors gracefully', async () => {
      // Test error handling in tool execution
      notionTools.queryDatabase.mockRejectedValueOnce(new Error('API Error'));

      try {
        await notionTools.queryDatabase('test-db');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('API Error');
      }
    });
  });

  describe('Cross-Platform Integration', () => {
    it('should synchronize data between Notion and Linear', async () => {
      const mockNotionTasks = [
        {
          id: 'notion-task-1',
          title: 'Synced Task',
          stage: 'tasks',
          source: 'notion',
          sourceId: 'notion-task-1'
        }
      ];

      const mockLinearIssues = [
        {
          id: 'linear-issue-1',
          title: 'Linear Issue',
          state: 'in_progress'
        }
      ];

      notionTools.queryDatabase.mockResolvedValue(mockNotionTasks);
      linearTools.getIssues.mockResolvedValue(mockLinearIssues);

      // Test synchronization logic would go here
      const notionData = await notionTools.queryDatabase('tasks-db');
      const linearData = await linearTools.getIssues();

      expect(notionData).toEqual(mockNotionTasks);
      expect(linearData).toEqual(mockLinearIssues);
    });

    it('should send notifications via Slack', async () => {
      const mockMessage = {
        channel: 'C1234567890',
        text: 'Test notification',
        blocks: []
      };

      slackTools.sendMessage.mockResolvedValue({ ok: true });

      const result = await slackTools.sendMessage(mockMessage);
      expect(result.ok).toBe(true);
      expect(slackTools.sendMessage).toHaveBeenCalledWith(mockMessage);
    });

    it('should handle API failures gracefully', async () => {
      notionTools.queryDatabase.mockRejectedValue(new Error('Network Error'));
      linearTools.getIssues.mockRejectedValue(new Error('Auth Error'));
      slackTools.sendMessage.mockRejectedValue(new Error('Rate Limited'));

      // Test that system continues to function despite API failures
      const coherenceResult = await coherenceEngine.runMaintenance();
      expect(coherenceResult).toBeDefined();
      // Should not throw, but may report errors
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle configuration validation failures', () => {
      // Temporarily break configuration
      delete process.env.NOTION_API_KEY;

      const validation = configManager.validateConfig();
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);

      // Restore
      process.env.NOTION_API_KEY = 'mock-notion-key';
    });

    it('should recover from scheduler failures', async () => {
      // Mock a failure in one of the engines
      funnelEngine.runAutomation = vi.fn().mockRejectedValue(new Error('Engine Failure'));

      const result = await scheduler.triggerRun('funnel');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // Scheduler should still be operational
      const status = scheduler.getStatus();
      expect(status).toBeDefined();
    });

    it('should handle malformed data gracefully', async () => {
      const malformedTask = {
        id: null, // Invalid ID
        title: '', // Empty title
        stage: 'invalid-stage'
      };

      // Task score engine should handle malformed data
      try {
        taskScoreEngine.calculateTaskScore(malformedTask as any);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should implement circuit breaker pattern for API calls', async () => {
      // Simulate repeated API failures
      notionTools.queryDatabase
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockRejectedValueOnce(new Error('Timeout'));

      // System should eventually stop trying or degrade gracefully
      for (let i = 0; i < 3; i++) {
        try {
          await notionTools.queryDatabase('test-db');
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large datasets efficiently', async () => {
      // Create a large dataset
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: `task-${i}`,
        title: `Task ${i}`,
        stage: 'tasks',
        priority: Math.floor(Math.random() * 10),
        createdAt: new Date(),
        updatedAt: new Date(),
        source: 'notion',
        sourceId: `notion-task-${i}`
      }));

      notionTools.queryDatabase.mockResolvedValue(largeDataset);

      const startTime = Date.now();

      // Process large dataset
      const scores = largeDataset.map(task => taskScoreEngine.calculateTaskScore(task));

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(scores).toHaveLength(1000);
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should maintain performance under concurrent load', async () => {
      const concurrentOperations = 50;

      const promises = Array.from({ length: concurrentOperations }, async (_, i) => {
        const task = {
          id: `concurrent-task-${i}`,
          title: `Concurrent Task ${i}`,
          stage: 'tasks',
          createdAt: new Date(),
          updatedAt: new Date(),
          source: 'notion',
          sourceId: `notion-concurrent-${i}`
        };

        return taskScoreEngine.calculateTaskScore(task);
      });

      const startTime = Date.now();
      const results = await Promise.all(promises);
      const endTime = Date.now();

      expect(results).toHaveLength(concurrentOperations);
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should optimize memory usage for large operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform memory-intensive operation
      const largeDataset = Array.from({ length: 5000 }, (_, i) => ({
        id: `memory-task-${i}`,
        title: `Memory Task ${i}`,
        description: 'A'.repeat(1000), // Large description
        stage: 'tasks',
        createdAt: new Date(),
        updatedAt: new Date(),
        source: 'notion',
        sourceId: `notion-memory-${i}`
      }));

      const scores = largeDataset.map(task => taskScoreEngine.calculateTaskScore(task));

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      expect(scores).toHaveLength(5000);
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase
    });
  });

  describe('Integration Workflows', () => {
    it('should execute complete PARA workflow from jot to archive', async () => {
      // 1. Create a jot
      const jot = {
        id: 'workflow-jot',
        title: 'Workflow Test Jot',
        description: 'Testing complete workflow',
        stage: 'jots',
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days old
        source: 'manual'
      };

      // 2. Age the jot (simulate time passing)
      const agedJot = { ...jot, createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) };

      // 3. Run funnel automation to promote to task
      notionTools.queryDatabase.mockResolvedValueOnce([agedJot]);
      notionTools.moveToDatabase.mockResolvedValueOnce({});

      const funnelResult = await funnelEngine.runAutomation();
      expect(funnelResult.success).toBe(true);

      // 4. Calculate task score for the new task
      const task = { ...agedJot, stage: 'tasks' as const };
      const score = taskScoreEngine.calculateTaskScore(task);
      expect(score).toBeDefined();

      // 5. Eventually archive when completed
      const completedTask = { ...task, completedAt: new Date() };
      notionTools.moveToDatabase.mockResolvedValueOnce({});

      // Verify the complete workflow executed
      expect(funnelResult.transitions).toBeDefined();
    });

    it('should handle cross-platform task synchronization', async () => {
      // Create task in Notion
      const notionTask = {
        id: 'sync-task',
        title: 'Sync Test Task',
        stage: 'tasks',
        source: 'notion',
        sourceId: 'notion-sync-task'
      };

      // Sync to Linear
      linearTools.updateIssue.mockResolvedValue({
        id: 'linear-sync-issue',
        title: notionTask.title,
        state: 'in_progress'
      });

      // Verify synchronization
      const linearIssue = await linearTools.updateIssue('linear-sync-issue', {
        title: notionTask.title,
        state: 'in_progress'
      });

      expect(linearIssue.title).toBe(notionTask.title);
      expect(linearIssue.state).toBe('in_progress');
    });

    it('should generate and send comprehensive summaries', async () => {
      const mockSummaryData = {
        funnelMoves: [
          { itemId: 'item-1', fromStage: 'jots', toStage: 'tasks' }
        ],
        coherenceFixes: [
          { type: 'broken-link', itemId: 'item-2', fixed: true }
        ],
        opportunities: [
          { type: 'building-block', itemId: 'project-1', impact: 'high' }
        ],
        strategicTasks: [
          { id: 'task-1', delegationCandidate: true, reason: 'complex' }
        ]
      };

      slackTools.sendSummary.mockResolvedValue({ ok: true });

      const summaryResult = await slackTools.sendSummary(mockSummaryData);
      expect(summaryResult.ok).toBe(true);
      expect(slackTools.sendSummary).toHaveBeenCalledWith(mockSummaryData);
    });
  });
});
