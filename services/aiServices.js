const path = require('path');
const dotenv = require('dotenv');
const axios = require('axios');

const envPath = path.resolve(__dirname, '..', 'outbinary', '.ENV');
dotenv.config({ path: envPath });

const getGeminiApiKey = () => {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  return key ? String(key).trim() : '';
};

exports.gemini_prompt = async (req, res, DATA) => {
  try {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return res.send({ tk_status: 'NG', message: 'Missing GEMINI_API_KEY in outbinary/.ENV' });
    }

    const prompt = DATA?.prompt ?? DATA?.PROMPT ?? '';
    if (!prompt || String(prompt).trim().length === 0) {
      return res.send({ tk_status: 'NG', message: 'Missing prompt' });
    }

    const model = String(DATA?.model || '').trim() || 'gemini-2.5-flash';
    const temperature = DATA?.temperature === undefined ? 0.2 : Number(DATA.temperature);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    console.log('[AI][gemini_prompt] url', url);
    //console.log('[AI][gemini_prompt] prompt', String(prompt));

    const payload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: String(prompt) }],
        },
      ],
      generationConfig: {
        temperature: Number.isFinite(temperature) ? temperature : 0.2,
      },
    };

    const response = await axios.post(url, payload, {
      timeout: 450000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const candidates = response?.data?.candidates;
    const firstText =
      candidates?.[0]?.content?.parts?.map((p) => p?.text || '').join('') ||
      response?.data?.text ||
      '';

    res.send({
      tk_status: 'OK',
      data: {
        model,
        text: String(firstText || '').trim(),
        raw: response?.data,
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
