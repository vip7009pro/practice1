"use strict";
/**
 * Semantic Query Engine - Core Type Definitions
 */
Object.defineProperty(exports, "__esModule", { value: true });
// ============ ERRORS ============
class SemanticEngineError extends Error {
    constructor(code, message, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'SemanticEngineError';
    }
}
exports.SemanticEngineError = SemanticEngineError;
class ValidationException extends SemanticEngineError {
    constructor(message, details) {
        super('VALIDATION_ERROR', message, details);
        this.name = 'ValidationException';
    }
}
exports.ValidationException = ValidationException;
class ExecutionError extends SemanticEngineError {
    constructor(message, details) {
        super('EXECUTION_ERROR', message, details);
        this.name = 'ExecutionError';
    }
}
exports.ExecutionError = ExecutionError;
class MetadataError extends SemanticEngineError {
    constructor(message, details) {
        super('METADATA_ERROR', message, details);
        this.name = 'MetadataError';
    }
}
exports.MetadataError = MetadataError;
