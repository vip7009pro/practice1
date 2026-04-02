"use strict";
/**
 * Helper Utilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Normalize text: trim, case, remove accents, remove extra whitespace
 */
function normalizeText(text, lowercase = true) {
    let normalized = String(text || '')
        .trim()
        // Remove Vietnamese diacritics
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    if (lowercase) {
        normalized = normalized.toLowerCase();
    }
    // Remove extra whitespace
    normalized = normalized.replace(/\s+/g, ' ');
    return normalized;
}
exports.normalizeText = normalizeText;
/**
 * Tokenize text into words (length >= 2)
 */
function tokenize(text) {
    const normalized = normalizeText(text);
    const tokens = normalized
        .split(/[^a-z0-9_]+/gi)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2);
    return Array.from(new Set(tokens)); // Remove duplicates
}
exports.tokenize = tokenize;
/**
 * Fuzzy string matching (basic Levenshtein-like similarity)
 */
function stringSimilarity(a, b) {
    const normA = normalizeText(a);
    const normB = normalizeText(b);
    if (normA === normB)
        return 1.0;
    if (normA.length === 0 || normB.length === 0)
        return 0;
    // Simple containment check
    if (normA.includes(normB) || normB.includes(normA))
        return 0.85;
    // Token overlap
    const tokensA = new Set(tokenize(a));
    const tokensB = new Set(tokenize(b));
    const intersection = Array.from(tokensA).filter((t) => tokensB.has(t));
    const union = Array.from(new Set([...tokensA, ...tokensB]));
    if (union.length === 0)
        return 0;
    return intersection.length / union.length;
}
exports.stringSimilarity = stringSimilarity;
/**
 * Find best match in array of candidates
 */
function findBestMatch(query, candidates, threshold = 0.6) {
    if (candidates.length === 0)
        return null;
    const scores = candidates.map((cand) => ({
        candidate: cand,
        score: stringSimilarity(query, cand),
    }));
    scores.sort((a, b) => b.score - a.score);
    const best = scores[0];
    return best.score >= threshold ? best.candidate : null;
}
exports.findBestMatch = findBestMatch;
/**
 * Escape SQL string literal
 */
function escapeSqlString(value) {
    return String(value || '').replace(/'/g, "''");
}
exports.escapeSqlString = escapeSqlString;
/**
 * Check if string is SQL-like (begins with SELECT or WITH)
 */
function isLikelySqlQuery(text) {
    const normalized = normalizeText(text, true).trim();
    return normalized.startsWith('select') || normalized.startsWith('with');
}
exports.isLikelySqlQuery = isLikelySqlQuery;
/**
 * Remove SQL comments
 */
function stripSqlComments(sql) {
    let s = String(sql || '');
    // Remove single-line comments (--...)
    s = s.replace(/--.*$/gm, '');
    // Remove multi-line comments (/* ... */)
    s = s.replace(/\/\*[\s\S]*?\*\//g, '');
    return s.trim();
}
exports.stripSqlComments = stripSqlComments;
/**
 * Format number with thousand separators
 */
function formatNumber(num, locale = 'vi-VN') {
    const n = typeof num === 'string' ? parseFloat(num) : num;
    if (!Number.isFinite(n))
        return String(num);
    return new Intl.NumberFormat(locale).format(n);
}
exports.formatNumber = formatNumber;
/**
 * Format currency
 */
function formatCurrency(amount, currency = 'VND', locale = 'vi-VN') {
    const n = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (!Number.isFinite(n))
        return String(amount);
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(n);
}
exports.formatCurrency = formatCurrency;
/**
 * Deep clone with date handling
 */
function deepClone(obj) {
    if (obj === null || typeof obj !== 'object')
        return obj;
    if (obj instanceof Date)
        return new Date(obj.getTime());
    if (obj instanceof Array) {
        return obj.map((item) => deepClone(item));
    }
    if (obj instanceof Object) {
        const cloned = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                cloned[key] = deepClone(obj[key]);
            }
        }
        return cloned;
    }
    return obj;
}
exports.deepClone = deepClone;
/**
 * Sleep for N milliseconds
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
exports.sleep = sleep;
/**
 * Retry async function with exponential backoff
 */
async function retry(fn, maxRetries = 3, initialDelayMs = 100) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            if (attempt < maxRetries) {
                const delayMs = initialDelayMs * Math.pow(2, attempt);
                await sleep(delayMs);
            }
        }
    }
    throw lastError;
}
exports.retry = retry;
/**
 * Measure execution time
 */
async function measureTime(fn) {
    const start = Date.now();
    const result = await fn();
    const duration = Date.now() - start;
    return [result, duration];
}
exports.measureTime = measureTime;
/**
 * Group array by key
 */
function groupBy(array, keyFn) {
    const groups = new Map();
    for (const item of array) {
        const key = keyFn(item);
        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key).push(item);
    }
    return groups;
}
exports.groupBy = groupBy;
/**
 * Flatten nested array
 */
function flatten(array) {
    return array.reduce((acc, val) => {
        return acc.concat(Array.isArray(val) ? flatten(val) : val);
    }, []);
}
exports.flatten = flatten;
/**
 * Unique array
 */
function unique(array, keyFn) {
    if (!keyFn) {
        return Array.from(new Set(array));
    }
    const seen = new Set();
    return array.filter((item) => {
        const key = keyFn(item);
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
exports.unique = unique;
