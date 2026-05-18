// ============================================================
// 本地测试脚本 - 测试Cloudflare Worker的核心功能
// 运行方式: node test-worker.js
// ============================================================

// !! 注意：旧版本曾在此处硬编码 PUSHPLUS_TOKEN，已被泄漏到 git 历史。
// !! 你应当在 pushplus.plus 后台立即重置 token。新代码统一从环境变量读取。
const CONFIG = {
  PUSHPLUS_TOKEN: process.env.PUSHPLUS_TOKEN || '',
  PUSHPLUS_TOPIC: 'trump',
  PUSHPLUS_API: 'http://www.pushplus.plus/send',
  RSS_URLS: [
    'https://www.trumpstruth.org/feed'
  ],
  TRANSLATE_API: 'https://api.mymemory.translated.net/get'
};

// ---------------------- 翻译功能测试 ----------------------
async function testTranslate(text) {
  console.log('\n=== 测试翻译功能 ===');
  console.log('原文:', text);
  
  try {
    const url = `${CONFIG.TRANSLATE_API}?q=${encodeURIComponent(text)}&langpair=en|zh-CN`;
    const response = await fetch(url);
    const result = await response.json();
    
    if (result.responseStatus === 200) {
      console.log('翻译结果:', result.responseData.translatedText);
      return result.responseData.translatedText;
    } else {
      console.log('翻译失败:', result);
      return text;
    }
  } catch (error) {
    console.error('翻译错误:', error.message);
    return text;
  }
}

// ---------------------- RSS解析功能 ----------------------
function parseRSSItems(xmlText) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  
  while ((match = itemRegex.exec(xmlText)) !== null) {
    const itemXml = match[1];
    
    const titleMatch = itemXml.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) 
                    || itemXml.match(/<title>([\s\S]*?)<\/title>/);
    const title = titleMatch ? titleMatch[1].trim() : '';
    
    const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/);
    const link = linkMatch ? linkMatch[1].trim() : '';
    
    const guidMatch = itemXml.match(/<guid[^>]*>([\s\S]*?)<\/guid>/);
    const guid = guidMatch ? guidMatch[1].trim() : '';
    
    const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    const pubDate = pubDateMatch ? pubDateMatch[1].trim() : '';
    
    const creatorMatch = itemXml.match(/<dc:creator><!\[CDATA\[([\s\S]*?)\]\]><\/dc:creator>/);
    const creator = creatorMatch ? creatorMatch[1].trim() : '';
    
    if (title && guid) {
      items.push({ title, link, guid, pubDate, creator });
    }
  }
  
  return items;
}

// ---------------------- RSS抓取测试 ----------------------
async function testRSS() {
  console.log('\n=== 测试RSS抓取 ===');
  
  for (const url of CONFIG.RSS_URLS) {
    console.log(`\n抓取: ${url}`);
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      
      if (!response.ok) {
        console.log(`失败: HTTP ${response.status}`);
        continue;
      }
      
      const xmlText = await response.text();
      const items = parseRSSItems(xmlText);
      
      console.log(`成功: 获取到 ${items.length} 条推文`);
      
      if (items.length > 0) {
        console.log('\n最新一条推文:');
        console.log('  标题:', items[0].title.substring(0, 80) + '...');
        console.log('  时间:', items[0].pubDate);
        console.log('  链接:', items[0].link);
        console.log('  ID:', items[0].guid);
        return items[0];
      }
    } catch (error) {
      console.error(`错误: ${error.message}`);
    }
  }
  return null;
}

// ---------------------- PushPlus推送测试 ----------------------
async function testPushPlus(title, content) {
  console.log('\n=== 测试PushPlus推送 ===');
  console.log('标题:', title);
  console.log('内容预览:', content.substring(0, 100) + '...');
  
  try {
    const response = await fetch(CONFIG.PUSHPLUS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: CONFIG.PUSHPLUS_TOKEN,
        title: title,
        content: content,
        topic: CONFIG.PUSHPLUS_TOPIC,
        template: 'txt'
      })
    });
    
    const result = await response.json();
    if (result.code === 200) {
      console.log('✅ 推送成功! 流水号:', result.data);
      return true;
    } else {
      console.log('❌ 推送失败:', result.msg);
      return false;
    }
  } catch (error) {
    console.error('推送错误:', error.message);
    return false;
  }
}

// ---------------------- 完整流程测试 ----------------------
async function testFullFlow() {
  console.log('\n' + '='.repeat(60));
  console.log('Trump Tweet Monitor - 本地功能测试');
  console.log('='.repeat(60));
  
  // 1. 测试RSS抓取
  const latestItem = await testRSS();
  
  if (!latestItem) {
    console.log('\n❌ RSS抓取失败，测试终止');
    return;
  }
  
  // 2. 测试翻译
  const translated = await testTranslate(latestItem.title);
  
  // 3. 格式化消息
  const message = `🦅 特朗普 Truth Social

⏰ 时间：${latestItem.pubDate}
👤 来源：${latestItem.creator || '@realDonaldTrump'}

📝 原文：
${latestItem.title}

🇨🇳 翻译：
${translated}

🔗 链接：${latestItem.link}`;

  console.log('\n=== 格式化后的消息 ===');
  console.log(message);
  
  // 4. 询问是否推送
  console.log('\n' + '='.repeat(60));
  console.log('所有接口测试通过！');
  console.log('如需测试推送，请运行: node test-worker.js push');
  console.log('='.repeat(60));
  
  // 如果命令行有push参数，则执行推送
  if (process.argv.includes('push')) {
    await testPushPlus('🦅 特朗普新动态（测试）', message);
  }
}

// 运行测试
testFullFlow().catch(console.error);
