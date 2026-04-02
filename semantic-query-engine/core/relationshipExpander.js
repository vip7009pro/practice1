"use strict";
/**
 * Relationship Expander - Expand schema context using relationships
 */
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("../types");
const logger_1 = require("../utils/logger");
const logger = logger_1.createLogger('RelationshipExpander');
class RelationshipExpander {
    constructor(metadataService, graph) {
        this.metadataService = metadataService;
        this.graph = graph;
    }
    async expand(schema, depth = 2) {
        const startTime = Date.now();
        try {
            const mainTables = schema.relevant_tables;
            const relatedTables = this.expandTables(mainTables, depth);
            const allColumnsMap = this.buildColumnsMap([...mainTables, ...relatedTables]);
            const relationships = this.collectRelationships(mainTables, relatedTables, schema.relevant_metrics);
            const expandedMs = Date.now() - startTime;
            const context = {
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
        }
        catch (error) {
            logger.error('Failed to expand context', error);
            throw new types_1.SemanticEngineError('EXPANSION_FAILED', 'Context expansion failed', error);
        }
    }
    /**
     * Expand tables by following relationships
     */
    expandTables(mainTables, maxDepth) {
        const expandedSet = new Map();
        const queue = mainTables.map((t) => ({ table: t, depth: 0 }));
        const visited = new Set(mainTables.map((t) => t.table_name.toLowerCase()));
        while (queue.length > 0) {
            const { table, depth } = queue.shift();
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
    buildColumnsMap(tables) {
        const map = new Map();
        for (const table of tables) {
            const columns = this.metadataService.getColumns(table.table_name);
            map.set(table.table_name.toLowerCase(), columns);
        }
        return map;
    }
    /**
     * Collect relevant relationships
     */
    collectRelationships(mainTables, relatedTables, metrics) {
        const allTables = [...mainTables, ...relatedTables];
        const tableNames = new Set(allTables.map((t) => t.table_name.toLowerCase()));
        const relationships = [];
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
    async expandForMetric(metric) {
        try {
            const metricTables = [];
            for (const tableName of metric.tables) {
                const table = this.metadataService.getTable(tableName);
                if (table) {
                    metricTables.push(table);
                }
            }
            if (metricTables.length === 0) {
                throw new types_1.SemanticEngineError('METRIC_TABLES_NOT_FOUND', `Tables for metric ${metric.id} not found in metadata`);
            }
            return this.expand({
                relevant_tables: metricTables,
                relevant_columns: [],
                relevant_metrics: [metric],
            }, 2);
        }
        catch (error) {
            logger.error('Failed to expand for metric', error);
            throw error;
        }
    }
}
exports.RelationshipExpander = RelationshipExpander;
