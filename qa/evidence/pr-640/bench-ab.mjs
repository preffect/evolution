// Ticket #192 frame cost: the bench route (docs/rendering/budget.md §7) on a given client, report from the console.
import pw from '/usr/lib/node_modules/@playwright/mcp/node_modules/playwright-core/index.js';
const url = process.argv[2];
const browser = await pw.chromium.launch({ headless: true, args: ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const lines = [];
page.on('console', (m) => lines.push(m.text()));
await page.goto(url);
for (let i = 0; i < 180 && !lines.some((l) => /verdict|frame p95|p95/i.test(l)); i += 1) await page.waitForTimeout(1000);
await page.waitForTimeout(1000);
console.log(lines.filter((l) => !/404|Failed to load/.test(l)).join('\n').slice(0, 2500));
await page.goto('about:blank');
await browser.close();
