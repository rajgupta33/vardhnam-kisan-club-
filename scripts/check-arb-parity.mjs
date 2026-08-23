#!/usr/bin/env node
/**
 * Fails when a mobile app's translation catalogues disagree.
 *
 * A missing Hindi key is invisible in code review and in `flutter analyze`:
 * `gen-l10n` falls back to the English string, so the app compiles, the tests
 * pass, and a Hindi-speaking farmer is the first person to discover the gap.
 * This guard makes that a build failure instead.
 *
 * Values that are byte-identical across locales are reported too, because that
 * is the other way a key silently ships untranslated. Most are legitimate --
 * interpolation-only formats like "{village}, {pincode}", sample values, and
 * language names, which belong in their own language -- so they are listed
 * under an allowlist rather than failing the build outright. A new identical
 * value that is real prose has to be added here deliberately, which is the
 * moment someone notices it was never translated.
 */
import { readFileSync } from 'node:fs';

/** Keys whose value is expected to read the same in both locales. */
const identicalByDesign = {
  'farmer-mobile': new Set([
    'homeLocationWithPincode', // "{location}, {pincode}" -- punctuation only
    'englishLanguageLabel', // a language names itself in its own language
    'hindiLanguageLabel',
  ]),
  'partner-mobile': new Set([
    'phoneHint', // sample number
    'english', // a language names itself in its own language
    'farmerLocation', // "{village}, {district} · {pincode}"
    'benefitTokenHint', // sample token
    'historyItem', // "{status} · {date}"
  ]),
};

const locales = ['hi'];
let failed = false;

function fail(message) {
  console.error(`  FAIL ${message}`);
  failed = true;
}

for (const [app, allowed] of Object.entries(identicalByDesign)) {
  const dir = `apps/${app}/lib/l10n`;
  const read = (locale) => JSON.parse(readFileSync(`${dir}/app_${locale}.arb`, 'utf8'));
  // `@`-prefixed entries are ARB metadata, not translatable messages.
  const messageKeys = (arb) => Object.keys(arb).filter((key) => !key.startsWith('@'));

  const en = read('en');
  const enKeys = messageKeys(en);
  console.log(`${app}: ${enKeys.length} message keys in app_en.arb`);

  for (const locale of locales) {
    const translated = read(locale);
    const translatedKeys = new Set(messageKeys(translated));

    const missing = enKeys.filter((key) => !translatedKeys.has(key));
    const orphaned = [...translatedKeys].filter((key) => !enKeys.includes(key));
    const identical = enKeys.filter(
      (key) => translatedKeys.has(key) && translated[key] === en[key] && !allowed.has(key),
    );

    if (missing.length > 0) {
      fail(`${app} app_${locale}.arb is missing ${missing.length} key(s): ${missing.join(', ')}`);
    }
    if (orphaned.length > 0) {
      fail(
        `${app} app_${locale}.arb has ${orphaned.length} key(s) absent from English: ` +
          orphaned.join(', '),
      );
    }
    if (identical.length > 0) {
      fail(
        `${app} app_${locale}.arb repeats the English value for ${identical.length} key(s): ` +
          `${identical.join(', ')}. Translate them, or add them to identicalByDesign in ` +
          'scripts/check-arb-parity.mjs with a reason.',
      );
    }
    if (missing.length === 0 && orphaned.length === 0 && identical.length === 0) {
      console.log(`  ok   app_${locale}.arb matches English`);
    }
  }
}

process.exit(failed ? 1 : 0);
