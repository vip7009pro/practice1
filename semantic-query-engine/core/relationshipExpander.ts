/**
 * Relationship Expander - Expand schema context using relationships
 */

import {
  ResolvedSchema,
  ExpandedContext,
  Relationship,
  TableMetadata,
  ColumnMetadata,
  BusinessMetric,
  SemanticEngineError,
} from '../types';
import { createLogger } from '../utils/logger';
import { MetadataService } from '../services/metadataService';
import { RelationshipGraph } from './relationshipGraph';

const logger = createLogger('RelationshipExpander');

export class RelationshipExpander {
  constructor(
    private metadataService: MetadataService,
    private graph: RelationshipGraph,
  ) {}

  async expand(schema: ResolvedSchema, depth = 2): Promise<ExpandedContext> {
    const startTime = Date.now();

    try {
      const mainTables = schema.relevant_tables;
      const relatedTables = this.expandTables(mainTables, depth);
      const allColumnsMap = this.buildColumnsMap([...mainTables, ...relatedTables]);
      const relationships = this.collectRelationships(mainTables, relatedTables, schema.relevant_metrics);

      const expandedMs = Date.now() - startTime;

      const context: ExpandedContext = {
        main_tables: mainTables,
        related_tables: relatedTables,
        all_columns_map: allColumnsMap,
        relationships,
        metrics_context: schema.relevant_metrics,
        expansion_depth: depth,
        expansion_ms: expandedMs,
      };

      logger.info('Context expanded', {
        mainTables: mainTables.length,
        relatedTables: relatedTables.length,
        relationships: relationships.length,
        depth,
        ms: expandedMs,
      });

      return context;
    } catch (error) {
      logger.error('Failed to expand context', error);
      throw new SemanticEngineError('EXPANSION_FAILED', 'Context expansion failed', error);
    }
  }

  /**
   * Expand tables by following relationships
   */
  private expandTables(mainTables: TableMetadata[], maxDepth: number): TableMetadata[] {
    const expandedSet = new Map<string, TableMetadata>();

    const queue: Array<{
      table: TableMetadata;
      depth: number;
    }> = mainTables.map((t) => ({ table: t, depth: 0 }));

    const visited = new Set<string>(mainTables.map((t) => t.table_name.toLowerCase()));

    while (queue.length > 0) {
      const { table, depth } = queue.shift()!;

      if (depth >= maxDepth) {
        continue;
      }

      const neighbors = this.graph.getNeighbors(table.table_name);

      for (const rel of neighbors) {
        const neighborName = rel.to_table.toLowerCase();

        if (visited.has(neighborName)) {
          continue;
        }

        const neighborTable = this.metadataService.getTable(rel.to_table);
        if (neighborTable) {
          visited.add(neighborName);
          expandedSet.set(neighborName, neighborTable);
          queue.push({ table: neighborTable, depth: depth + 1 });
        }
      }
    }

    return Array.from(expandedSet.values());
  }

  /**
   * Build map of tables to their columns
   */
  private buildColumnsMap(tables: TableMetadata[]): Map<string, ColumnMetadata[]> {
    const map = new Map<string, ColumnMetadata[]>();

    for (const table of tables) {
      const columns = this.metadataService.getColumns(table.table_name);
      map.set(table.table_name.toLowerCase(), columns);
    }

    return map;
  }

  /**
   * Collect relevant relationships
   */
  private collectRelationships(
    mainTables: TableMetadata[],
    relatedTables: TableMetadata[],
    metrics: BusinessMetric[],
  ): Relationship[] {
    const allTables = [...mainTables, ...relatedTables];
    const tableNames = new Set(allTables.map((t) => t.table_name.toLowerCase()));

    const relationships: Relationship[] = [];
    const allRels = this.metadataService.getRelationships();

    for (const rel of allRels) {
      const fromLower = rel.from_table.toLowerCase();
      const toLower = rel.to_table.toLowerCase();

      // Include if both tables are in the expanded context
      if (tableNames.has(fromLower) && tableNames.has(toLower)) {
        relationships.push(rel);
      }
    }

    // Add relationships from metrics
    for (const metric of metrics) {
      for (const metricTable of metric.tables) {
        for (const table of allTables) {
          if (table.table_name.toLowerCase() === metricTable.toLowerCase()) {
            // This table is relevant for the metric
          }
        }
      }
    }

    return relationships;
  }

  /**
   * Expand for a specific metric
   */
  async expandForMetric(metric: BusinessMetric): Promise<ExpandedContext> {
    try {
      const metricTables: TableMetadata[] = [];

      for (const tableName of metric.tables) {
        const table = this.metadataService.getTable(tableName);
        if (table) {
          metricTables.push(table);
        }
      }

      if (metricTables.length === 0) {
        throw new SemanticEngineError(
          'METRIC_TABLES_NOT_FOUND',
          `Tables for metric ${metric.id} not found in metadata`,
        );
      }

      return this.expand(
        {
          relevant_tables: metricTables,
          relevant_columns: [],
          relevant_metrics: [metric],
        },
        2,
      );
    } catch (error) {
      logger.error('Failed to expand for metric', error);
      throw error;
    }
  }
}
