/**
 * Task Score Calculation Engine
 * Implements Amplenote-style productivity scoring
 * Optimized for Apple M2 with WebGPU acceleration for compute-intensive operations
 */

import { TaskScoreFactors, TaskScoreResult, TaskScoreConfig, VictoryValue, GoodLifeAlgorithm } from '../types/task.js';
import { PARATask, PARAProject } from '../types/para.js';
import { ValkeyCache } from '../cache/valkey.js';
import { ValkeyConfig } from '../config/index.js';

// WebGPU interface for Metal acceleration on M2
interface WebGPUContext {
  device: GPUDevice;
  queue: GPUQueue;
  shaderModule: GPUShaderModule;
}

export class TaskScoreEngine {
  private config: TaskScoreConfig;
  private goodLifeAlgorithm: GoodLifeAlgorithm;
  private webgpu: WebGPUContext | null = null;
  private useWebGPU: boolean = false;
  private cache: ValkeyCache;

  constructor(config?: Partial<TaskScoreConfig>, valkeyConfig?: ValkeyConfig) {
    this.config = {
      weights: {
        noteActivity: 0.5,
        urgency: 1.0,
        importance: 1.5, // 3x accumulation for important items (but scaled down)
        deadlinePressure: 2.0,
        duration: 0.3,
        blocking: 1.0,
        crossAreaImpact: 0.8,
        age: -0.05,
        momentum: 0.7
      },
      thresholds: {
        red: 10,
        gold: 5
      },
      decay: {
        agePenaltyPerDay: 0.1,
        activityBoostDecay: 0.05
      },
      victory: {
        moodWeight: 0.4,
        durationWeight: 0.3,
        leverageWeight: 0.3
      },
      ...config
    };

    this.goodLifeAlgorithm = {
      averageVictoryValue: 0,
      preferredUrgency: 5,
      preferredDuration: 60, // minutes
      preferredDomains: [],
      highEnergyTimes: [],
      lowEnergyTimes: [],
      lastUpdated: new Date()
    };

    // Initialize cache
    this.cache = new ValkeyCache(valkeyConfig || {
      host: process.env.VALKEY_HOST || 'localhost',
      port: parseInt(process.env.VALKEY_PORT || '6379'),
      password: process.env.VALKEY_PASSWORD,
      db: parseInt(process.env.VALKEY_DB || '0'),
      keyPrefix: 'para:task-scores:',
      ttl: {
        taskScores: parseInt(process.env.VALKEY_TTL_TASK_SCORES || '3600'),
        apiResponses: parseInt(process.env.VALKEY_TTL_API_RESPONSES || '300'),
        opportunities: parseInt(process.env.VALKEY_TTL_OPPORTUNITIES || '1800'),
        coherence: parseInt(process.env.VALKEY_TTL_COHERENCE || '900')
      },
      enabled: process.env.VALKEY_ENABLED !== 'false'
    });
  }

  /**
   * Calculate Task Score for a PARA task with caching
   */
  async calculateTaskScore(task: PARATask, context?: {
    relatedTasks?: PARATask[];
    relatedProjects?: PARAProject[];
    recentActivity?: { date: Date; action: string }[];
  }): Promise<TaskScoreResult> {
    // Check cache first
    const cacheKey = this.generateCacheKey(task, context);
    const cachedResult = await this.cache.getCachedTaskScore(cacheKey);

    if (cachedResult) {
      return cachedResult;
    }

    // Calculate factors
    const factors = this.calculateFactors(task, context);

    const breakdown = {
      activity: factors.noteActivity * this.config.weights.noteActivity,
      priority: (factors.urgency * this.config.weights.urgency) +
                (factors.importance * this.config.weights.importance),
      timing: (factors.deadlinePressure * this.config.weights.deadlinePressure) +
              (factors.age * this.config.weights.age),
      impact: (factors.duration * this.config.weights.duration) +
              (factors.blocking * this.config.weights.blocking) +
              (factors.crossAreaImpact * this.config.weights.crossAreaImpact),
      momentum: factors.momentum * this.config.weights.momentum
    };

    const totalScore = breakdown.activity + breakdown.priority + breakdown.timing +
                      breakdown.impact + breakdown.momentum;

    const colorCode = totalScore >= this.config.thresholds.red ? 'red' :
                     totalScore >= this.config.thresholds.gold ? 'gold' : 'normal';

    const result: TaskScoreResult = {
      totalScore: Math.max(0, totalScore), // Ensure non-negative
      factors,
      colorCode,
      breakdown,
      lastCalculated: new Date()
    };

    // Cache the result
    await this.cache.cacheTaskScore(cacheKey, result);

    return result;
  }

  /**
   * Generate a cache key for task score calculation
   */
  private generateCacheKey(task: PARATask, context?: {
    relatedTasks?: PARATask[];
    relatedProjects?: PARAProject[];
    recentActivity?: { date: Date; action: string }[];
  }): string {
    // Create a deterministic key based on task properties and context
    const taskKey = `${task.id}:${task.updatedAt.getTime()}`;
    const contextKey = context ? JSON.stringify({
      relatedTasksCount: context.relatedTasks?.length || 0,
      relatedProjectsCount: context.relatedProjects?.length || 0,
      recentActivityCount: context.recentActivity?.length || 0
    }) : 'no-context';

    return `${taskKey}:${contextKey}`;
  }

