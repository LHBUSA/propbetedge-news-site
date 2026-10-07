// Header SIGN IN (owner 2026-10-07): one destination, the existing Members / All Access login, beside ALL ACCESS on
// desktop and in the mobile row + More panel. The header has no session state, so there is no Command Center swap.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const header = read('src/components/header.js');

test('SIGN IN points at exactly https://members.propbetedge.ai/', () => {
  assert.match(header, /export const MEMBERS_SIGN_IN_URL = 'https:\/\/members\.propbetedge\.ai\/';/);
  assert.equal((header.match(/href="\$\{MEMBERS_SIGN_IN_URL\}"/g) || []).length, 3, 'desktop, mobile row, mobile More');
});

test('desktop SIGN IN sits immediately after ALL ACCESS; ALL ACCESS is unchanged', () => {
  assert.match(header, /<a href="\/pro" class="nav-link pbe-all-access-link \$\{path === '\/pro' \? 'active' : ''\}" data-pbe-placement="masthead_all_access">All Access<\/a>\s*<a href="\$\{MEMBERS_SIGN_IN_URL\}" class="nav-link pbe-signin-link"/);
});

test('mobile row keeps SIGN IN right after ALL ACCESS, and More > Membership lists it', () => {
  const nav = header.slice(header.indexOf('<nav class="pbe-mobile-nav"'), header.indexOf('</nav>', header.indexOf('<nav class="pbe-mobile-nav"')));
  assert.match(nav, /data-pbe-placement="mobile_nav_all_access"[^>]*>All Access<\/a>\s*<a href="\$\{MEMBERS_SIGN_IN_URL\}" class="pbe-mobile-nav-link pbe-mobile-signin"/);
  assert.match(nav, /pbe-mobile-more-all-access[\s\S]*?<a href="\$\{MEMBERS_SIGN_IN_URL\}" class="pbe-mobile-more-signin"/);
});

test('SIGN IN is never gold-filled and is never hidden at a mobile breakpoint', () => {
  const pro = read('src/styles/pbe-pro.css');
  const rule = pro.match(/\.masthead-leagues \.pbe-signin-link \{([^}]*)\}/)[1];
  assert.match(rule, /background: transparent/);
  const mobile = read('src/styles/pbe-mobile-cleanup.css');
  assert.doesNotMatch(mobile, /\.pbe-mobile-signin[^{]*\{[^}]*display:\s*none/);
});
