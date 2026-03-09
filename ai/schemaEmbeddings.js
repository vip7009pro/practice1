exports.createEmbedder = ({ embedText }) => {
  return async (inputText) => {
    const arr = await embedText(String(inputText || ''));
    if (!Array.isArray(arr) || arr.length === 0 || arr.some((x) => !Number.isFinite(Number(x)))) {
      throw new Error('Invalid embedding returned from Gemini');
    }
    return arr.map((x) => Number(x));
  };
};
