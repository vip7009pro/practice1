const { extractSchema } = require('./schemaExtractor');

const isDebug = () => String(process.env.AI_SQL_DEBUG || '').trim() === '1';

const buildSchemaText = (doc) => {
  const title = `Table: ${doc.schema}.${doc.table}`;
  const cols = (doc.columns || [])
    .map((c) => `${c.name} - ${c.type}${c.nullable ? '' : ' NOT NULL'}${c.identity ? ' IDENTITY' : ''}${c.description ? ` - ${c.description}` : ''}`)
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

exports.learnSchema = async ({ embedText, vectorStore }) => {
  const schemaDocs = await extractSchema();

  if (isDebug()) {
    console.log('[SchemaLearner] start', { tables: schemaDocs.length });
  }

  const items = [];
  for (const d of schemaDocs) {
    const schemaDocument = {
      table: d.table,
      schema: d.schema,
      description: d.description || '',
      columns: d.columns || [],
      relationships: d.relationships || [],
    };

    const text = buildSchemaText(d);
    if (isDebug() && items.length < 2) {
      console.log('[SchemaLearner] schema_text_sample', {
        table: `${d.schema}.${d.table}`,
        textPreview: text.slice(0, 800),
      });
    }

    const embedding = await embedText(text);

    if (isDebug() && items.length < 2) {
      console.log('[SchemaLearner] embedding', {
        table: `${d.schema}.${d.table}`,
        dims: Array.isArray(embedding) ? embedding.length : 0,
      });
    }

    items.push({
      id: `${d.schema}.${d.table}`,
      embedding,
      text,
      payload: {
        table_name: `${d.schema}.${d.table}`,
        schema_document: schemaDocument,
      },
    });
  }

  vectorStore.upsertMany(items);

  if (isDebug()) {
    console.log('[SchemaLearner] upserted', { count: items.length, storeCount: vectorStore.count() });
  }
  return { count: items.length };
};
