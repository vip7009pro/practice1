/**
 * Helper Utilities
 */

/**
 * Normalize text: trim, case, remove accents, remove extra whitespace
 */
export function normalizeText(text: string, lowercase = true): string {
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

/**
 * Tokenize text into words (length >= 2)
 */
export function tokenize(text: string): string[] {
  const normalized = normalizeText(text);
  const tokens = normalized
    .split(/[^a-z0-9_]+/gi)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  return Array.from(new Set(tokens)); // Remove duplicates
}

/**
 * Fuzzy string matching (basic Levenshtein-like similarity)
 */
export function stringSimilarity(a: string, b: string): number {
  const normA = normalizeText(a);
  const normB = normalizeText(b);

  if (normA === normB) return 1.0;
  if (normA.length === 0 || normB.length === 0) return 0;

  // Simple containment check
  if (normA.includes(normB) || normB.includes(normA)) return 0.85;

  // Token overlap
  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));

  const intersection = Array.from(tokensA).filter((t) => tokensB.has(t));
  const union = Array.from(new Set([...tokensA, ...tokensB]));

  if (union.length === 0) return 0;
  return intersection.length / union.length;
}

/**
 * Find best match in array of candidates
 */
export function findBestMatch(query: string, candidates: string[], threshold = 0.6): string | null {
  if (candidates.length === 0) return null;

  const scores = candidates.map((cand) => ({
    candidate: cand,
    score: stringSimilarity(query, cand),
  }));

  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];

  return best.score >= threshold ? best.candidate : null;
}

/**
 * Escape SQL string literal
 */
export function escapeSqlString(value: string): string {
  return String(value || '').replace(/'/g, "''");
}

/**
 * Check if string is SQL-like (begins with SELECT or WITH)
 */
export function isLikelySqlQuery(text: string): boolean {
  const normalized = normalizeText(text, true).trim();
  return normalized.startsWith('select') || normalized.startsWith('with');
}

/**
 * Remove SQL comments
 */
export function stripSqlComments(sql: string): string {
  let s = String(sql || '');
  // Remove single-line comments (--...)
  s = s.replace(/--.*$/gm, '');
  // Remove multi-line comments (/* ... */)
  s = s.replace(/\/\*[\s\S]*?\*\//g, '');
  return s.trim();
}

/**
 * Format number with thousand separators
 */
export function formatNumber(num: number | string, locale = 'vi-VN'): string {
  const n = typeof num === 'string' ? parseFloat(num) : num;
  if (!Number.isFinite(n)) return String(num);
  return new Intl.NumberFormat(locale).format(n);
}

/**
 * Format currency
 */
export function formatCurrency(amount: number | string, currency = 'VND', locale = 'vi-VN'): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (!Number.isFinite(n)) return String(amount);
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(n);
}

/**
 * Deep clone with date handling
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as any;
  if (obj instanceof Array) {
    return obj.map((item) => deepClone(item)) as any;
  }
  if (obj instanceof Object) {
    const cloned = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
  return obj;
}

/**
 * Sleep for N milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry async function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelayMs = 100,
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const delayMs = initialDelayMs * Math.pow(2, attempt);
        await sleep(delayMs);
      }
    }
  }

  throw lastError;
}

/**
 * Measure execution time
 */
export async function measureTime<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const start = Date.now();
  const result = await fn();
  const duration = Date.now() - start;
  return [result, duration];
}

/**
 * Group array by key
 */
export function groupBy<T>(array: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of array) {
    const key = keyFn(item);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(item);
  }
  return groups;
}

/**
 * Flatten nested array
 */
export function flatten<T>(array: any[]): T[] {
  return array.reduce((acc, val) => {
    return acc.concat(Array.isArray(val) ? flatten(val) : val);
  }, []);
}

/**
 * Unique array
 */
export function unique<T>(array: T[], keyFn?: (item: T) => string): T[] {
  if (!keyFn) {
    return Array.from(new Set(array));
  }
  const seen = new Set<string>();
  return array.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
