/**
 * Semantic Query Engine - CommonJS Entry Point
 * Loads TypeScript modules using ts-node
 */

// Register ts-node for transpiling TypeScript on the fly
require('ts-node/register/transpile-only');

// Export all TypeScript modules as CommonJS
const semanticQueryHandler = require('./handlers/semanticQueryHandler.ts');
const metadataService = require('./services/metadataService.ts');
const dbSyncService = require('./services/dbSyncService.ts');
const trainingService = require('./services/trainingService.ts');

module.exports = {
  // Query handler
  createSemanticQueryHandler: semanticQueryHandler.createSemanticQueryHandler,
  SemanticQueryHandler: semanticQueryHandler.SemanticQueryHandler,
  
  // Services
  MetadataService: metadataService.MetadataService,
  getMetadataService: metadataService.getMetadataService,
  resetMetadataService: metadataService.resetMetadataService,
  
  DbSyncService: dbSyncService.DbSyncService,
  dbSyncService: dbSyncService.dbSyncService,
  
  TrainingService: trainingService.TrainingService,
  createTrainingService: trainingService.createTrainingService,
  
  // Core modules
  QueryRewriter: require('./core/queryRewriter.ts').QueryRewriter,
  SemanticRetriever: require('./core/semanticRetriever.ts').SemanticRetriever,
  RelationshipGraph: require('./core/relationshipGraph.ts').RelationshipGraph,
  RelationshipExpander: require('./core/relationshipExpander.ts').RelationshipExpander,
  JoinPathResolver: require('./core/joinPathResolver.ts').JoinPathResolver,
  SQLValidator: require('./core/sqlValidator.ts').SQLValidator,
  SQLGenerator: require('./core/sqlGenerator.ts').SQLGenerator,
  Executor: require('./core/executor.ts').Executor,
  Formatter: require('./core/formatter.ts').Formatter,
  
  // Utils
  createLogger: require('./utils/logger.ts').createLogger,
  
  // Config
  SEMANTIC_ENGINE_CONFIG: require('./config/constants.ts').SEMANTIC_ENGINE_CONFIG,
};
