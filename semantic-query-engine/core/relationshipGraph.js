"use strict";
/**
 * Relationship Graph - Manage table relationships and join paths
 */
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("../types");
const logger_1 = require("../utils/logger");
const logger = logger_1.createLogger('RelationshipGraph');
class RelationshipGraph {
    constructor(metadataService) {
        this.metadataService = metadataService;
        this.nodes = new Map();
        this.relationshipCache = new Map();
        this.pathCache = new Map();
        this.buildGraph();
    }
    buildGraph() {
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
    getNeighbors(tableName) {
        const node = this.nodes.get(tableName.toLowerCase());
        if (!node)
            return [];
        return [...node.neighbors];
    }
    /**
     * Find relationship between two tables
     */
    findRelationship(fromTable, toTable) {
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
    resolvePath(fromTable, toTable, depth = 5) {
        const cacheKey = `${fromTable.toLowerCase()}_${toTable.toLowerCase()}`;
        if (this.pathCache.has(cacheKey)) {
            return this.pathCache.get(cacheKey);
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
            throw new types_1.SemanticEngineError('NO_PATH', `Cannot find relationship path from ${fromTable} to ${toTable}`);
        }
        const joinPath = {
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
    resolvePaths(tables, depth = 5) {
        const paths = new Map();
        // Resolve paths between consecutive tables
        for (let i = 0; i < tables.length - 1; i++) {
            const from = tables[i];
            const to = tables[i + 1];
            const key = `${from}_${to}`;
            try {
                paths.set(key, this.resolvePath(from, to, depth));
            }
            catch (error) {
                logger.warn(`Cannot resolve path from ${from} to ${to}`, error);
                // Log additional debugging info
                const fromNode = this.nodes.get(from.toLowerCase());
                const toNode = this.nodes.get(to.toLowerCase());
                if (!fromNode) {
                    logger.warn(`  -> Table '${from}' not found in graph. Available tables: ${Array.from(this.nodes.keys()).slice(0, 5).join(', ')}...`);
                }
                else {
                    logger.warn(`  -> Table '${from}' has ${fromNode.neighbors.length} direct relationships`);
                }
                if (!toNode) {
                    logger.warn(`  -> Table '${to}' not found in graph`);
                }
                logger.warn(`  -> Reason: ${error?.message || 'Path not found'}`);
                logger.warn(`  -> Suggestion: Check metadata relationships or simplify the query`);
            }
        }
        return paths;
    }
    /**
     * Find shortest path using BFS
     */
    bfsPath(fromTable, toTable, maxDepth) {
        const queue = [];
        const startNode = this.nodes.get(fromTable);
        if (!startNode)
            return null;
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
            const { currentTable, path, visited, totalWeight } = queue.shift();
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
                const joinStep = {
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
    buildJoinPath(rel) {
        const step = {
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
    selectJoinType(rel) {
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
    estimateCost(path) {
        // Simple cost estimation: number of joins + 1
        return path.length + 1;
    }
    /**
     * Clear caches
     */
    clearCache() {
        this.relationshipCache.clear();
        this.pathCache.clear();
        logger.info('Caches cleared');
    }
    /**
     * Get graph statistics
     */
    getStats() {
        return {
            tables: this.nodes.size,
            relationships: this.metadataService.getRelationships().length,
            cached_paths: this.pathCache.size,
        };
    }
}
exports.RelationshipGraph = RelationshipGraph;
