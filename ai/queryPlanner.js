exports.buildRetrievedSchemaText = (hits) => {
  const parts = [];
  for (const h of hits || []) {
    const d = h.doc;
    const name = d?.payload?.table_name || d?.id || '';
    parts.push(`--- ${name} (score=${Number(h.score || 0).toFixed(4)}) ---`);
    parts.push(String(d?.text || ''));
    parts.push('');
  }
  return parts.join('\n');
};
