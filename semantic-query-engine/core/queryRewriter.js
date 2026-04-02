"use strict";
/**
 * Query Rewriter - Normalize and rewrite user queries
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("../types");
const logger_1 = require("../utils/logger");
const helpers_1 = require("../utils/helpers");
const dayjs_1 = __importDefault(require("dayjs"));
const logger = logger_1.createLogger('QueryRewriter');
class QueryRewriter {
    constructor(metadataService) {
        this.metadataService = metadataService;
    }
    async rewrite(userQuery) {
        const startTime = Date.now();
        try {
            const originalText = String(userQuery || '').trim();
            if (!originalText) {
                throw new types_1.SemanticEngineError('INVALID_QUERY', 'Query cannot be empty');
            }
            const normalizedText = helpers_1.normalizeText(originalText, false); // Keep case initially
            const tokens = helpers_1.tokenize(originalText);
            // Detect intents
            const intents = this.detectIntents(originalText);
            // Detect metrics
            const metrics = this.detectMetrics(tokens);
            // Detect dimensions (grouping columns)
            const dimensions = this.detectDimensions(tokens);
            // Detect filters
            const filters = this.detectFilters(originalText, tokens);
            // Detect entities (tables, business concepts)
            const entities = this.detectEntities(tokens);
            const rewrittenMs = Date.now() - startTime;
            const result = {
                original_text: originalText,
                normalized_text: normalizedText,
                detected_intents: intents,
                detected_metrics: metrics,
                detected_dimensions: dimensions,
                detected_filters: filters,
                entities,
                llm_used: false,
                rewrite_ms: rewrittenMs,
            };
            logger.info('Query rewritten', {
                original: originalText,
                intents,
                metrics: metrics.length,
                dimensions: dimensions.length,
                filters: filters.length,
                ms: rewrittenMs,
            });
            return result;
        }
        catch (error) {
            logger.error('Failed to rewrite query', error);
            throw error;
        }
    }
    detectIntents(query) {
        const lower = query.toLowerCase();
        const intents = [];
        // List/browse detection - check this FIRST before metric detection
        if (/danh sách|list|xem|browse|hiển thị|lịch sử|history/.test(lower)) {
            intents.push('list_query');
        }
        // Metric query detection - skip if already list_query
        if (!intents.includes('list_query') &&
            /doanh thu|lợi nhuận|profit|revenue|sales|tính|giá trị/.test(lower)) {
            intents.push('metric_query');
        }
        // Dimension breakdown
        if (/theo|group|nhóm by|breakdown|chi tiết|từng|mỗi/.test(lower)) {
            intents.push('dimension_breakdown');
        }
        // Comparison
        if (/so với|vs|so sánh|giữa|with|compared to|vs|versus/.test(lower)) {
            intents.push('comparison');
        }
        // Top/ranking
        if (/top|hàng đầu|cao nhất|lớn nhất|bán chạy|nhiều nhất|least|thấp/.test(lower)) {
            intents.push('ranking');
        }
        // Trend analysis
        if (/trend|xu hướng|tăng|giảm|growth|decline|development/.test(lower)) {
            intents.push('trend_analysis');
        }
        // Filter/search
        if (/tìm|find|search|lọc|filter|where/.test(lower)) {
            intents.push('filter_query');
        }
        if (intents.length === 0) {
            intents.push('unknown');
        }
        return intents;
    }
    detectMetrics(tokens) {
        const metrics = this.metadataService.getAllMetrics();
        const detectedMetrics = [];
        const seenIds = new Set();
        for (const metric of metrics) {
            const metricTerms = [
                metric.name.toLowerCase(),
                metric.business_name.toLowerCase(),
                metric.id.toLowerCase(),
            ];
            for (const token of tokens) {
                for (const term of metricTerms) {
                    if (term.includes(token) || token === term) {
                        if (!seenIds.has(metric.id)) {
                            detectedMetrics.push(metric.id);
                            seenIds.add(metric.id);
                        }
                    }
                }
            }
        }
        return detectedMetrics;
    }
    detectDimensions(tokens) {
        const allColumns = Array.from(this.metadataService.getStats().columns || []);
        const dimensions = [];
        const seenDims = new Set();
        // Common dimension keywords
        const commonDimensions = ['region', 'category', 'status', 'order_date', 'customer_id', 'product_id', 'department_id'];
        for (const dim of commonDimensions) {
            for (const token of tokens) {
                if (dim.toLowerCase().includes(token.toLowerCase()) || token.toLowerCase().includes(dim.toLowerCase())) {
                    if (!seenDims.has(dim)) {
                        dimensions.push(dim);
                        seenDims.add(dim);
                    }
                }
            }
        }
        return dimensions;
    }
    detectFilters(query, tokens) {
        const filters = [];
        // Time filters
        const timeFilters = this.extractTimeFilters(query);
        filters.push(...timeFilters);
        // Status filters
        const statusFilters = this.extractStatusFilters(query);
        filters.push(...statusFilters);
        // Region filters
        const regionFilters = this.extractRegionFilters(query, tokens);
        filters.push(...regionFilters);
        return filters;
    }
    extractTimeFilters(query) {
        const filters = [];
        const lower = query.toLowerCase();
        if (/hôm nay|today|cái nay/.test(lower)) {
            const today = dayjs_1.default().format('YYYY-MM-DD');
            filters.push({
                column: 'order_date',
                operator: 'eq',
                value: today,
            });
        }
        else if (/tháng này|this month|tháng hiện tại/.test(lower)) {
            const startOfMonth = dayjs_1.default().startOf('month').format('YYYY-MM-DD');
            const endOfMonth = dayjs_1.default().endOf('month').format('YYYY-MM-DD');
            filters.push({
                column: 'order_date',
                operator: 'gte',
                value: startOfMonth,
            });
            filters.push({
                column: 'order_date',
                operator: 'lte',
                value: endOfMonth,
            });
        }
        else if (/tuần này|this week|7 ngày qua/.test(lower)) {
            const startOfWeek = dayjs_1.default().subtract(7, 'day').format('YYYY-MM-DD');
            filters.push({
                column: 'order_date',
                operator: 'gte',
                value: startOfWeek,
            });
        }
        else if (/năm này|this year|năm nay/.test(lower)) {
            const startOfYear = dayjs_1.default().startOf('year').format('YYYY-MM-DD');
            const endOfYear = dayjs_1.default().endOf('year').format('YYYY-MM-DD');
            filters.push({
                column: 'order_date',
                operator: 'gte',
                value: startOfYear,
            });
            filters.push({
                column: 'order_date',
                operator: 'lte',
                value: endOfYear,
            });
        }
        return filters;
    }
    extractStatusFilters(query) {
        const filters = [];
        const lower = query.toLowerCase();
        const statusMap = {
            active: ['active', 'hoạt động', 'đang hoạt động'],
            confirmed: ['confirmed', 'xác nhận', 'đã xác nhận'],
            shipped: ['shipped', 'vận chuyển', 'đã gửi'],
            delivered: ['delivered', 'giao hàng', 'đã giao'],
            cancelled: ['cancelled', 'hủy', 'đã hủy'],
        };
        for (const [statusValue, keywords] of Object.entries(statusMap)) {
            for (const keyword of keywords) {
                if (lower.includes(keyword)) {
                    filters.push({
                        column: 'status',
                        operator: 'eq',
                        value: statusValue,
                    });
                    break;
                }
            }
        }
        return filters;
    }
    extractRegionFilters(query, tokens) {
        const filters = [];
        const commonRegions = ['hà nội', 'tp hcm', 'đà nẵng', 'hải phòng', 'cần thơ', 'miền bắc', 'miền nam', 'miền trung'];
        for (const region of commonRegions) {
            if (query.toLowerCase().includes(region)) {
                filters.push({
                    column: 'region',
                    operator: 'contains',
                    value: region,
                });
            }
        }
        return filters;
    }
    detectEntities(tokens) {
        const entities = [];
        const tables = this.metadataService.getAllTables();
        for (const token of tokens) {
            for (const table of tables) {
                const comparableTableName = helpers_1.normalizeText(table.table_name).split(' ');
                const comparableBusinessName = helpers_1.normalizeText(table.business_name).split(' ');
                if (comparableTableName.some((part) => part === token) ||
                    comparableBusinessName.some((part) => part === token)) {
                    if (!entities.includes(table.table_name)) {
                        entities.push(table.table_name);
                    }
                }
            }
        }
        return entities;
    }
}
exports.QueryRewriter = QueryRewriter;
