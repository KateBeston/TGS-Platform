# Messages

`en.json` is the source of truth. Every other file mirrors its key structure
with empty values, waiting to be filled.

## Adding a translation

1. Open `messages/<code>.json` and fill in the strings. Leave anything you have
   not translated as `""` — empty values fall back to English key by key, so a
   half-finished file renders a readable page rather than blanks or raw keys.
2. Flip `enabled: true` for that locale in `lib/i18n/config.ts`.
3. That is all. The picker hides itself entirely until a second locale is
   enabled, so nothing appears in the bar until there is a genuine choice.

## Adding a new string

Add it to `en.json` first, then run the scaffold so the other files gain the
same key:

    node -e "const fs=require('fs');const en=require('./messages/en.json');const b=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,typeof v==='object'?b(v):'']));const m=(base,over)=>Object.fromEntries(Object.entries(base).map(([k,v])=>[k,typeof v==='object'?m(v,over?.[k]||{}):(over?.[k]??'')]));for(const f of fs.readdirSync('messages')){if(!f.endsWith('.json')||f==='en.json')continue;const p='messages/'+f;const cur=JSON.parse(fs.readFileSync(p));fs.writeFileSync(p,JSON.stringify(m(b(en),cur),null,2)+'\n')}"

## What does not belong here

Legal documents. They live in the legal register in the database, are published
in English, and the translation notice states the English version applies. A
machine-translated contract term is a different contract term.

Venue descriptions and editorial also do not belong here. They come from
Supabase and Sanity and need their own translation columns, which is a separate
piece of work.
