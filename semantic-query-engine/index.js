const fs = require('fs');
const path = require('path');

function loadCompiledModule(relativePath) {
  switch (relativePath) {
    case './handlers/semanticQueryHandler':
      return require('./handlers/semanticQueryHandler');
    case './services/metadataService':
      return require('./services/metadataService');
    case './services/dbSyncService':
      return require('./services/dbSyncService');
    case './services/trainingService':
      return require('./services/trainingService');
    case './core/queryRewriter':
      return require('./core/queryRewriter');
    case './core/semanticRetriever':
      return require('./core/semanticRetriever');
    case './core/relationshipGraph':
      return require('./core/relationshipGraph');
    case './core/relationshipExpander':
      return require('./core/relationshipExpander');
    case './core/joinPathResolver':
      return require('./core/joinPathResolver');
    case './core/sqlValidator':
      return require('./core/sqlValidator');
    case './core/sqlGenerator':
      return require('./core/sqlGenerator');
    case './core/executor':
      return require('./core/executor');
    case './core/formatter':
      return require('./core/formatter');
    case './utils/logger':
      return require('./utils/logger');
    case './config/constants':
      return require('./config/constants');
    default:
      throw new Error(`Unknown semantic-query-engine module: ${relativePath}`);
  }
}

function loadModule(relativePath) {
  const moduleBasePath = path.join(__dirname, relativePath);
  if (fs.existsSync(`${moduleBasePath}.js`)) {
    return loadCompiledModule(relativePath);
  }

  require('ts-node/register/transpile-only');
  return eval('require')(`${moduleBasePath}.ts`);
}

const semanticQueryHandler = loadModule('./handlers/semanticQueryHandler');
const metadataService = loadModule('./services/metadataService');
const dbSyncService = loadModule('./services/dbSyncService');
const trainingService = loadModule('./services/trainingService');

module.exports = {
  createSemanticQueryHandler: semanticQueryHandler.createSemanticQueryHandler,
  SemanticQueryHandler: semanticQueryHandler.SemanticQueryHandler,
  MetadataService: metadataService.MetadataService,
  getMetadataService: metadataService.getMetadataService,
  resetMetadataService: metadataService.resetMetadataService,
  DbSyncService: dbSyncService.DbSyncService,
  dbSyncService: dbSyncService.dbSyncService,
  TrainingService: trainingService.TrainingService,
  createTrainingService: trainingService.createTrainingService,

  QueryRewriter: loadModule('./core/queryRewriter').QueryRewriter,
  SemanticRetriever: loadModule('./core/semanticRetriever').SemanticRetriever,
  RelationshipGraph: loadModule('./core/relationshipGraph').RelationshipGraph,
  RelationshipExpander: loadModule('./core/relationshipExpander').RelationshipExpander,
  JoinPathResolver: loadModule('./core/joinPathResolver').JoinPathResolver,
  SQLValidator: loadModule('./core/sqlValidator').SQLValidator,
  SQLGenerator: loadModule('./core/sqlGenerator').SQLGenerator,
  Executor: loadModule('./core/executor').Executor,
  Formatter: loadModule('./core/formatter').Formatter,
  createLogger: loadModule('./utils/logger').createLogger,
  SEMANTIC_ENGINE_CONFIG: loadModule('./config/constants').SEMANTIC_ENGINE_CONFIG,
};
