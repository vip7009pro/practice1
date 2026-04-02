/**
 * Embedding Service - Generate and cache text embeddings
 */

import crypto from 'crypto';
import { createLogger } from '../utils/logger';
import { normalizeText, tokenize } from '../utils/helpers';
import * as fs from 'fs';
import * as path from 'path';

type EmbeddingProvider = 'local' | 'xenova';

const logger = createLogger('EmbeddingService');

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
  private readonly embeddingDimension = 256;
  private provider: EmbeddingProvider;

  constructor(cacheDir: string = './semantic-query-engine/.embeddings') {
    this.provider = String(process.env.SEMANTIC_EMBEDDING_PROVIDER || 'local').toLowerCase() === 'xenova'
      ? 'xenova'
      : 'local';
    this.cacheFile = path.join(cacheDir, 'embeddings-cache.json');
    this.loadCache();
  }

  /**
   * Initialize the embedding model (lazy loading)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (this.provider !== 'xenova') {
      this.initialized = true;
      return;
    }

    try {
      logger.info('Initializing embedding model...');
      const moduleName = ['@xenova', 'transformers'].join('/');
      const transformers = eval('require')(moduleName);
      transformers.env.allowRemoteModels = true;
      transformers.env.allowLocalModels = true;
      this.embeddingModel = await transformers.pipeline(
        'feature-extraction',
        'Xenova/multilingual-e5-small',
      );
      this.initialized = true;
      logger.info('Embedding model initialized successfully');
      
      // Save cache after initialization
      await this.saveCache();
    } catch (error) {
      logger.warn('Failed to initialize Xenova embeddings, falling back to local embeddings', error);
      this.embeddingModel = null;
      this.provider = 'local';
      this.initialized = true;
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

    if (this.provider === 'local') {
      const vector = this.embedLocally(text);
      this.cache[normalized] = vector;
      this.cacheUpdateCounter++;
      if (this.cacheUpdateCounter >= this.CACHE_SAVE_INTERVAL) {
        await this.saveCache();
        this.cacheUpdateCounter = 0;
      }
      return vector;
    }

    // Initialize model if not done yet
    if (!this.initialized) {
      await this.initialize();
    }

    if (this.provider !== 'xenova' || !this.embeddingModel) {
      const vector = this.embedLocally(text);
      this.cache[normalized] = vector;
      this.cacheUpdateCounter++;
      if (this.cacheUpdateCounter >= this.CACHE_SAVE_INTERVAL) {
        await this.saveCache();
        this.cacheUpdateCounter = 0;
      }
      return vector;
    }

    try {
      const vector = await this.embedWithXenova(text);
      this.cache[normalized] = vector;
      this.cacheUpdateCounter++;
      if (this.cacheUpdateCounter >= this.CACHE_SAVE_INTERVAL) {
        await this.saveCache();
        this.cacheUpdateCounter = 0;
      }
      return vector;
    } catch (error) {
      logger.warn(`Failed to embed text with Xenova, falling back to local provider: "${text}"`, error);
      this.provider = 'local';
      this.embeddingModel = null;
      const vector = this.embedLocally(text);
      this.cache[normalized] = vector;
      this.cacheUpdateCounter++;
      if (this.cacheUpdateCounter >= this.CACHE_SAVE_INTERVAL) {
        await this.saveCache();
        this.cacheUpdateCounter = 0;
      }
      return vector;
    }
  }

  private async embedWithXenova(text: string): Promise<number[]> {
    const embedding = await this.embeddingModel(text, {
      pooling: 'mean',
      normalize: true,
    });

    let vector: number[];

    if (embedding && typeof embedding.data !== 'undefined') {
      vector = Array.from(embedding.data);
    } else if (Array.isArray(embedding)) {
      vector = Array.from(embedding);
    } else if (embedding && typeof embedding === 'object') {
      if (typeof (embedding as any).tolist === 'function') {
        vector = (embedding as any).tolist();
      } else if (typeof (embedding as any).toArray === 'function') {
        vector = (embedding as any).toArray();
      } else if ((embedding as any).data && Array.isArray((embedding as any).data)) {
        vector = (embedding as any).data;
      } else {
        vector = Object.values(embedding).flat() as number[];
      }
    } else {
      throw new Error(`Invalid embedding format: expected array or tensor, got ${typeof embedding}`);
    }

    if (!Array.isArray(vector) || vector.length === 0) {
      throw new Error(`Invalid vector: expected non-empty array, got length=${Array.isArray(vector) ? vector.length : 'N/A'}`);
    }

    logger.info(`Successfully embedded text, vector size: ${vector.length}`, {
      textLength: text.length,
      vectorSize: vector.length,
      sample: vector.slice(0, 3),
      provider: 'xenova',
    });

    return vector;
  }

  private embedLocally(text: string): number[] {
    const normalizedText = normalizeText(text);
    const tokens = tokenize(normalizedText);
    const features = tokens.length > 0 ? tokens : (normalizedText ? [normalizedText] : ['']);
    const vector = new Array(this.embeddingDimension).fill(0);

    for (const feature of features) {
      const digest = crypto.createHash('sha256').update(feature).digest();

      for (let slot = 0; slot < 4; slot++) {
        const offset = slot * 4;
        const rawIndex = digest.readUInt32LE(offset);
        const index = rawIndex % this.embeddingDimension;
        const sign = digest[16 + slot] % 2 === 0 ? 1 : -1;
        const weight = 1 + (digest[20 + slot] / 255);
        vector[index] += sign * weight;
      }
    }

    const compactText = normalizedText.replace(/\s+/g, '');
    for (let i = 0; i + 2 < compactText.length; i++) {
      const trigram = compactText.slice(i, i + 3);
      const digest = crypto.createHash('sha256').update(`gram:${trigram}`).digest();
      const index = digest.readUInt32LE(0) % this.embeddingDimension;
      const sign = digest[4] % 2 === 0 ? 1 : -1;
      vector[index] += sign * 0.5;
    }

    for (let i = 0; i + 1 < tokens.length; i++) {
      const tokenPair = `${tokens[i]}::${tokens[i + 1]}`;
      const digest = crypto.createHash('sha256').update(tokenPair).digest();
      const index = digest.readUInt32LE(0) % this.embeddingDimension;
      vector[index] += 0.75;
    }

    return this.normalizeVector(vector);
  }

  private normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + (value * value), 0));
    if (magnitude === 0) {
      return vector;
    }

    return vector.map((value) => value / magnitude);
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
