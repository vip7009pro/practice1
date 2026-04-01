/**
 * Embedding Service - Generate and cache text embeddings
 * Uses @xenova/transformers for multilingual embeddings
 */

import { env, pipeline } from '@xenova/transformers';
import { createLogger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

const logger = createLogger('EmbeddingService');

// Set custom models path to reduce downloads
env.allowRemoteModels = true;
env.allowLocalModels = true;

export interface Embedding {
  text: string;
  vector: number[];
  normalized: boolean;
}

export interface EmbeddingCache {
  [key: string]: number[];
}

export class EmbeddingService {
  private embeddingModel: any = null;
  private cache: EmbeddingCache = {};
  private cacheFile: string;
  private initialized = false;
  private cacheUpdateCounter = 0;
  private readonly CACHE_SAVE_INTERVAL = 10; // Save after every 10 new embeddings

  constructor(cacheDir: string = './semantic-query-engine/.embeddings') {
    this.cacheFile = path.join(cacheDir, 'embeddings-cache.json');
    this.loadCache();
  }

  /**
   * Initialize the embedding model (lazy loading)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      logger.info('Initializing embedding model...');
      // Use multilingual model that supports English + Vietnamese
      // intfloat/multilingual-e5-small is fast and optimal for this use case
      this.embeddingModel = await pipeline(
        'feature-extraction',
        'Xenova/multilingual-e5-small',
      );
      this.initialized = true;
      logger.info('Embedding model initialized successfully');
      
      // Save cache after initialization
      await this.saveCache();
    } catch (error) {
      logger.error('Failed to initialize embedding model', error);
      throw error;
    }
  }

  /**
   * Generate embedding for a text (cached)
   */
  async embed(text: string): Promise<number[]> {
    const normalized = this.normalizeForCache(text);

    // Check cache first
    if (this.cache[normalized]) {
      return this.cache[normalized];
    }

    // Initialize model if not done yet
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Generate embedding
      const embedding = await this.embeddingModel(text, {
        pooling: 'mean',
        normalize: true,
      });

      // Debug: log embedding structure
      logger.info(`Embedding result type: ${typeof embedding}, keys: ${Object.keys(embedding || {}).join(', ')}`, {
        hasData: 'data' in (embedding || {}),
        isArray: Array.isArray(embedding),
        constructor: embedding?.constructor?.name,
      });

      // Extract vector from various possible formats
      let vector: number[];
      
      // Case 1: Direct tensor with data property
      if (embedding && typeof embedding.data !== 'undefined') {
        logger.info('Using embedding.data format');
        vector = Array.from(embedding.data);
      }
      // Case 2: Direct array
      else if (Array.isArray(embedding)) {
        logger.info('Using direct array format');
        vector = Array.from(embedding);
      }
      // Case 3: Tensor object - need to convert to array
      else if (embedding && typeof embedding === 'object') {
        logger.info('Using tensor object format');
        // Try to convert tensor to array using tolist() or similar
        if (typeof (embedding as any).tolist === 'function') {
          logger.info('Tensor has tolist() method');
          vector = (embedding as any).tolist();
        } else if (typeof (embedding as any).toArray === 'function') {
          logger.info('Tensor has toArray() method');
          vector = (embedding as any).toArray();
        } else if ((embedding as any).data && Array.isArray((embedding as any).data)) {
          logger.info('Tensor.data is array');
          vector = (embedding as any).data;
        } else {
          logger.info('Fallback: spreading object values');
          // Fallback: try spreading or converting
          vector = Object.values(embedding).flat() as number[];
        }
      } else {
        throw new Error(`Invalid embedding format: expected array or tensor, got ${typeof embedding}`);
      }

      // Validate vector
      if (!Array.isArray(vector) || vector.length === 0) {
        throw new Error(`Invalid vector: expected non-empty array, got length=${Array.isArray(vector) ? vector.length : 'N/A'}`);
      }

      logger.info(`Successfully embedded text, vector size: ${vector.length}`, {
        textLength: text.length,
        vectorSize: vector.length,
        sample: vector.slice(0, 3),
      });

      // Cache it
      this.cache[normalized] = vector;

      // Save cache periodically
      this.cacheUpdateCounter++;
      if (this.cacheUpdateCounter >= this.CACHE_SAVE_INTERVAL) {
        await this.saveCache();
        this.cacheUpdateCounter = 0;
      }

      return vector;
    } catch (error) {
      logger.error(`Failed to embed text: "${text}"`, error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vector dimensions mismatch');
    }

    if (vec1.length === 0) {
      return 0;
    }

    // Calculate dot product
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      normA += vec1[i] * vec1[i];
      normB += vec2[i] * vec2[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Find similar texts from a list based on semantic similarity
   */
  async findSimilar(
    queryText: string,
    candidates: string[],
    threshold: number = 0.5,
    topK: number = 10,
  ): Promise<Array<{ text: string; score: number }>> {
    try {
      const queryEmbedding = await this.embed(queryText);
      const results: Array<{ text: string; score: number }> = [];

      for (const candidate of candidates) {
        const candidateEmbedding = await this.embed(candidate);
        const similarity = this.cosineSimilarity(queryEmbedding, candidateEmbedding);

        if (similarity >= threshold) {
          results.push({ text: candidate, score: similarity });
        }
      }

      // Sort by score descending and return top K
      results.sort((a, b) => b.score - a.score);
      return results.slice(0, topK);
    } catch (error) {
      logger.error('Failed to find similar texts', error);
      throw error;
    }
  }

  /**
   * Normalize text for cache key
   */
  private normalizeForCache(text: string): string {
    return text.toLowerCase().trim().replace(/\s+/g, '_');
  }

  /**
   * Load cache from disk
   */
  private loadCache(): void {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const cacheData = fs.readFileSync(this.cacheFile, 'utf-8');
        this.cache = JSON.parse(cacheData);
        logger.info('Loaded embedding cache', {
          entries: Object.keys(this.cache).length,
        });
      }
    } catch (error) {
      logger.warn('Failed to load embedding cache', error);
      this.cache = {};
    }
  }

  /**
   * Save cache to disk
   */
  async saveCache(): Promise<void> {
    try {
      const dir = path.dirname(this.cacheFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.cacheFile, JSON.stringify(this.cache, null, 2));
      logger.info('Saved embedding cache', {
        entries: Object.keys(this.cache).length,
      });
    } catch (error) {
      logger.error('Failed to save embedding cache', error);
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache = {};
    this.cacheUpdateCounter = 0;
    try {
      const dir = path.dirname(this.cacheFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.cacheFile, JSON.stringify(this.cache, null, 2));
    } catch (error) {
      logger.error('Failed to persist cleared embedding cache', error);
    }
    logger.info('Cleared embedding cache');
  }
}
