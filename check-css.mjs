/* Every class used in a component, against every rule in the stylesheet.
 *
 * Written because a stylesheet edit silently deleted a whole block and
 * nothing noticed until the page was live and looked wrong. The failure
 * is quiet — the build passes, the HTML is correct, and only the
 * appearance is broken, which is the one thing a build cannot check.
 *
 *   node check-css.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync('app/globals.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

// Parse the selectors rather than grepping. An attribute selector, a
// pseudo-class or a combinator all break a naive pattern — .vpanel[hidden]
// read as missing when it was there.
const declared = new Set();
for (const [, selector] of css.matchAll(/([^{}]+)\{/g)) {
  for (const [, cls] of selector.matchAll(/\.([A-Za-z][\w-]*)/g)) declared.add(cls);
}

const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : p.endsWith('.tsx') ? [p] : [];
});

const used = new Map();
for (const file of [...walk('components'), ...walk('app')]) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/className=(?:"([^"]+)"|\{`([^`]+)`\})/g)) {
    // ${...} is a computed segment; the literal parts either side still count.
    const raw = (m[1] ?? m[2] ?? '').replace(/\$\{[^}]*\}/g, ' ');
    for (const c of raw.split(/\s+/)) {
      if (/^[a-z][a-z0-9-]*$/.test(c) && !c.endsWith('-')) {
        if (!used.has(c)) used.set(c, new Set());
        used.get(c).add(file);
      }
    }
  }
}

const missing = [...used].filter(([c]) => !declared.has(c));

if (!missing.length) {
  console.log(`✓ ${used.size} classes, all with rules. ${declared.size} rules declared.`);
  process.exit(0);
}

console.log(`${missing.length} classes used with no rule:\n`);
for (const [cls, files] of missing.sort()) {
  console.log(`  ${cls.padEnd(24)} ${[...files].join(', ')}`);
}
process.exit(1);
