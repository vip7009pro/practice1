"use strict";
/**
 * Metadata Service - Load and manage table/column metadata
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const types_1 = require("../types");
const logger_1 = require("../utils/logger");
const helpers_1 = require("../utils/helpers");
const constants_1 = require("../config/constants");
const logger = logger_1.createLogger('MetadataService');
class MetadataService {
    constructor() {
        this.tables = new Map();
        this.columns = new Map(); // table_name -> columns
        this.metrics = new Map();
        this.relationships = [];
        this.glossary = [];
        this._isLoaded = false;
    }
    async initialize(metadataDir) {
        const dir = this.resolveMetadataDir(metadataDir);
        // Clear all state before reloading to prevent duplicates on re-initialize
        this.tables = new Map();
        this.columns = new Map();
        this.metrics = new Map();
        this.relationships = [];
        this.glossary = [];
        this._isLoaded = false;
        try {
            await this.loadTables(path_1.default.join(dir, constants_1.METADATA_CONFIG.TABLES_FILE));
            await this.loadColumns(path_1.default.join(dir, constants_1.METADATA_CONFIG.COLUMNS_FILE));
            await this.loadRelationships(path_1.default.join(dir, constants_1.METADATA_CONFIG.RELATIONSHIPS_FILE));
            await this.loadMetrics(path_1.default.join(dir, constants_1.METADATA_CONFIG.METRICS_FILE));
            await this.loadGlossary(path_1.default.join(dir, constants_1.METADATA_CONFIG.GLOSSARY_FILE));
            this._isLoaded = true;
            logger.info('Metadata initialized successfully', {
                tables: this.tables.size,
                columns: Array.from(this.columns.values()).flat().length,
                metrics: this.metrics.size,
                relationships: this.relationships.length,
            });
        }
        catch (error) {
            logger.error('Failed to initialize metadata', error);
            throw error;
        }
    }
    async loadTables(filePath) {
        const data = this.loadJsonFile(filePath);
        const tableList = data.tables || [];
        for (const table of tableList) {
            this.tables.set(table.table_name.toLowerCase(), table);
        }
        logger.info(`Loaded ${tableList.length} table definitions`);
    }
    async loadColumns(filePath) {
        const data = this.loadJsonFile(filePath);
        const columnList = data.columns || [];
        for (const column of columnList) {
            const tableName = column.table_name.toLowerCase();
            if (!this.columns.has(tableName)) {
                this.columns.set(tableName, []);
            }
            this.columns.get(tableName).push(column);
        }
        logger.info(`Loaded ${columnList.length} column definitions`);
    }
    async loadRelationships(filePath) {
        const data = this.loadJsonFile(filePath);
        const rawRelationships = data.relationships || [];
        // Normalize relationship property names: source_table -> from_table, etc.
        this.relationships = rawRelationships
            .filter((rel) => {
            // Skip relationships with undefined properties
            const fromTable = rel.from_table || rel.source_table;
            const toTable = rel.to_table || rel.target_table;
            if (!fromTable || !toTable) {
                logger.warn('Skipping relationship with undefined table', rel);
                return false;
            }
            return true;
        })
            .map((rel) => ({
            ...rel,
            // Normalize property names
            from_table: rel.from_table || rel.source_table,
            from_column: rel.from_column || rel.source_column,
            to_table: rel.to_table || rel.target_table,
            to_column: rel.to_column || rel.target_column,
        }));
        logger.info(`Loaded ${this.relationships.length} relationships (after normalization)`);
    }
    async loadMetrics(filePath) {
        const data = this.loadJsonFile(filePath);
        const metricList = data.metrics || [];
        for (const metric of metricList) {
            this.metrics.set(metric.id.toLowerCase(), metric);
        }
        logger.info(`Loaded ${metricList.length} business metrics`);
    }
    async loadGlossary(filePath) {
        const data = this.loadJsonFile(filePath);
        this.glossary = data.glossary || [];
        logger.info(`Loaded ${this.glossary.length} glossary entries`);
    }
    loadJsonFile(filePath) {
        if (!fs_1.default.existsSync(filePath)) {
            const fallbackPath = path_1.default.join(constants_1.METADATA_CONFIG.BUNDLED_METADATA_DIR, path_1.default.basename(filePath));
            if (fallbackPath !== filePath && fs_1.default.existsSync(fallbackPath)) {
                try {
                    const fallbackContent = fs_1.default.readFileSync(fallbackPath, 'utf-8');
                    return JSON.parse(fallbackContent);
                }
                catch (error) {
                    throw new types_1.MetadataError(`Failed to parse metadata file: ${fallbackPath}`, error);
                }
            }
            throw new types_1.MetadataError(`Metadata file not found: ${filePath}`);
        }
        try {
            const content = fs_1.default.readFileSync(filePath, 'utf-8');
            return JSON.parse(content);
        }
        catch (error) {
            throw new types_1.MetadataError(`Failed to parse metadata file: ${filePath}`, error);
        }
    }
    resolveMetadataDir(metadataDir) {
        const provided = String(metadataDir || '').trim();
        if (provided) {
            if (path_1.default.isAbsolute(provided)) {
                return provided;
            }
            if (process.pkg) {
                return constants_1.METADATA_CONFIG.METADATA_DIR;
            }
            return path_1.default.resolve(provided);
        }
        return constants_1.METADATA_CONFIG.METADATA_DIR;
    }
    // ============ TABLE QUERIES ============
    getTable(tableName) {
        return this.tables.get(tableName.toLowerCase()) || null;
    }
    getAllTables() {
        return Array.from(this.tables.values());
    }
    findTablesByBusinessName(query, topK = 5) {
        const normalized = helpers_1.normalizeText(query);
        const scored = Array.from(this.tables.values())
            .map((table) => {
            const score = Math.max(helpers_1.stringSimilarity(normalized, table.business_name), helpers_1.stringSimilarity(normalized, table.table_name));
            // Bonus for synonym match
            let synonymScore = 0;
            if (table.synonyms) {
                for (const syn of table.synonyms) {
                    const synScore = helpers_1.stringSimilarity(normalized, syn);
                    if (synScore > synonymScore) {
                        synonymScore = synScore;
                    }
                }
            }
            return {
                table,
                score: Math.max(score, synonymScore),
            };
        })
            .filter((item) => item.score > 0)
            .sort((a, b) => b.score - a.score);
        return scored.slice(0, topK).map((item) => item.table);
    }
    // ============ COLUMN QUERIES ============
    getColumns(tableName) {
        return this.columns.get(tableName.toLowerCase()) || [];
    }
    getColumn(tableName, columnName) {
        const columns = this.columns.get(tableName.toLowerCase()) || [];
        return columns.find((c) => c.column_name.toLowerCase() === columnName.toLowerCase()) || null;
    }
    findColumnsByTable(tableName, query, topK = 5) {
        const columns = this.columns.get(tableName.toLowerCase()) || [];
        const normalized = helpers_1.normalizeText(query);
        const scored = columns
            .map((column) => {
            const score = Math.max(helpers_1.stringSimilarity(normalized, column.business_name), helpers_1.stringSimilarity(normalized, column.column_name));
            let synonymScore = 0;
            if (column.synonyms) {
                for (const syn of column.synonyms) {
                    const synScore = helpers_1.stringSimilarity(normalized, syn);
                    if (synScore > synonymScore) {
                        synonymScore = synScore;
                    }
                }
            }
            return { column, score: Math.max(score, synonymScore) };
        })
            .filter((item) => item.score > 0)
            .sort((a, b) => b.score - a.score);
        return scored.slice(0, topK).map((item) => item.column);
    }
    // ============ METRIC QUERIES ============
    getMetric(metricId) {
        return this.metrics.get(metricId.toLowerCase()) || null;
    }
    getAllMetrics() {
        return Array.from(this.metrics.values());
    }
    findMetricsByName(query, topK = 5) {
        const normalized = helpers_1.normalizeText(query);
        const scored = Array.from(this.metrics.values())
            .map((metric) => {
            const score = Math.max(helpers_1.stringSimilarity(normalized, metric.name), helpers_1.stringSimilarity(normalized, metric.business_name), helpers_1.stringSimilarity(normalized, metric.id));
            return { metric, score };
        })
            .filter((item) => item.score > 0)
            .sort((a, b) => b.score - a.score);
        return scored.slice(0, topK).map((item) => item.metric);
    }
    validateMetric(metric) {
        const errors = [];
        if (!metric.id || !metric.name || !metric.formula || !metric.tables) {
            errors.push('Metric missing required fields: id, name, formula, tables');
        }
        // Validate tables exist in metadata
        for (const tableName of metric.tables || []) {
            if (!this.getTable(tableName)) {
                errors.push(`Table not found in metadata: ${tableName}`);
            }
        }
        return {
            valid: errors.length === 0,
            errors,
        };
    }
    // ============ RELATIONSHIP QUERIES ============
    getRelationships() {
        return [...this.relationships];
    }
    findRelationshipsFrom(tableName) {
        return this.relationships.filter((r) => r.from_table.toLowerCase() === tableName.toLowerCase());
    }
    findRelationshipsTo(tableName) {
        return this.relationships.filter((r) => r.to_table.toLowerCase() === tableName.toLowerCase());
    }
    findRelationship(fromTable, toTable) {
        return (this.relationships.find((r) => r.from_table.toLowerCase() === fromTable.toLowerCase() &&
            r.to_table.toLowerCase() === toTable.toLowerCase()) || null);
    }
    // ============ GLOSSARY QUERIES ============
    resolveBusinessTerm(userTerm) {
        const normalized = helpers_1.normalizeText(userTerm);
        for (const entry of this.glossary) {
            const userTerms = entry.user_terms || [];
            for (const term of userTerms) {
                if (helpers_1.normalizeText(term) === normalized) {
                    return entry.canonical_term;
                }
            }
            // Fuzzy match
            const bestMatch = helpers_1.findBestMatch(userTerm, userTerms, 0.7);
            if (bestMatch) {
                return entry.canonical_term;
            }
        }
        return null;
    }
    getLikeGlossaryEntries(userTerm, topK = 3) {
        const normalized = helpers_1.normalizeText(userTerm);
        const scored = this.glossary
            .map((entry) => {
            let score = 0;
            // Match against user terms
            for (const term of entry.user_terms || []) {
                const termScore = helpers_1.stringSimilarity(normalized, helpers_1.normalizeText(term));
                if (termScore > score) {
                    score = termScore;
                }
            }
            // Match against canonical term
            const canonScore = helpers_1.stringSimilarity(normalized, helpers_1.normalizeText(entry.canonical_term));
            if (canonScore > score) {
                score = canonScore;
            }
            return { entry, score };
        })
            .filter((item) => item.score > 0)
            .sort((a, b) => b.score - a.score);
        return scored.slice(0, topK).map((item) => item.entry);
    }
    // ============ UTILITIES ============
    isLoaded() {
        return this._isLoaded;
    }
    getStats() {
        return {
            tables: this.tables.size,
            columns: Array.from(this.columns.values()).flat().length,
            metrics: this.metrics.size,
            relationships: this.relationships.length,
        };
    }
}
exports.MetadataService = MetadataService;
// Export singleton
let instance = null;
async function getMetadataService(metadataDir) {
    if (!instance) {
        instance = new MetadataService();
        await instance.initialize(metadataDir);
    }
    return instance;
}
exports.getMetadataService = getMetadataService;
function resetMetadataService() {
    instance = null;
}
exports.resetMetadataService = resetMetadataService;
