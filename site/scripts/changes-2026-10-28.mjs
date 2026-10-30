#!/usr/bin/env node
/*
  Changes requested by CareVest on October 28, 2026 ("A couple more changes", Danson Nguyen).
  Applied to site/content/content.json and to the dashboard drafts.
*/
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const BELCO = 'CareVest has retained Belco Private Capital Ltd. ("Belco") as Exempt Market Dealer for investment into CareVest Core MIC. If you are interested in placing an investment or would like to learn more, please get in touch and we will connect you with a licensed Belco Dealing Representative.';
const PHONE = '1 (855) 278-3611';

export function mutate(c) {
  const p = c.pages; const log = [];
  const set = (obj, key, value, label) => { if (obj && JSON.stringify(obj[key]) !== JSON.stringify(value)) { obj[key] = value; log.push(label || key); } };

  /* Home: no button next to "Contact us" in the closing band. */
  set(p.index?.final_cta, 'secondary_cta', { label: '', href: '' }, 'home closing band: second button removed');

  /* Core Fund: small note under the opening buttons. */
  set(p['core-mic']?.hero, 'fine', BELCO, 'core fund opening: note under buttons');

  /* Team page closing band ("Talk to a member of our team"): phone button removed, heading and
     paragraph changed to the requested wording. */
  const tc = p.team?.cta;
  if (tc) {
    set(tc, 'headline', 'Ready to Learn More?', 'team page closing band heading');
    set(tc, 'body', BELCO, 'team page closing band paragraph');
    set(tc, 'secondary_cta', { label: '', href: '' }, 'team page closing band: phone button removed');
  }

  /* Contact: phone moves from the first card to the Investor Relations card. */
  const d = p.contact?.details;
  if (d) {
    set(d, 'ir_phone', '', 'contact first card: phone removed');
    set(d, 'borrowers_phone', PHONE, 'contact investor relations card: phone added');
  }
  return log;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'content', 'content.json');
  const content = JSON.parse(readFileSync(file, 'utf8'));
  const log = mutate(content);
  writeFileSync(file, JSON.stringify(content, null, 2) + '\n');
  console.log(`${log.length} changes applied to content.json:`); for (const l of log) console.log(`  - ${l}`);
}
