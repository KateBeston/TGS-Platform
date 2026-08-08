/* Mockup fidelity — does the template still contain the mockup's design?
 *
 * check-css catches a class used with no rule. It cannot catch the other
 * failure that keeps happening: a tab gets re-authored in a thinner set of
 * components, the mockup's rich cards quietly become plain rows, the build
 * passes, and only the eye notices — usually Kate's, days later.
 *
 * This compares each mockup tab's DESIGN PRIMITIVES (the classes that carry
 * the card / feature-block treatment) against the classes the matching
 * template actually emits. If a primitive the mockup uses is missing from
 * the code, the tab has been simplified.
 *
 *   node check-fidelity.mjs
 *
 * Enforced tabs FAIL the run when a primitive is missing. Every other tab
 * is reported as an advisory, so the remaining rebuild debt stays visible.
 * As each tab is rebuilt to its mockup, move it into `enforced` below and
 * it becomes guarded from then on.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/* The classes that distinguish a rich card/feature layout from a stack of
 * text rows. These are the ones that vanish when a tab is simplified. */
const PRIMITIVES = new Set([
  'feature-block', 'feature-image', 'feature-content',
  'card', 'card-grid', 'card-image', 'card-content', 'card-title',
  'card-description', 'card-meta', 'icon-item', 'icon-grid',
]);

/* Which mockup maps to which template, and which of its tabs are considered
 * done and therefore guarded. Everything not listed in `enforced` is advisory. */
const MANIFEST = [
  {
    mockup: 'design/mockups/tgs_retreat_venue_detail_v2.html',
    components: ['components/venue/RetreatVenue.tsx', 'components/venue/Section.tsx'],
    enforced: ['spaces'],
  },
  {
    mockup: 'design/mockups/TGS_Wellness_Venue_Detail_v9_enquiry.html',
    components: ['components/venue/WellnessVenue.tsx', 'components/venue/Section.tsx'],
    enforced: [],
  },
];

const classesIn = (text) => {
  const set = new Set();
  for (const [, cls] of text.matchAll(/\.([A-Za-z][\w-]*)/g)) set.add(cls);
  return set;
};

/* Split a mockup into its tab-content blocks, keyed by id. */
function mockupTabs(html) {
  const tabs = {};
  const re = /class="tab-content[^"]*"\s+id="([^"]+)"/g;
  const marks = [];
  for (let m; (m = re.exec(html)); ) marks.push({ id: m[1], at: m.index });
  marks.forEach((mark, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].at : html.length;
    const body = html.slice(mark.at, end);
    const used = new Set();
    for (const [, group] of body.matchAll(/class="([^"]+)"/g)) {
      for (const c of group.split(/\s+/)) if (c) used.add(c);
    }
    tabs[mark.id] = used;
  });
  return tabs;
}

/* Every className token a set of component files can emit. */
function componentClasses(files) {
  const used = new Set();
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/className=(?:"([^"]+)"|\{`([^`]+)`\})/g)) {
      const raw = (m[1] ?? m[2] ?? '').replace(/\$\{[^}]*\}/g, ' ');
      for (const c of raw.split(/\s+/)) if (c && !c.includes('$')) used.add(c);
    }
  }
  return used;
}

let failed = false;
const advisories = [];

for (const entry of MANIFEST) {
  const html = readFileSync(entry.mockup, 'utf8');
  const tabs = mockupTabs(html);
  const emits = componentClasses(entry.components);
  const label = entry.mockup.split('/').pop();

  for (const [id, used] of Object.entries(tabs)) {
    const wanted = [...used].filter((c) => PRIMITIVES.has(c));
    const missing = wanted.filter((c) => !emits.has(c));
    if (!missing.length) continue;

    if (entry.enforced.includes(id)) {
      failed = true;
      console.log(`\u2717 ${label} \u203a ${id}: template is missing ${missing.join(', ')}`);
    } else {
      advisories.push(`  ${label} \u203a ${id}: ${missing.join(', ')}`);
    }
  }
}

if (advisories.length) {
  console.log('\nNot yet rebuilt (advisory — mockup uses richer cards than the template):');
  console.log(advisories.join('\n'));
}

if (failed) {
  console.log('\nAn enforced tab lost its mockup design. Rebuild it before shipping.');
  process.exit(1);
}
console.log('\n\u2713 Every enforced tab still carries its mockup design.');
process.exit(0);
