/**
 * Valkey Cache Implementation
 * Redis-compatible caching for PARA agent performance optimization
 */

import { createClient, type RedisClientType } from 'redis';

export interface ValkeyConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
  ttl: {
    taskScores: number;
    apiResponses: number;
    opportunities: number;
    coherence: number;
  };
  enabled: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  hitRate: number;
}

export interface HealthCheckResult {
  healthy: boolean;
  error?: string;
  stats?: CacheStats;
}

/**
 * Valkey Cache class for Redis-compatible caching
 */
export class ValkeyCache {
  private client: RedisClientType | null = null;
  private config: ValkeyConfig;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
    hitRate: 0
  };

  constructor(config: ValkeyConfig) {
    this.config = config;
    if (config.enabled) {
      this.initializeClient();
    }
  }

  /**
   * Initialize Redis client
   */
  private async initializeClient(): Promise<void> {
    try {
      this.client = createClient({
        host: this.config.host,
        port: this.config.port,
        password: this.config.password,
        database: this.config.db,
        socket: {
          connectTimeout: 5000,
          lazyConnect: true
        }
      });

      this.client.on('error', (err) => {
        console.warn('Valkey cache connection error:', err.message);
        this.stats.errors++;
      });

      this.client.on('connect', () => {
        console.log('Valkey cache connected successfully');
      });

      // Connect lazily - will connect on first operation
    } catch (error) {
      console.warn('Failed to initialize Valkey client:', error);
      this.client = null;
    }
  }

  /**
   * Check if cache is connected
   */
  isConnected(): boolean {
    return this.client?.isOpen === true;
  }

  /**
   * Generate prefixed cache key
   */
  private makeKey(key: string): string {
    return `${this.config.keyPrefix}${key}`;
  }

  /**
   * Get value from cache
   */
  async get(key: string): Promise<any | null> {
    if (!this.config.enabled || !this.client) {
      this.stats.misses++;
      return null;
    }

    try {
      const fullKey = this.makeKey(key);
      const value = await this.client.get(fullKey);

      if (value) {
        this.stats.hits++;
        return JSON.parse(value);
      } else {
        this.stats.misses++;
        return null;
      }
    } catch (error) {
      this.stats.errors++;
      console.warn('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    if (!this.config.enabled || !this.client) {
      return false;
    }

    try {
      const fullKey = this.makeKey(key);
      const serializedValue = JSON.stringify(value);

      if (ttl) {
        await this.client.setEx(fullKey, ttl, serializedValue);
      } else {
        await this.client.set(fullKey, serializedValue);
      }

      this.stats.sets++;
      return true;
    } catch (error) {
      this.stats.errors++;
      console.warn('Cache set error:', error);
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<boolean> {
    if (!this.config.enabled || !this.client) {
      return false;
    }

    try {
      const fullKey = this.makeKey(key);
      await this.client.del(fullKey);
      this.stats.deletes++;
      return true;
    } catch (error) {
      this.stats.errors++;
      console.warn('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Cache task score result
   */
  async cacheTaskScore(taskId: string, score: any): Promise<boolean> {
    return this.set(`taskscore:${taskId}`, score, this.config.ttl.taskScores);
  }

  /**
   * Get cached task score
   */
  async getCachedTaskScore(taskId: string): Promise<any | null> {
    return this.get(`taskscore:${taskId}`);
  }

  /**
   * Cache API response
   */
  async cacheAPIResponse(service: string, params: any, response: any): Promise<boolean> {
    const key = `api:${service}:${JSON.stringify(params)}`;
    return this.set(key, response, this.config.ttl.apiResponses);
  }

  /**
   * Get cached API response
   */
  async getCachedAPIResponse(service: string, params: any): Promise<any | null> {
    const key = `api:${service}:${JSON.stringify(params)}`;
    return this.get(key);
  }

  /**
   * Cache opportunities analysis
   */
  async cacheOpportunitiesAnalysis(key: string, analysis: any): Promise<boolean> {
    return this.set(`opportunities:${key}`, analysis, this.config.ttl.opportunities);
  }

  /**
   * Get cached opportunities analysis
   */
  async getCachedOpportunitiesAnalysis(key: string): Promise<any | null> {
    return this.get(`opportunities:${key}`);
  }

  /**
   * Cache coherence check results
   */
  async cacheCoherenceCheck(key: string, results: any): Promise<boolean> {
    return this.set(`coherence:${key}`, results, this.config.ttl.coherence);
  }

  /**
   * Get cached coherence check results
   */
  async getCachedCoherenceCheck(key: string): Promise<any | null> {
    return this.get(`coherence:${key}`);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
    return { ...this.stats };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      hitRate: 0
    };
  }

  /**
   * Perform health check
   */
  async healthCheck(): Promise<HealthCheckResult> {
    if (!this.config.enabled) {
      return {
        healthy: false,
        error: 'Valkey caching is disabled'
      };
    }

    if (!this.client) {
      return {
        healthy: false,
        error: 'Valkey client not initialized'
      };
    }

    try {
      // Simple ping to test connection
      await this.client.ping();
      return {
        healthy: true,
        stats: this.getStats()
      };
    } catch (error) {
      return {
        healthy: false,
        error: `Connection failed: ${error.message}`
      };
    }
  }

  /**
   * Clear all cache entries with our prefix
   */
  async clearAll(): Promise<boolean> {
    if (!this.config.enabled || !this.client) {
      return false;
    }

    try {
      // Get all keys with our prefix
      const pattern = `${this.config.keyPrefix}*`;
      const keys = await this.client.keys(pattern);

      if (keys.length > 0) {
        await this.client.del(keys);
      }

      return true;
    } catch (error) {
      this.stats.errors++;
      console.warn('Cache clear error:', error);
      return false;
    }
  }

  /**
   * Close cache connection
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }
}

