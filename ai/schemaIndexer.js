const { extractSchema } = require('./schemaExtractor');
const { SchemaIndex } = require('./schemaIndex');

const isDebug = () => String(process.env.AI_SQL_DEBUG || '').trim() === '1';

const buildSchemaText = (doc) => {
  const title = `Table: ${doc.schema}.${doc.table}`;
  const cols = (doc.columns || [])
    .map(
      (c) =>
        `${c.name} - ${c.type}${c.nullable ? '' : ' NOT NULL'}${c.identity ? ' IDENTITY' : ''}${c.description ? ` - ${c.description}` : ''}`,
    )
    .join('\n');
  const rels = (doc.relationships || [])
    .map((r) => `${r.column} -> ${r.references}`)
    .join('\n');

  return [
    title,
    doc.description ? `Description: ${doc.description}` : '',
    '',
    'Columns:',
    cols || '(none)',
    '',
    'Relationships:',
    rels || '(none)',
  ]
    .filter((x) => x !== '')
    .join('\n');
};

exports.rebuildSchemaIndex = async () => {
  const schemaDocs = await extractSchema();
  const idx = new SchemaIndex();

  if (isDebug()) console.log('[SchemaIndexer] start', { tables: schemaDocs.length });

  const docs = schemaDocs.map((d) => {
    const schemaDocument = {
      table: d.table,
      schema: d.schema,
      description: d.description || '',
      columns: d.columns || [],
      relationships: d.relationships || [],
    };

    const text = buildSchemaText(d);
    return {
      id: `${d.schema}.${d.table}`,
      text,
      payload: {
        table_name: `${d.schema}.${d.table}`,
        schema_document: schemaDocument,
      },
    };
  });

  if (isDebug()) {
    const sample = docs.slice(0, 2).map((d) => ({ id: d.id, preview: d.text.slice(0, 600) }));
    console.log('[SchemaIndexer] sample', sample);
  }

  idx.rebuild(docs);

  if (isDebug()) console.log('[SchemaIndexer] done', { docs: docs.length, indexCount: idx.count() });

  return { count: docs.length };
};
