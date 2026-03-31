/**
 * Relationship Graph - Manage table relationships and join paths
 */

import {
  Relationship,
  TableMetadata,
  JoinPath,
  JoinStep,
  SemanticEngineError,
} from '../types';
import { createLogger } from '../utils/logger';
import { MetadataService } from '../services/metadataService';

const logger = createLogger('RelationshipGraph');

interface GraphNode {
  tableName: string;
  metadata: TableMetadata;
  neighbors: Relationship[];
}

interface PathSearchResult {
  path: JoinStep[];
  totalWeight: number;
  costEstimate: number;
}

export class RelationshipGraph {
  private nodes: Map<string, GraphNode> = new Map();
  private relationshipCache: Map<string, Relationship | null> = new Map();
  private pathCache: Map<string, JoinPath> = new Map();

  constructor(private metadataService: MetadataService) {
    this.buildGraph();
  }

  private buildGraph(): void {
    const startTime = Date.now();
    const tables = this.metadataService.getAllTables();

    // Create nodes for all tables
    for (const table of tables) {
      const tableName = table.table_name.toLowerCase();
      const neighbors = this.metadataService.findRelationshipsFrom(table.table_name);

      this.nodes.set(tableName, {
        tableName,
        metadata: table,
        neighbors,
      });
    }

    const ms = Date.now() - startTime;
    logger.info('Graph built', {
      tables: this.nodes.size,
      edges: this.metadataService.getRelationships().length,
      ms,
    });
  }

  /**
   * Get all neighbors of a table
   */
  getNeighbors(tableName: string): Relationship[] {
    const node = this.nodes.get(tableName.toLowerCase());
    if (!node) return [];
    return [...node.neighbors];
  }

  /**
   * Find relationship between two tables
   */
  findRelationship(fromTable: string, toTable: string): Relationship | null {
    const cacheKey = `${fromTable.toLowerCase()}_${toTable.toLowerCase()}`;

    if (this.relationshipCache.has(cacheKey)) {
      return this.relationshipCache.get(cacheKey) || null;
    }

    const rel = this.metadataService.findRelationship(fromTable, toTable);
    this.relationshipCache.set(cacheKey, rel || null);

    return rel;
  }

  /**
   * Resolve join path between two tables using BFS
   */
  resolvePath(fromTable: string, toTable: string, depth = 5): JoinPath {
    const cacheKey = `${fromTable.toLowerCase()}_${toTable.toLowerCase()}`;

    if (this.pathCache.has(cacheKey)) {
      return this.pathCache.get(cacheKey)!;
    }

    const tableFrom = fromTable.toLowerCase();
    const tableTo = toTable.toLowerCase();

    // Direct connection
    const directRel = this.findRelationship(fromTable, toTable);
    if (directRel) {
      const path = this.buildJoinPath(directRel);
      this.pathCache.set(cacheKey, path);
      return path;
    }

    // BFS for indirect paths
    const searchResult = this.bfsPath(tableFrom, tableTo, depth);

    if (!searchResult) {
      throw new SemanticEngineError(
        'NO_PATH',
        `Cannot find relationship path from ${fromTable} to ${toTable}`,
      );
    }

    const joinPath: JoinPath = {
      from_table: fromTable,
      to_table: toTable,
      path: searchResult.path,
      total_weight: searchResult.totalWeight,
      cost_estimate: searchResult.costEstimate,
    };

    this.pathCache.set(cacheKey, joinPath);
    return joinPath;
  }

  /**
   * Resolve multiple join paths
   */
  resolvePaths(tables: string[], depth = 5): Map<string, JoinPath> {
    const paths = new Map<string, JoinPath>();

    // Resolve paths between consecutive tables
    for (let i = 0; i < tables.length - 1; i++) {
      const from = tables[i];
      const to = tables[i + 1];
      const key = `${from}_${to}`;

      try {
        paths.set(key, this.resolvePath(from, to, depth));
      } catch (error) {
        logger.warn(`Cannot resolve path from ${from} to ${to}`, error);
      }
    }

    return paths;
  }

  /**
   * Find shortest path using BFS
   */
  private bfsPath(
    fromTable: string,
    toTable: string,
    maxDepth: number,
  ): PathSearchResult | null {
    const queue: Array<{
      currentTable: string;
      path: JoinStep[];
      visited: Set<string>;
      totalWeight: number;
    }> = [];

    const startNode = this.nodes.get(fromTable);
    if (!startNode) return null;

    queue.push({
      currentTable: fromTable,
      path: [],
      visited: new Set([fromTable]),
      totalWeight: 0,
    });

    let iterations = 0;
    const maxIterations = 10000; // Safety limit

    while (queue.length > 0 && iterations < maxIterations) {
      iterations++;

      const { currentTable, path, visited, totalWeight } = queue.shift()!;

      // Check if we've reached the target
      if (currentTable === toTable) {
        const costEstimate = this.estimateCost(path);
        return {
          path,
          totalWeight,
          costEstimate,
        };
      }

      // Stop if depth exceeded
      if (path.length >= maxDepth) {
        continue;
      }

      // Explore neighbors
      const neighbors = this.getNeighbors(currentTable);

      for (const neighbor of neighbors) {
        const nextTable = neighbor.to_table.toLowerCase();

        if (visited.has(nextTable)) {
          continue; // Already visited, skip to avoid cycles
        }

        const newVisited = new Set(visited);
        newVisited.add(nextTable);

        const joinStep: JoinStep = {
          table: currentTable,
          column: neighbor.from_column,
          next_table: nextTable,
          join_column: neighbor.to_column,
          join_type: this.selectJoinType(neighbor),
          relationship_type: neighbor.type,
        };

        const newWeight = totalWeight + (neighbor.weight || 1.0);

        queue.push({
          currentTable: nextTable,
          path: [...path, joinStep],
          visited: newVisited,
          totalWeight: newWeight,
        });
      }
    }

    return null;
  }

  /**
   * Build a JoinPath from a single relationship
   */
  private buildJoinPath(rel: Relationship): JoinPath {
    const step: JoinStep = {
      table: rel.from_table,
      column: rel.from_column,
      next_table: rel.to_table,
      join_column: rel.to_column,
      join_type: this.selectJoinType(rel),
      relationship_type: rel.type,
    };

    return {
      from_table: rel.from_table,
      to_table: rel.to_table,
      path: [step],
      total_weight: rel.weight || 1.0,
      cost_estimate: 1,
    };
  }

  /**
   * Select JOIN type based on relationship cardinality
   */
  private selectJoinType(rel: Relationship): 'inner' | 'left' | 'right' | 'full' {
    const cardinality = rel.cardinality || '1:N';

    // Prefer INNER for FK relationships
    if (rel.type === 'fk') {
      return 'inner';
    }

    // LEFT JOIN for business relationships to avoid losing data
    return 'left';
  }

  /**
   * Estimate query cost based on join path
   */
  private estimateCost(path: JoinStep[]): number {
    // Simple cost estimation: number of joins + 1
    return path.length + 1;
  }

  /**
   * Clear caches
   */
  clearCache(): void {
    this.relationshipCache.clear();
    this.pathCache.clear();
    logger.info('Caches cleared');
  }

  /**
   * Get graph statistics
   */
  getStats(): {
    tables: number;
    relationships: number;
    cached_paths: number;
  } {
    return {
      tables: this.nodes.size,
      relationships: this.metadataService.getRelationships().length,
      cached_paths: this.pathCache.size,
    };
  }
}
