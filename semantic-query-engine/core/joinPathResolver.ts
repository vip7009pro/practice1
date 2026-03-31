/**
 * Join Path Resolver - Resolve optimal join paths between tables
 */

import {
  JoinPath,
  ExpandedContext,
  SemanticEngineError,
} from '../types';
import { createLogger } from '../utils/logger';
import { RelationshipGraph } from './relationshipGraph';

const logger = createLogger('JoinPathResolver');

export class JoinPathResolver {
  constructor(private graph: RelationshipGraph) {}

  /**
   * Resolve join path between two tables
   */
  resolve(fromTable: string, toTable: string, depth = 5): JoinPath {
    const startTime = Date.now();

    try {
      const path = this.graph.resolvePath(fromTable, toTable, depth);
      const ms = Date.now() - startTime;
      path.resolution_ms = ms;

      logger.info(`Resolved path ${fromTable} -> ${toTable}`, {
        steps: path.path.length,
        weight: path.total_weight,
        cost: path.cost_estimate,
        ms,
      });

      return path;
    } catch (error) {
      logger.error(`Failed to resolve path ${fromTable} -> ${toTable}`, error);
      throw error;
    }
  }

  /**
   * Resolve multiple join paths for a set of tables
   */
  resolveMultiple(tables: string[], depth = 5): Map<string, JoinPath> {
    const startTime = Date.now();
    const paths = this.graph.resolvePaths(tables, depth);
    const ms = Date.now() - startTime;

    logger.info('Resolved multiple paths', {
      tables: tables.length,
      paths: paths.size,
      ms,
    });

    return paths;
  }

  /**
   * Find join paths for an expanded context
   */
  resolveForContext(context: ExpandedContext): Map<string, JoinPath> {
    const allTableNames = [
      ...context.main_tables.map((t) => t.table_name),
      ...context.related_tables.map((t) => t.table_name),
    ];

    return this.resolveMultiple(allTableNames, context.expansion_depth);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.graph.clearCache();
  }
}
