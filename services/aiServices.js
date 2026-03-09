const path = require('path');
const dotenv = require('dotenv');
const axios = require('axios');

const envPath = path.resolve(__dirname, '..', 'outbinary', '.ENV');
dotenv.config({ path: envPath });

const getGeminiApiKey = () => {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  return key ? String(key).trim() : '';
};

const isDebug = () => String(process.env.AI_SQL_DEBUG || '').trim() === '1';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const callGemini = async ({ prompt, model, temperature }) => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY in outbinary/.ENV');
  }

  const useModel = String(model || '').trim() || 'gemini-2.5-flash';
  const temp = temperature === undefined ? 0.2 : Number(temperature);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(useModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  console.log('[AI][gemini] url', url.replace(/key=[^&]+/i, 'key=REDACTED'));
  if (isDebug()) {
    const p = String(prompt || '');
    console.log('[AI][gemini] prompt_preview', p.length > 1500 ? `${p.slice(0, 1500)}...` : p);
  }

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: String(prompt) }],
      },
    ],
    generationConfig: {
      temperature: Number.isFinite(temp) ? temp : 0.2,
    },
  };

  let lastErr = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await axios.post(url, payload, {
        timeout: 450000,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const candidates = response?.data?.candidates;
      const firstText =
        candidates?.[0]?.content?.parts?.map((p) => p?.text || '').join('') || response?.data?.text || '';

      return { model: useModel, text: String(firstText || '').trim(), raw: response?.data };
    } catch (err) {
      const status = err?.response?.status;
      lastErr = err;

      const retryable = status === 429 || status === 503;
      if (!retryable || attempt === 3) break;

      const waitMs = 800 * Math.pow(2, attempt) + Math.floor(Math.random() * 250);
      console.log('[AI][gemini] retry', { status, attempt: attempt + 1, waitMs });
      await sleep(waitMs);
    }
  }

  throw lastErr;

  
};

exports.gemini_generateText = async (prompt, options = {}) => {
  const { model, temperature } = options || {};
  const res = await callGemini({ prompt, model, temperature });
  return res.text;
};

exports.gemini_prompt = async (req, res, DATA) => {
  try {
    const prompt = DATA?.prompt ?? DATA?.PROMPT ?? '';
    if (!prompt || String(prompt).trim().length === 0) {
      return res.send({ tk_status: 'NG', message: 'Missing prompt' });
    }

    const model = String(DATA?.model || '').trim() || 'gemini-2.5-flash';
    const temperature = DATA?.temperature === undefined ? 0.2 : Number(DATA.temperature);

    const out = await callGemini({ prompt, model, temperature });

    res.send({
      tk_status: 'OK',
      data: {
        model: out.model,
        text: out.text,
        raw: out.raw,
      },
    });
  } catch (err) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    const message = err?.message || 'Gemini request failed';
    console.log('[AI][gemini_prompt] error', { status, message, data });
    res.send({ tk_status: 'NG', message, status, data });
  }
};
