'use strict';

const { logger } = require('./utils');

// PushPlus 推送（保持与原 CF Worker 行为一致：html 模板 + topic）
async function pushPlus({ token, api, topic }, title, htmlContent) {
  if (!token) {
    logger.warn('pushplus: token missing, skipping');
    return false;
  }
  try {
    const res = await fetch(api, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, title, content: htmlContent, topic, template: 'html' }),
    });
    const j = await res.json();
    if (j.code === 200) {
      logger.ok(`pushplus: sent (${j.data})`);
      return true;
    }
    logger.warn('pushplus: failed', j.msg || j);
    return false;
  } catch (e) {
    logger.err('pushplus: error', e.message);
    return false;
  }
}

function buildHtml(item, translated) {
  let body = `<h3>🦅 特朗普最新动态</h3>
<p><b>⏰ 时间：</b>${item.pubDate}</p>
<p><b>👤 来源：</b>${item.author}</p>
<hr/>
<p><b>📝 原文：</b></p>
<p>${escapeHtml(item.title)}</p>
<hr/>
<p><b>🇨🇳 中文翻译：</b></p>
<p style="color:#1890ff;">${escapeHtml(translated || item.title)}</p>`;
  if (item.mediaUrl) {
    body += `<hr/><p><b>🖼️ 图片：</b></p>
<p><img src="${item.mediaUrl}" style="max-width:100%;border-radius:8px;" /></p>`;
  }
  body += `<hr/>
<p><a href="${item.link}" target="_blank">🔗 查看原文</a></p>
<br/>
<p style="color:#999;font-size:12px;">━━━━━━━━━━</p>
<p style="color:#ffa500;"><b>🚀 万能程序员 传康KK</b></p>
<p style="color:#1890ff;">📱 微信：1837620622</p>`;
  return body;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildTitle(translatedOrTitle) {
  let s = String(translatedOrTitle || '')
    .replace(/^RT by @\w+:\s*/i, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*pic\.?\s*$/i, '')
    .trim();
  if (s.length > 40) s = s.slice(0, 37) + '...';
  return `🦅 特朗普最新动态 - ${s}`;
}

module.exports = { pushPlus, buildHtml, buildTitle };
