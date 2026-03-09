const { rebuildSchemaIndex } = require('../ai/schemaIndexer');

const isDebug = () => String(process.env.AI_SQL_DEBUG || '').trim() === '1';

let timer = null;

exports.startSchemaScheduler = async (options = {}) => {
  const intervalHours = Number(options.schemaLearningIntervalHours || process.env.SCHEMA_LEARNING_INTERVAL_HOURS || 24);
  const intervalMs = Math.max(1, intervalHours) * 60 * 60 * 1000;

  const run = async () => {
    const started = Date.now();
    try {
      if (isDebug()) console.log('[SchemaScheduler] run:start');
      const result = await rebuildSchemaIndex();
      const ms = Date.now() - started;
      console.log('[SchemaScheduler] refreshed', { tables: result.count, ms });
    } catch (e) {
      const ms = Date.now() - started;
      console.log('[SchemaScheduler] error', {
        ms,
        message: e?.message || e,
        status: e?.response?.status,
        data: e?.response?.data,
      });
    }
  };

  await run();

  if (timer) clearInterval(timer);
  timer = setInterval(run, intervalMs);

  console.log('[SchemaScheduler] started', { intervalHours });

  return {
    stop: () => {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
};
