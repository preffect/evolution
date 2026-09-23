import pw from '/usr/lib/node_modules/@playwright/mcp/node_modules/playwright-core/index.js';
const { chromium } = pw;
const URL = 'http://127.0.0.1:4542/';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader'] });
const context = await browser.newContext({ viewport: { width: 320, height: 200 } });
await context.addInitScript(() => {
  const Native = window.WebSocket;
  window.__ws = { opens: 0, closes: 0, types: {} };
  const Patched = function (url, protocols) {
    const s = protocols === undefined ? new Native(url) : new Native(url, protocols);
    if (String(url).includes('/ws?')) {
      s.addEventListener('open', () => {
        window.__ws.opens += 1;
      });
      s.addEventListener('close', (e) => {
        window.__ws.closes += 1;
        window.__ws.lastCode = e.code;
      });
      s.addEventListener('message', (e) => {
        try {
          const t = JSON.parse(e.data).type;
          window.__ws.types[t] = (window.__ws.types[t] ?? 0) + 1;
        } catch {}
      });
    }
    return s;
  };
  for (const k of ['OPEN', 'CONNECTING', 'CLOSING', 'CLOSED']) Patched[k] = Native[k];
  Patched.prototype = Native.prototype;
  window.WebSocket = Patched;
});
const click = (page, t) =>
  page.evaluate((text) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === text);
    if (b) b.click();
    return Boolean(b);
  }, t);
const tab1 = await context.newPage();
await tab1.goto(URL);
await tab1.waitForTimeout(1500);
await click(tab1, 'Connect & Join Lobby');
await tab1.waitForTimeout(800);
await click(tab1, 'Create');
await tab1.waitForTimeout(800);
await click(tab1, 'Start');
await tab1.waitForTimeout(3000);
const tab2 = await context.newPage();
await tab2.goto(URL);
await tab2.waitForTimeout(1500);
await click(tab2, 'Connect & Join Lobby');
await tab2.waitForTimeout(10000);
const report = async (page) =>
  page.evaluate(() => ({ ...window.__ws, text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 120) }));
console.log('tab1', JSON.stringify(await report(tab1)));
console.log('tab2', JSON.stringify(await report(tab2)));
await tab1.goto('about:blank');
await tab2.goto('about:blank');
await browser.close();
