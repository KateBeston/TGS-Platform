# The Global Sanctum — platform site

Next.js 16, React 19, Supabase. Deploys to Vercel.

The public site. It **reads** from the same Supabase project the internal
portal writes to, through views that expose only what is published.

---

## Running it

```bash
npm install
cp .env.local.example .env.local   # then paste the anon key
npm run dev
```

The anon key is in Supabase under **Connect**, or **Settings → API Keys**.

## Deploying

Push to GitHub, import in Vercel, add both environment variables under
**Settings → Environment Variables** for Production, Preview and
Development.

---

## How it relates to the portal

**One database, two applications.** The portal signs staff in and writes.
This signs nobody in and only reads.

**It reads views, never tables.** `published_venues` and its companions
carry only public columns and only published rows. `venues` has
thirty-one internal columns — commission rates, lead source, internal
notes — and they are not in the view, so no query here can reach them.

**Street address is excluded and coordinates are rounded** to about a
hundred metres. Precise enough for a map; a retreat's exact door is not
public information.

**Publishing is a routing decision.** `is_published` on a city means the
city has a page of its own. Every name is readable regardless, because a
venue in a city with no hub page still needs to show the city.

## Design tokens

`app/globals.css` and nowhere else, carried across from the portal
unchanged. Two applications that look different are two brands, and a
token copied by hand drifts within a month.
