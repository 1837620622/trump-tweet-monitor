'use strict';

// 翻译多级回退：Groq AI → Google 公开端点 → MyMemory → 原文。
// Groq 在 console.groq.com 拿 key，免费档每天 14400 请求。

const { pickUA, logger } = require('./utils');

const SYSTEM_PROMPT = `你是一名专业的中英翻译。将用户给的英文社交媒体短文翻译为简洁地道的简体中文，注意：
- 输出仅包含翻译后的中文，不要加任何解释、引号、前缀或后缀。
- 保留 @用户名、#话题标签 和 URL 原样不译。
- 保留原文的语气（讽刺、愤怒、夸张等）。
- 若原文已是中文，直接原样返回。`;

async function translateGroq({ apiKey, model }, text) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text.slice(0, 4000) },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`groq ${res.status} ${body.slice(0, 200)}`);
  }
  const j = await res.json();
  const out = j.choices?.[0]?.message?.content?.trim();
  if (!out) throw new Error('groq empty');
  return out;
}

async function translateGoogle(text) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=${encodeURIComponent(text.slice(0, 500))}`;
  const res = await fetch(url, { headers: { 'User-Agent': pickUA() } });
  if (!res.ok) throw new Error(`google ${res.status}`);
  const j = await res.json();
  if (j && Array.isArray(j[0])) return j[0].map((p) => p[0]).filter(Boolean).join('');
  throw new Error('google empty');
}

async function translateMyMemory(text) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 500))}&langpair=en|zh-CN`;
  const res = await fetch(url, { headers: { 'User-Agent': pickUA() } });
  if (!res.ok) throw new Error(`mymemory ${res.status}`);
  const j = await res.json();
  if (j.responseStatus === 200 && j.responseData?.translatedText) return j.responseData.translatedText;
  throw new Error('mymemory empty');
}

function createTranslator(cfg) {
  // cfg: { enabled, groqKey, groqModel }
  return async function translate(text) {
    if (!cfg.enabled || !text) return '';
    if (cfg.groqKey) {
      try { return await translateGroq({ apiKey: cfg.groqKey, model: cfg.groqModel }, text); }
      catch (e) { logger.warn('translate[groq] failed:', e.message); }
    }
    try { return await translateGoogle(text); }
    catch (e) { logger.warn('translate[google] failed:', e.message); }
    try { return await translateMyMemory(text); }
    catch (e) { logger.warn('translate[mymemory] failed:', e.message); }
    return text; // 全部失败，回退原文
  };
}

module.exports = { createTranslator };