  /**
   * Calculate individual scoring factors
   */
  private calculateFactors(task: PARATask, context?: {
    relatedTasks?: PARATask[];
    relatedProjects?: PARAProject[];
    recentActivity?: { date: Date; action: string }[];
  }): TaskScoreFactors {
    const now = new Date();
    const ageInDays = Math.floor((now.getTime() - task.createdAt.getTime()) / (1000 * 60 * 60 * 24));

    // Note activity (based on access patterns - simplified for now)
    const noteActivity = Math.min(10, (task.metadata?.accessCount || 0) * 0.5);

    // Urgency/Importance (from task properties and tags)
    const urgency = this.calculateUrgency(task);
    const importance = this.calculateImportance(task);

    // Deadline pressure
    const deadlinePressure = this.calculateDeadlinePressure(task, now);

    // Duration & blocking
    const duration = this.calculateDurationFactor(task);
    const blocking = this.calculateBlockingFactor(task, context?.relatedTasks || []);

    // Cross-area impact
    const crossAreaImpact = Math.min(5, (task.crossAreaImpact?.length || 0) * 1.5);

    // Age factor (penalty for old items)
    const age = -ageInDays * this.config.decay.agePenaltyPerDay;

    // Momentum (based on recent activity)
    const momentum = this.calculateMomentum(task, context?.recentActivity || []);

    return {
      noteActivity,
      urgency,
      importance,
      deadlinePressure,
      duration,
      blocking,
      crossAreaImpact,
      age,
      momentum
    };
  }

  private calculateUrgency(task: PARATask): number {
    let urgency = 5; // baseline

    // Boost for urgent tags
    if (task.tags.some(tag => tag.toLowerCase().includes('urgent'))) urgency += 3;
    if (task.tags.some(tag => tag.toLowerCase().includes('critical'))) urgency += 2;

    // Boost for high priority
    if (task.priority && task.priority >= 8) urgency += 2;

    return Math.min(10, urgency);
  }

  private calculateImportance(task: PARATask): number {
    let importance = 5; // baseline

    // Boost for goal-related items
    if (task.tags.some(tag => tag.toLowerCase().includes('goal'))) importance += 3;
    if (task.tags.some(tag => tag.toLowerCase().includes('strategic'))) importance += 2;

    // Boost for high priority
    if (task.priority && task.priority >= 7) importance += 2;

    return Math.min(10, importance);
  }

  private calculateDeadlinePressure(task: PARATask, now: Date): number {
    if (!task.dueDate) return 0;

    const daysUntilDue = Math.floor((task.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilDue < 0) return 10; // overdue
    if (daysUntilDue === 0) return 10; // due today
    if (daysUntilDue <= 1) return 7; // due tomorrow
    if (daysUntilDue <= 3) return 5; // due within 3 days

    return 0;
  }

  private calculateDurationFactor(task: PARATask): number {
    // Simplified: assume quick wins are positive, long tasks are negative
    const estimatedDuration = task.metadata?.estimatedDuration || 60; // minutes

    if (estimatedDuration <= 15) return 2; // quick win
    if (estimatedDuration <= 30) return 1;
    if (estimatedDuration >= 240) return -2; // very long task
    if (estimatedDuration >= 120) return -1;

    return 0;
  }

  private calculateBlockingFactor(task: PARATask, relatedTasks: PARATask[]): number {
    if (!task.blockers) return 0;

    // Count how many important tasks this blocks
    const blockedImportantTasks = relatedTasks.filter(t =>
      task.blockers!.includes(t.id) &&
      (t.priority || 0) >= 7
    ).length;

    return Math.min(5, blockedImportantTasks * 1.5);
  }

  private calculateMomentum(task: PARATask, recentActivity: { date: Date; action: string }[]): number {
    const recentActivityCount = recentActivity.filter(a =>
      (new Date().getTime() - a.date.getTime()) < (7 * 24 * 60 * 60 * 1000) // last 7 days
    ).length;

    return Math.min(5, recentActivityCount * 0.5);
  }

  /**
   * Calculate Victory Value for completed tasks
   */
  calculateVictoryValue(victory: VictoryValue): number {
    const moodScore = victory.moodRating * this.config.victory.moodWeight;
    const durationScore = Math.max(0, 120 - victory.duration) * 0.01 * this.config.victory.durationWeight; // Prefer shorter tasks
    const leverageScore = victory.leverage * this.config.victory.leverageWeight;

    return moodScore + durationScore + leverageScore;
  }

  /**
   * Update Good Life Algorithm with new victory data
   */
  updateGoodLifeAlgorithm(victories: VictoryValue[]): void {
    if (victories.length === 0) return;

    const averageVictory = victories.reduce((sum, v) => sum + v.value, 0) / victories.length;

    // Update preferred characteristics based on high-value victories
    const highValueVictories = victories.filter(v => v.value > averageVictory);

    this.goodLifeAlgorithm.averageVictoryValue = averageVictory;
    this.goodLifeAlgorithm.preferredUrgency = highValueVictories.reduce((sum, v) => sum + (v as any).urgency || 5, 0) / highValueVictories.length;
    this.goodLifeAlgorithm.preferredDuration = highValueVictories.reduce((sum, v) => sum + v.duration, 0) / highValueVictories.length;
    this.goodLifeAlgorithm.lastUpdated = new Date();
  }

  /**
   * Get current Good Life Algorithm state
   */
  getGoodLifeAlgorithm(): GoodLifeAlgorithm {
    return { ...this.goodLifeAlgorithm };
  }
}
