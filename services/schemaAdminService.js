const { rebuildSchemaIndex } = require('../ai/schemaIndexer');

exports.rebuild_schema_index = async (req, res, DATA) => {
  const started = Date.now();
  try {
    const result = await rebuildSchemaIndex();
    const ms = Date.now() - started;
    return res.send({
      tk_status: 'OK',
      data: {
        ms,
        tables: result?.count ?? 0,
      },
    });
  } catch (e) {
    const ms = Date.now() - started;
    return res.send({
      tk_status: 'NG',
      message: e?.message || String(e),
      data: { ms },
    });
  }
};
