#!/usr/bin/env node
// Global #67 browser QA for /ja/pro, /ko/pro, the regional disclosures and the English /pro.
//   node scripts/qa-global-intl.mjs https://propbetedge.ai [--share=<vercel share url>]
// Needs puppeteer-core and an installed Chrome (CHROME env var, or the default Windows path).
// Each page and width runs in a fresh, isolated browser context: no cookies or storage carry over.
// Checks:
//   - server bytes: status, <html lang>, canonical, hreflang, server-rendered h1, attribution;
//   - rendered at 320/390/768/1440: lang after hydration, no horizontal overflow, no page or
//     console errors, CTA hrefs, no forbidden links or US helplines, no English UI residue;
//   - the language switch between /ja/pro and /ko/pro.
import puppeteer from 'puppeteer-core';

const BASE = (process.argv[2] || 'https://propbetedge.ai').replace(/\/$/, '');
const SHARE = (process.argv.find((a) => a.startsWith('--share=')) || '').slice(8);
const WIDTHS = [320, 390, 768, 1440];
const PAY = 'https://buy.stripe.com/8x2eVdgmOaqy4pv8Ez7wA0N';
const PAGES = [
  { path: '/ja/pro?via=golf', lang: 'ja', canon: '/ja/pro', alts: 4, cta: `${PAY}?locale=ja&client_reference_id=pbe-ja-pro-golf`, h1: 'ひとつのメンバーシップで' },
  { path: '/ko/pro', lang: 'ko', canon: '/ko/pro', alts: 4, cta: `${PAY}?locale=ko&client_reference_id=pbe-ko-pro`, h1: '멤버십 하나로' },
  { path: '/ja/legal/tokushoho', lang: 'ja', canon: '/ja/legal/tokushoho', alts: 0, h1: '特定商取引法に基づく表記' },
  { path: '/ko/legal/business', lang: 'ko', canon: '/ko/legal/business', alts: 0, h1: '사업자 정보' },
  { path: '/pro', lang: 'en', canon: '/pro', alts: 4, cta: PAY, h1: 'One membership' },
];
const ALLOWED_LATIN = /^(PropBetEdge|All|Access|Command|Center|Compare|Markets|Predictions|PBEcast|DNA|Platinum|Direct|Live|Market|Wire|MLB|NFL|NBA|NHL|WNBA|UFC|Tennis|Soccer|Golf|F1|ATP|WTA|PBE|Picks|WinBA|Fighter|Match|BTC|AI|US|THEEDGE25|Stripe|Chrome|Safari|Edge|Firefox|Local|Home|Buyers|LLC|PropTechUSA|ai|d|b|a|support|proptechusa|Intelligence|EN)$/;

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); if (!ok) console.log(`FAIL ${name} ${detail}`); };

const cookieHeader = {};
if (SHARE) {
  // Vercel preview protection: the share link answers with a bypass cookie.
  const r = await fetch(SHARE, { redirect: 'manual' });
  const set = r.headers.get('set-cookie') || '';
  cookieHeader.cookie = set.split(/,(?=\s*[^;]+=)/).map((c) => c.split(';')[0].trim()).join('; ');
}

// 1. Server bytes (what a crawler sees before any JavaScript).
for (const p of PAGES) {
  const res = await fetch(BASE + p.path, { headers: { ...cookieHeader, 'user-agent': 'Mozilla/5.0 (PBE QA)' } });
  const html = await res.text();
  check(`${p.path} status 200`, res.status === 200, String(res.status));
  check(`${p.path} ssr html lang=${p.lang}`, new RegExp(`<html[^>]*\\blang="${p.lang}"`).test(html));
  check(`${p.path} ssr canonical`, html.includes(`<link rel="canonical" href="https://propbetedge.ai${p.canon}"`));
  const alts = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => `${m[1]}=${m[2]}`);
  check(`${p.path} ssr hreflang x${p.alts}`, alts.length === p.alts, alts.join(' '));
  if (p.alts) check(`${p.path} ssr hreflang reciprocal`, ['en=https://propbetedge.ai/pro', 'ja=https://propbetedge.ai/ja/pro', 'ko=https://propbetedge.ai/ko/pro', 'x-default=https://propbetedge.ai/pro'].every((a) => alts.includes(a)), alts.join(' '));
  check(`${p.path} ssr h1`, html.includes(p.h1));
  if (p.lang !== 'en') {
    check(`${p.path} ssr no forbidden`, !/kalshi|polymarket|sportsbook|1-800|gambler|\/go\//i.test(html.replace(/<head>[\s\S]*<\/head>/, '')));
    if (p.cta) check(`${p.path} ssr cta attribution`, html.includes(p.cta.replace(/&/g, '&amp;')));
  }
}

