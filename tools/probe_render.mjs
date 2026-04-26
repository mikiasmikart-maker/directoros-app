import fs from 'node:fs/promises';
import path from 'node:path';

const pageWsUrl = process.argv[2];
if (!pageWsUrl) {
  console.error('Usage: node tools/probe_render.mjs <pageWebSocketDebuggerUrl>');
  process.exit(1);
}

const protocolHttp = pageWsUrl.replace(/^ws:\/\//, 'http://').replace(/\/devtools\/page\/.+$/, '');

async function call(method, params = {}) {
  const res = await fetch(`${protocolHttp}/json/protocol`);
  if (!res.ok) {
    throw new Error(`Protocol fetch failed: ${res.status}`);
  }
}

const ws = new WebSocket(pageWsUrl);
let id = 0;
const pending = new Map();
const events = {
  console: [],
  exceptions: [],
  requests: [],
  responses: [],
  failures: [],
  lifecycle: [],
};

function send(method, params = {}) {
  const msgId = ++id;
  ws.send(JSON.stringify({ id: msgId, method, params }));
  return new Promise((resolve, reject) => {
    pending.set(msgId, { resolve, reject, method });
    setTimeout(() => {
      if (pending.has(msgId)) {
        pending.delete(msgId);
        reject(new Error(`Timeout waiting for ${method}`));
      }
    }, 10000);
  });
}

ws.onmessage = async (event) => {
  const msg = JSON.parse(event.data.toString());
  if (msg.id) {
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
    else p.resolve(msg.result);
    return;
  }
  if (msg.method === 'Runtime.consoleAPICalled') {
    events.console.push(msg.params);
  } else if (msg.method === 'Runtime.exceptionThrown') {
    events.exceptions.push(msg.params);
  } else if (msg.method === 'Network.requestWillBeSent') {
    events.requests.push(msg.params);
  } else if (msg.method === 'Network.responseReceived') {
    events.responses.push(msg.params);
  } else if (msg.method === 'Network.loadingFailed') {
    events.failures.push(msg.params);
  } else if (msg.method === 'Page.lifecycleEvent') {
    events.lifecycle.push(msg.params);
  }
};

ws.onerror = (err) => {
  console.error('WebSocket error', err.message || err);
};

ws.onopen = async () => {
  try {
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Network.enable');
    await send('Log.enable');
    await send('Page.reload', { ignoreCache: false });
    await new Promise((r) => setTimeout(r, 2500));

    const evalResult = await send('Runtime.evaluate', {
      expression: `(() => {
        const root = document.getElementById('root');
        const rootHtml = root ? root.innerHTML.slice(0, 500) : null;
        const rootText = root ? root.textContent : null;
        const rootChildren = root ? root.children.length : null;
        const bodyBg = getComputedStyle(document.body).backgroundColor;
        const rootBg = root ? getComputedStyle(root).backgroundColor : null;
        const ls = {};
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          ls[k] = localStorage.getItem(k);
        }
        return {
          title: document.title,
          readyState: document.readyState,
          bodyText: document.body.innerText.slice(0, 1000),
          bodyHtml: document.body.innerHTML.slice(0, 1000),
          rootExists: !!root,
          rootHtml,
          rootText,
          rootChildren,
          bodyBg,
          rootBg,
          location: location.href,
          localStorage: ls,
          sessionStorageKeys: Object.keys(sessionStorage),
        };
      })()`,
      returnByValue: true,
      awaitPromise: true,
    });

    await send('Page.reload', { ignoreCache: true });
    await new Promise((r) => setTimeout(r, 2500));
    const hardRefreshResult = await send('Runtime.evaluate', {
      expression: `(() => {
        const root = document.getElementById('root');
        return {
          readyState: document.readyState,
          bodyText: document.body.innerText.slice(0, 1000),
          bodyHtml: document.body.innerHTML.slice(0, 1000),
          rootExists: !!root,
          rootHtml: root ? root.innerHTML.slice(0, 500) : null,
          rootChildren: root ? root.children.length : null,
          localStorageKeys: Object.keys(localStorage),
        };
      })()`,
      returnByValue: true,
      awaitPromise: true,
    });

    const out = {
      eval: evalResult.result.value,
      hardRefresh: hardRefreshResult.result.value,
      console: events.console,
      exceptions: events.exceptions,
      failures: events.failures,
      responses: events.responses.filter(r => r.response.status >= 400).map(r => ({ url: r.response.url, status: r.response.status, statusText: r.response.statusText, mimeType: r.response.mimeType })),
      requests: events.requests.map(r => ({ url: r.request.url, method: r.request.method, type: r.type })),
      lifecycle: events.lifecycle,
    };

    const outPath = path.join(process.cwd(), 'memory', 'render_probe.json');
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, JSON.stringify(out, null, 2));
    console.log(outPath);
    ws.close();
  } catch (error) {
    console.error(error.stack || String(error));
    process.exitCode = 1;
    ws.close();
  }
};
