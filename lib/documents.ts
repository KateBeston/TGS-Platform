/* ═══════════════════════════════════════════════════════════════════════
   DOCUMENT REGISTRY

   Every printable document declares itself here rather than hard-coding
   its own labels and defaults. Adding a document type is one entry.

   `defaultBranding` matters: a venue brief goes out in TGS's own name, a
   guest itinerary belongs to the host. Getting that wrong by default is
   how a host ends up sending their guests someone else's letterhead.
   ═══════════════════════════════════════════════════════════════════════ */

export type BrandingRegister = 'TGS' | 'Endorsed' | 'White label';

export type DocumentKind = {
  key: string;
  label: string;          // appears in the masthead, top right
  audiences: { key: string; label: string; note: string }[];
  defaultBranding: BrandingRegister;
  allowBrandingChoice: boolean;
};

export const DOCUMENT_KINDS: Record<string, DocumentKind> = {
  itinerary: {
    key: 'itinerary',
    label: 'Itinerary',
    defaultBranding: 'Endorsed',
    allowBrandingChoice: true,
    audiences: [
      { key: 'guest', label: 'For guests',
        note: 'What happens and when. No booking status, internal notes or totals.' },
      { key: 'internal', label: 'Internal',
        note: 'Everything, including what is unconfirmed and who is being paid.' },
    ],
  },
  enquiry_brief: {
    key: 'enquiry_brief',
    label: 'Retreat enquiry',
    // Sent by TGS, in TGS's name. A host brief here would be misleading.
    defaultBranding: 'TGS',
    allowBrandingChoice: false,
    audiences: [
      { key: 'venue', label: 'For a venue',
        note: 'The requirement and the dates. Omits the guest\u2019s contact details and the other venues being considered.' },
      { key: 'host', label: 'For the host',
        note: 'Confirms what was captured, with the venues currently available.' },
    ],
  },
  venue_profile: {
    key: 'venue_profile',
    label: 'Venue profile',
    defaultBranding: 'TGS',
    allowBrandingChoice: true,
    audiences: [
      { key: 'host', label: 'For a retreat host',
        note: 'What a host needs to decide: spaces, capacity, what they may bring.' },
      { key: 'internal', label: 'Internal',
        note: 'Adds commercial terms, commission and data completeness.' },
    ],
  },
  legal: {
    key: 'legal',
    label: 'Legal',
    // Always in TGS's name. A legal document from a host would be a
    // different document with different obligations.
    defaultBranding: 'TGS',
    allowBrandingChoice: false,
    audiences: [
      { key: 'public', label: 'As published',
        note: 'The wording as it stands, for printing or sending.' },
      { key: 'internal', label: 'With history',
        note: 'Adds the version, effective dates and what changed — for the file, not for a counterparty.' },
    ],
  },
  report: {
    key: 'report',
    label: 'Report',
    defaultBranding: 'TGS',
    allowBrandingChoice: false,
    audiences: [{ key: 'internal', label: 'Internal', note: '' }],
  },
};

export const REGISTERS: BrandingRegister[] = ['TGS', 'Endorsed', 'White label'];

export function resolveBranding(
  requested: string | undefined,
  itineraryOrRecord: { branding?: string | null } | null,
  hostDefault: string | null | undefined,
  kind: DocumentKind
): BrandingRegister {
  if (requested && REGISTERS.includes(requested as BrandingRegister)) {
    return requested as BrandingRegister;
  }
  if (!kind.allowBrandingChoice) return kind.defaultBranding;
  const onRecord = itineraryOrRecord?.branding;
  if (onRecord && REGISTERS.includes(onRecord as BrandingRegister)) {
    return onRecord as BrandingRegister;
  }
  if (hostDefault && REGISTERS.includes(hostDefault as BrandingRegister)) {
    return hostDefault as BrandingRegister;
  }
  return kind.defaultBranding;
}

/** Aurella's own details, for anything going out in TGS's name. */
export const TGS_FOOTER =
  'The Global Sanctum · Aurella Group Pty Ltd · ABN 70 649 742 423';