// 2. Rendered pages, every width, isolated contexts.
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-first-run', '--disable-extensions'] });
async function open(path, width) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  await page.setViewport({ width, height: 900 });
  if (cookieHeader.cookie) await page.setExtraHTTPHeaders({ cookie: cookieHeader.cookie });
  await page.goto(BASE + path, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 400));
  return { ctx, page, errors };
}
for (const p of PAGES) {
  for (const w of WIDTHS) {
    const { ctx, page, errors } = await open(p.path, w);
    const tag = `${p.path} @${w}`;
    const s = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      h1: document.querySelector('h1')?.textContent || '',
      ctas: [...document.querySelectorAll('[data-pbe-placement="all_access_checkout"]')].map((a) => a.href),
      hrefs: [...document.querySelectorAll('a[href]')].map((a) => a.href),
      text: document.querySelector('.pbe-intl')?.innerText || '',
      alternates: document.querySelectorAll('link[rel="alternate"][hreflang]').length,
      canonical: document.querySelector('link[rel="canonical"]')?.href,
      small: [...document.querySelectorAll('.pbe-intl a, .pbe-intl button')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 24 && getComputedStyle(el).display !== 'inline'; }).length,
    }));
    check(`${tag} lang`, s.lang === p.lang, s.lang);
    check(`${tag} no horizontal overflow`, s.overflow <= 0, `${s.overflow}px`);
    check(`${tag} no errors`, errors.length === 0, errors.join(' | ').slice(0, 300));
    check(`${tag} h1`, s.h1.includes(p.h1), s.h1);
    check(`${tag} canonical`, s.canonical === `https://propbetedge.ai${p.canon}`, s.canonical);
    check(`${tag} hreflang after hydration`, s.alternates === p.alts, String(s.alternates));
    if (p.cta) check(`${tag} checkout CTAs`, s.ctas.length >= 1 && s.ctas.every((h) => h === p.cta), s.ctas.join(' '));
    if (p.lang !== 'en') {
      check(`${tag} no forbidden links`, !s.hrefs.some((h) => /kalshi|polymarket|sportsbook|draftkings|fanduel|\/go\//i.test(h)));
      check(`${tag} no US helpline`, !/1-800|GAMBLER/i.test(s.text));
      const stray = [...new Set((s.text.match(/[A-Za-z][A-Za-z0-9']*/g) || []).filter((x) => !ALLOWED_LATIN.test(x)))];
      check(`${tag} no English UI residue`, stray.length === 0, stray.join(','));
    }
    await ctx.close();
  }
}

// 3. Language switch: /ko/pro -> 日本語 -> /ja/pro with lang=ja; then EN -> /pro with lang=en.
{
  const { ctx, page } = await open('/ko/pro', 390);
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2' }), page.click('.pbe-intl-langs a[hreflang="ja"]')]);
  check('switch ko -> ja', new URL(page.url()).pathname === '/ja/pro' && await page.evaluate(() => document.documentElement.lang) === 'ja', page.url());
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2' }), page.click('.pbe-intl-langs a[hreflang="en"]')]);
  await new Promise((r) => setTimeout(r, 600));
  const en = await page.evaluate(() => ({ lang: document.documentElement.lang, h1: document.querySelector('h1')?.textContent || '' }));
  check('switch ja -> en', new URL(page.url()).pathname === '/pro' && en.lang === 'en' && en.h1.includes('One membership'), JSON.stringify(en));
  await ctx.close();
}
await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed against ${BASE}`);
process.exit(failed.length ? 1 : 0);
