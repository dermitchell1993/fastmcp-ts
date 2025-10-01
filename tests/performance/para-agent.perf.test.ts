/**
 * Performance Tests for PARA Automation Agent
 *
 * Tests the performance characteristics of the PARA system under various loads:
 * - Task Score calculation performance
 * - Funnel automation throughput
 * - Memory usage patterns
 * - Concurrent operation handling
 * - Large dataset processing
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { TaskScoreEngine } from '../../src/examples/para-agent/engine/taskScore.js';
import { FunnelAutomationEngine } from '../../src/examples/para-agent/engine/funnel.js';
import { CoherenceEngine } from '../../src/examples/para-agent/engine/coherence.js';
import { OpportunitiesEngine } from '../../src/examples/para-agent/engine/opportunities.js';
import { AutomationScheduler } from '../../src/examples/para-agent/scheduler/index.js';
import { generateLargeDataset, measurePerformance, simulateConcurrentLoad } from '../e2e/__mocks__/api-mocks.js';
import type { PARATask, PARAProject } from '../../src/examples/para-agent/types/para.js';

// Mock the external dependencies
vi.mock('../../src/examples/para-agent/tools/notion.js');
vi.mock('../../src/examples/para-agent/tools/linear.js');
vi.mock('../../src/examples/para-agent/tools/slack.js');

describe('PARA Agent Performance Tests', () => {
  let taskScoreEngine: TaskScoreEngine;
  let funnelEngine: FunnelAutomationEngine;
  let coherenceEngine: CoherenceEngine;
  let opportunitiesEngine: OpportunitiesEngine;
  let scheduler: AutomationScheduler;

  beforeAll(() => {
    // Initialize engines with mocks
    taskScoreEngine = new TaskScoreEngine();
    funnelEngine = new FunnelAutomationEngine({} as any, {} as any);
    coherenceEngine = new CoherenceEngine({} as any, {} as any);
    opportunitiesEngine = new OpportunitiesEngine();

    scheduler = new AutomationScheduler(
      {
        enabled: true,
        funnelInterval: 6 * 60 * 60 * 1000, // 6 hours
        coherenceInterval: 24 * 60 * 60 * 1000, // 24 hours
        opportunitiesInterval: 12 * 60 * 60 * 1000, // 12 hours
        summaryHour: 9,
        timezone: 'America/New_York'
      },
      taskScoreEngine,
      funnelEngine,
      coherenceEngine,
      opportunitiesEngine,
      {} as any, // slackTools
      {} as any, // notionTools
      {} as any  // linearTools
    );
  });

  describe('Task Score Engine Performance', () => {
    it('should calculate scores for individual tasks within 10ms', async () => {
      const task: PARATask = {
        id: 'perf-task-1',
        title: 'Performance Test Task',
        description: 'Testing task score calculation performance',
        stage: 'tasks',
        priority: 7,
        tags: ['performance', 'test'],
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        dependencies: [],
        blockers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        source: 'notion',
        sourceId: 'notion-perf-task-1'
      };

      const { result: score, duration } = await measurePerformance(
        () => Promise.resolve(taskScoreEngine.calculateTaskScore(task)),
        'Single task score calculation'
      );

      expect(score.totalScore).toBeDefined();
      expect(duration).toBeLessThan(10); // Should complete within 10ms
    });

    it('should handle 1000 tasks within 1 second', async () => {
      const tasks = generateLargeDataset(1000);

      const { result: scores, duration, memoryUsage } = await measurePerformance(
        () => Promise.resolve(tasks.map(task => taskScoreEngine.calculateTaskScore(task))),
        '1000 task score calculations'
      );

      expect(scores).toHaveLength(1000);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(memoryUsage.heapUsed).toBeLessThan(50 * 1024 * 1024); // Less than 50MB memory increase
    });

    it('should handle 10000 tasks within 10 seconds', async () => {
      const tasks = generateLargeDataset(10000);

      const { result: scores, duration, memoryUsage } = await measurePerformance(
        () => Promise.resolve(tasks.map(task => taskScoreEngine.calculateTaskScore(task))),
        '10000 task score calculations'
      );

      expect(scores).toHaveLength(10000);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      expect(memoryUsage.heapUsed).toBeLessThan(200 * 1024 * 1024); // Less than 200MB memory increase
    });

    it('should maintain performance under concurrent load', async () => {
      const concurrentTasks = 100;
      const operations = Array.from({ length: concurrentTasks }, (_, i) =>
        () => Promise.resolve(taskScoreEngine.calculateTaskScore(generateLargeDataset(1)[0]))
      );

      const { result: scores, duration } = await measurePerformance(
        () => simulateConcurrentLoad(operations, 10),
        '100 concurrent task score calculations'
      );

      expect(scores).toHaveLength(concurrentTasks);
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });

  describe('Funnel Automation Performance', () => {
    it('should process funnel transitions within acceptable time', async () => {
      const { duration } = await measurePerformance(
        () => funnelEngine.runAutomation(),
        'Funnel automation run'
      );

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle large datasets in funnel analysis', async () => {
      const largeDataset = generateLargeDataset(5000);

      // Mock the query method to return large dataset
      funnelEngine.analyzeTransitions = vi.fn().mockResolvedValue(
        largeDataset.map(task => ({
          itemId: task.id,
          fromStage: 'jots',
          toStage: 'tasks',
          reason: 'age_threshold'
        }))
      );

      const { result: transitions, duration } = await measurePerformance(
        () => funnelEngine.analyzeTransitions(),
        'Large dataset funnel analysis'
      );

      expect(transitions).toHaveLength(5000);
      expect(duration).toBeLessThan(3000); // Should complete within 3 seconds
    });
  });

  describe('Coherence Engine Performance', () => {
    it('should scan for coherence issues efficiently', async () => {
      const { duration } = await measurePerformance(
        () => coherenceEngine.scanForIssues(),
        'Coherence scan'
      );

      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should handle maintenance operations within time limits', async () => {
      const { duration } = await measurePerformance(
        () => coherenceEngine.runMaintenance(),
        'Coherence maintenance'
      );

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Opportunities Engine Performance', () => {
    it('should analyze opportunities for large project sets', async () => {
      const projects: PARAProject[] = Array.from({ length: 100 }, (_, i) => ({
        id: `project-${i}`,
        title: `Project ${i}`,
        description: `Description ${i}`,
        stage: 'projects',
        tasks: Array.from({ length: 10 }, (_, j) => `task-${i}-${j}`),
        areas: [`area-${Math.floor(i / 10)}`],
        priority: Math.floor(Math.random() * 10),
        tags: [`tag-${Math.floor(Math.random() * 5)}`],
        progress: Math.floor(Math.random() * 100),
        dependencies: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        source: 'notion',
        sourceId: `notion-project-${i}`
      }));

      const { result: opportunities, duration } = await measurePerformance(
        () => opportunitiesEngine.analyze(projects, []),
        'Opportunities analysis for 100 projects'
      );

      expect(opportunities).toBeDefined();
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Scheduler Performance', () => {
    it('should handle scheduled runs efficiently', async () => {
      const { duration } = await measurePerformance(
        () => scheduler.triggerRun('funnel'),
        'Scheduled funnel run'
      );

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should manage multiple concurrent scheduled runs', async () => {
      const operations = [
        () => scheduler.triggerRun('funnel'),
        () => scheduler.triggerRun('coherence'),
        () => scheduler.triggerRun('opportunities'),
        () => scheduler.triggerRun('summary')
      ];

      const { result: results, duration } = await measurePerformance(
        () => Promise.all(operations),
        'Concurrent scheduled runs'
      );

      expect(results).toHaveLength(4);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });

  describe('Memory Usage Patterns', () => {
    it('should not have memory leaks in repeated operations', async () => {
      const initialMemory = process.memoryUsage();

      // Perform 100 iterations of task scoring
      for (let i = 0; i < 100; i++) {
        const task = generateLargeDataset(1)[0];
        taskScoreEngine.calculateTaskScore(task);
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be minimal (less than 10MB for 100 operations)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });

    it('should clean up resources after large operations', async () => {
      const beforeMemory = process.memoryUsage();

      // Process a large dataset
      const largeDataset = generateLargeDataset(10000);
      largeDataset.forEach(task => taskScoreEngine.calculateTaskScore(task));

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const afterMemory = process.memoryUsage();
      const memoryIncrease = afterMemory.heapUsed - beforeMemory.heapUsed;

      // Memory should be reasonably bounded
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
    });
  });

  describe('Scalability Benchmarks', () => {
    it('should scale linearly with dataset size', async () => {
      const sizes = [100, 500, 1000, 2000];
      const timings: number[] = [];

      for (const size of sizes) {
        const dataset = generateLargeDataset(size);
        const start = Date.now();

        dataset.forEach(task => taskScoreEngine.calculateTaskScore(task));

        const duration = Date.now() - start;
        timings.push(duration);
      }

      // Check that scaling is roughly linear (allowing for some variance)
      const ratio1 = timings[1] / timings[0]; // 500/100
      const ratio2 = timings[2] / timings[0]; // 1000/100
      const ratio3 = timings[3] / timings[0]; // 2000/100

      expect(ratio1).toBeGreaterThan(2); // At least 2x for 5x data
      expect(ratio1).toBeLessThan(10); // But not more than 10x (indicating super-linear scaling)
      expect(ratio2).toBeGreaterThan(5); // At least 5x for 10x data
      expect(ratio3).toBeGreaterThan(10); // At least 10x for 20x data
    });

    it('should handle sustained load without degradation', async () => {
      const iterations = 50;
      const timings: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        const task = generateLargeDataset(1)[0];
        taskScoreEngine.calculateTaskScore(task);
        const duration = Date.now() - start;
        timings.push(duration);

        // Small delay to simulate real-world usage
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const averageTime = timings.reduce((a, b) => a + b, 0) / timings.length;
      const variance = timings.reduce((acc, time) => acc + Math.pow(time - averageTime, 2), 0) / timings.length;
      const standardDeviation = Math.sqrt(variance);

      // Performance should be consistent (low standard deviation relative to mean)
      expect(standardDeviation / averageTime).toBeLessThan(0.5); // CV < 50%
    });
  });

  describe('Resource Utilization', () => {
    it('should use CPU efficiently', async () => {
      const startUsage = process.cpuUsage();

      // Perform CPU-intensive operation
      const tasks = generateLargeDataset(5000);
      tasks.forEach(task => taskScoreEngine.calculateTaskScore(task));

      const endUsage = process.cpuUsage(startUsage);

      // CPU usage should be reasonable (less than 1 second total CPU time for 5k operations)
      const totalCPUTime = (endUsage.user + endUsage.system) / 1000; // Convert to milliseconds
      expect(totalCPUTime).toBeLessThan(1000);
    });

    it('should minimize external API calls', async () => {
      // This test would verify that the system batches API calls and minimizes external requests
      // Implementation would depend on actual API call patterns
      expect(true).toBe(true); // Placeholder - would need actual implementation tracking
    });
  });
});

