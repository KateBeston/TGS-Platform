/** The kinds of internal document.
 *
 *  In lib rather than in the server action, because a 'use server' file
 *  may only export async functions — a plain constant there fails the
 *  build with an error that names neither the file nor the constant.
 */
export const DOC_CATEGORIES = [
  'How it works',        // the system as it stands
  'Decisions',           // why it is that way
  'Runbook',             // what to do when something breaks
  'Access & security',
  'Commercial',
  'Suppliers & tools',
  'Onboarding',          // for whoever comes next
  'Reference',
] as const;

export type DocCategory = typeof DOC_CATEGORIES[number];
