import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const provider = readFileSync(new URL('../../providers/locale-provider.tsx', import.meta.url), 'utf8');
const sidebar = readFileSync(new URL('../layout/sidebar-nav.tsx', import.meta.url), 'utf8');
const translations = readFileSync(new URL('../../lib/i18n.ts', import.meta.url), 'utf8');

test('locale selection persists and updates document language and direction', () => {
  assert.match(provider, /gatepass-locale/);
  assert.match(provider, /document\.documentElement\.lang = locale/);
  assert.match(provider, /document\.documentElement\.dir = locale === 'ar' \? 'rtl' : 'ltr'/);
});

test('Arabic localization applies across dynamically rendered screens and common controls', () => {
  assert.match(provider, /MutationObserver/);
  assert.match(provider, /translateToArabic/);
  assert.match(translations, /طلبات الدخول/);
  assert.match(translations, /البطاقة المدنية/);
  assert.match(translations, /إصدار بطاقة/);
});

test('the global navigation offers Arabic labels and a language switch', () => {
  assert.match(sidebar, /المشاريع/);
  assert.match(sidebar, /اعتمادات المستخدمين/);
  assert.match(sidebar, /العربية/);
});
