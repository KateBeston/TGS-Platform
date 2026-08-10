/* ═══════════════════════════════════════════════════════════════════════
   THE GLOBAL SANCTUM — ATTRIBUTION CAPTURE
   Version 1.0 · 1 August 2026

   Goes on the PLATFORM SITE (theglobalsanctum.com), not the portal.
   Add via Google Tag Manager as a Custom HTML tag firing on All Pages,
   or paste directly before </body> on every page.

   ─── What it does ────────────────────────────────────────────────────
   Records where a visitor came from, and keeps it until they fill in a
   form — which is usually on a different page, minutes or days later.
   Without this, a form submission only ever knows the page the form sits
   on, which is always your own site.

   FIRST TOUCH is written once and never overwritten: the ad or link that
   introduced someone. LAST TOUCH updates on every new referred visit:
   what brought them back to convert. They are frequently different, and
   keeping only one gives a misleading read of what is working.

   ─── Honest limitations ──────────────────────────────────────────────
   · Safari and iOS cap script-set storage at seven days, so a long
     consideration window loses first touch.
   · Ad blockers strip some parameters.
   · A link shared in WhatsApp or a DM arrives with no referrer at all and
     is indistinguishable from someone typing the address.
   Expect 20–40% of traffic to be unattributable. That is normal, and it
   is why the "how did you hear about us" field on the form matters more
   than any of this.
   ═══════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var STORE_FIRST = 'tgs_attr_first';
  var STORE_LAST = 'tgs_attr_last';
  var UTMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

  // Platform click IDs. These are what let a lead be matched back to a
  // specific ad click inside the ad platform itself.
  var CLICK_IDS = {
    gclid: 'Google Ads',
    gbraid: 'Google Ads',
    wbraid: 'Google Ads',
    fbclid: 'Meta',
    ttclid: 'TikTok',
    li_fat_id: 'LinkedIn',
    msclkid: 'Microsoft Ads',
    epik: 'Pinterest'
  };

  function read(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // Private browsing, or storage disabled. Attribution is best-effort
      // and must never break the page it is measuring.
    }
  }

  function params() {
    try {
      return new URLSearchParams(window.location.search);
    } catch (e) {
      return { get: function () { return null; } };
    }
  }

  /** A referrer from our own domain is not a referrer — it is the previous
   *  page of the same visit. */
  function externalReferrer() {
    var r = document.referrer;
    if (!r) return null;
    try {
      if (new URL(r).hostname === window.location.hostname) return null;
    } catch (e) {
      return null;
    }
    return r;
  }

  function capture() {
    var q = params();
    var touch = { touch_at: new Date().toISOString(), landing_page: window.location.href };
    var found = false;

    UTMS.forEach(function (k) {
      var v = q.get(k);
      if (v) { touch[k] = v; found = true; }
    });

    var ref = externalReferrer();
    if (ref) { touch.referrer = ref; found = true; }

    var clickId = null, clickType = null;
    Object.keys(CLICK_IDS).forEach(function (k) {
      var v = q.get(k);
      if (v && !clickId) { clickId = v; clickType = CLICK_IDS[k]; found = true; }
    });
    if (clickId) { touch.click_id = clickId; touch.click_id_type = clickType; }

    // Nothing identifying about this visit — a direct arrival, or an
    // internal navigation. Leave what we already have alone.
    if (!found) return;

    if (!read(STORE_FIRST)) write(STORE_FIRST, touch);
    write(STORE_LAST, touch);
  }

  capture();

  /* ─── Public API ───────────────────────────────────────────────────
     Call TGSAttribution.get() when submitting a form and include the
     result as the `attribution` property of the payload. */
  window.TGSAttribution = {
    get: function () {
      var first = read(STORE_FIRST) || {};
      var last = read(STORE_LAST) || {};
      return {
        first: first,
        last: last,
        click_id: last.click_id || first.click_id || null,
        click_id_type: last.click_id_type || first.click_id_type || null
      };
    },

    /** Adds the attribution as a hidden field to a form element, for
     *  setups that post the form natively rather than via fetch. */
    attachTo: function (formEl) {
      if (!formEl) return;
      var input = formEl.querySelector('input[name="attribution"]');
      if (!input) {
        input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'attribution';
        formEl.appendChild(input);
      }
      input.value = JSON.stringify(window.TGSAttribution.get());
    },

    /** Convenience: posts a form payload to the portal intake endpoint.
     *  The key is public by design — it identifies the site, it does not
     *  authorise database access. The endpoint accepts only known form
     *  names and writes only the fields it recognises. */
    submit: function (formName, fields) {
      return fetch('https://tgs-portal.vercel.app/api/intake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tgs-key': 'REPLACE_WITH_INTAKE_SECRET'
        },
        body: JSON.stringify(
          Object.assign({}, fields, {
            form: formName,
            attribution: window.TGSAttribution.get()
          })
        )
      }).then(function (r) { return r.json(); });
    }
  };
})();
