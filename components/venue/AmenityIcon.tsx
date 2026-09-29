/* ═══════════════════════════════════════════════════════════════════════
   ONE LINE DRAWING PER CATEGORY

   Drawn rather than photographed. A stock photograph of a kitchen bench on
   a page selling a particular villa reads as a stock photograph, and
   implies a picture of their kitchen that we do not have.

   Thin strokes, no fills, current colour, so they sit with the type rather
   than shouting over it. Matched on the category name with a fallback, so
   a new category never renders a blank.
   ═══════════════════════════════════════════════════════════════════════ */

const PATHS: Record<string, React.ReactNode> = {
  // Water: a vessel and the surface of it.
  'water & healing': (
    <>
      <path d="M4 11h16v3a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6z" />
      <path d="M9 8c0-1.2.9-1.6.9-2.6S9 3.5 9 3.5" />
      <path d="M13.5 8c0-1.2.9-1.6.9-2.6s-.9-1.9-.9-1.9" />
    </>
  ),
  // Treatment: a table and a folded towel.
  'wellness & treatment': (
    <>
      <path d="M3 13h18" /><path d="M5 13v6" /><path d="M19 13v6" />
      <path d="M7 13v-2a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" />
      <path d="M9.5 16.5h5" />
    </>
  ),
  // Connectivity: the arcs of a signal.
  'comfort & connectivity': (
    <>
      <path d="M5 12.5a9 9 0 0 1 14 0" />
      <path d="M8 15.5a5 5 0 0 1 8 0" />
      <circle cx="12" cy="18.5" r="1" />
    </>
  ),
  // Kitchen: a pot with steam.
  'kitchen & dining': (
    <>
      <path d="M4 11h16l-1.2 8.2a1 1 0 0 1-1 .8H6.2a1 1 0 0 1-1-.8z" />
      <path d="M3 11h18" />
      <path d="M9 7c0-1 1-1.4 1-2.4S9 3 9 3" />
      <path d="M14 7c0-1 1-1.4 1-2.4S14 3 14 3" />
    </>
  ),
  // Grounds: a tree over a horizon.
  'grounds & nature': (
    <>
      <path d="M12 21v-7" />
      <path d="M12 14c-3 0-5-2-5-4.5S9 4 12 4s5 3 5 5.5-2 4.5-5 4.5z" />
      <path d="M4 21h16" />
    </>
  ),
  // Movement: a figure mid-stretch.
  'fitness & movement': (
    <>
      <circle cx="12" cy="5" r="2" />
      <path d="M12 8v6" /><path d="M8 10.5h8" /><path d="M12 14l-3 7" /><path d="M12 14l3 7" />
    </>
  ),
  // The room itself.
  'in every room': (
    <>
      <path d="M4 20V9.5L12 4l8 5.5V20z" />
      <path d="M9 20v-6h6v6" />
    </>
  ),
  // Accessibility: the figure, plainly.
  accessibility: (
    <>
      <circle cx="12" cy="4.5" r="1.8" />
      <path d="M12 7v5h4" /><path d="M12 12l-1 4" />
      <path d="M8 12a5 5 0 1 0 6.5 7" />
    </>
  ),
  // Safety: a shield.
  'safety & security': (
    <>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
      <path d="M9.5 12l1.8 1.8 3.4-3.6" />
    </>
  ),
  // Arriving.
  'parking & transport': (
    <>
      <path d="M4 16v-3.5L6 8h12l2 4.5V16" />
      <path d="M3 16h18" /><circle cx="7.5" cy="18" r="1.5" /><circle cx="16.5" cy="18" r="1.5" />
    </>
  ),
  // A leaf, for what the place gives back.
  sustainability: (
    <>
      <path d="M5 19c0-8 5-13 14-13 0 9-5 13-11 13H5z" />
      <path d="M9 15c2-3 4-5 7-6.5" />
    </>
  ),
  // What a practice space holds.
  'practice space equipment': (
    <>
      <path d="M3 10.5h18" /><path d="M5 10.5V18h14v-7.5" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    </>
  ),
};

const FALLBACK = (
  <>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8v8" /><path d="M8 12h8" />
  </>
);

export default function AmenityIcon({ category }: { category: string }) {
  const drawing = PATHS[category.trim().toLowerCase()] ?? FALLBACK;
  return (
    <svg className="amenity-icon" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      {drawing}
    </svg>
  );
}
