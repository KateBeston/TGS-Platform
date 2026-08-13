import Link from 'next/link';

/* The footer, on every page including article templates.
 *
 * The audit found it rendering on /contact and not on articles. Included
 * by the layout so there is no template that can forget it.
 *
 * Visual and copy are the v6 home mockup: the mandala emblem, the brand
 * line, the registered entity, phone and email, four link columns and
 * the social row. Carries the address, the ABN, and the Acknowledgement
 * of Country.
 *
 * Sanctum Journal links to the signup section (#journal), which the
 * layout renders on every page above this footer. Host A Retreat points
 * to the retreat-hosts section on /how-it-works. Every footer link now
 * resolves to a real destination. */

const DISCOVER = [
  { label: 'Retreat Venues', href: '/venues?marketplace=Retreat' },
  { label: 'Wellness Venues', href: '/venues?marketplace=Wellness' },
  { label: 'Wellness Experiences', href: '/wellness-experiences' },
  { label: 'How It Works', href: '/how-it-works' },
];

const PARTNER = [
  { label: 'List Your Venue', href: '/list-your-venue' },
  { label: 'Host A Retreat', href: '/how-it-works#retreat-hosts' },
  { label: 'Press & Media', href: '/contact#press-media' },
  { label: 'Contact Us', href: '/contact' },
];

const RESOURCES = [
  { label: 'The Wellness Edit', href: '/the-wellness-edit' },
  { label: 'Sanctum Journal', href: '#journal' },
  { label: 'About Us', href: '/about' },
];

const LEGAL = [
  { label: 'Terms & Conditions', href: '/legal#terms-and-conditions' },
  { label: 'Privacy Policy', href: '/legal#privacy-policy' },
  { label: 'Cookies Policy', href: '/legal#cookie-policy' },
  { label: 'All Legal & Policies →', href: '/legal' },
];

function Column({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div className="footer-col">
      <h4 className="footer-col-title">{title}</h4>
      <ul className="footer-links">
        {links.map((l) => (
          <li key={l.href}>
            {l.href.startsWith('#')
              ? <a href={l.href}>{l.label}</a>
              : <Link href={l.href}>{l.label}</Link>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SiteFooter() {
  return (
    <footer className="footer">
      <div className="footer-grid">
        <div className="footer-brand">
          <span className="footer-logo-emblem" role="img" aria-label="The Global Sanctum" />
          <span className="footer-brand-name">The Global Sanctum</span>
          <p className="footer-brand-text">
            Curated wellness venues and transformational retreat spaces for retreat
            hosts, wellness guests, and seekers worldwide.
          </p>
          <p className="footer-brand-contact">
            <a href="tel:+61735218067">+61 7 3521 8067</a><br />
            <a href="mailto:hello@theglobalsanctum.com">hello@theglobalsanctum.com</a>
          </p>
          <div className="footer-social">
            <a href="https://www.facebook.com/profile.php?id=61577706717526" target="_blank" rel="noopener" aria-label="Facebook"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg></a>
            <a href="https://www.instagram.com/theglobalsanctum/" target="_blank" rel="noopener" aria-label="Instagram"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg></a>
            <a href="https://www.linkedin.com/company/the-global-sanctum/" target="_blank" rel="noopener" aria-label="LinkedIn"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg></a>
            <a href="https://au.pinterest.com/07dse6hmjfvvrin3xbdulhd5g5nol7/" target="_blank" rel="noopener" aria-label="Pinterest"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z" /></svg></a>
          </div>
        </div>

        <Column title="Discover" links={DISCOVER} />
        <Column title="Partner With Us" links={PARTNER} />
        <Column title="Resources" links={RESOURCES} />
        <Column title="Legal" links={LEGAL} />
      </div>

      <div className="footer-bottom">
        <p className="footer-copyright">
          © 2026 Aurella Group Pty Ltd · ABN 70 649 742 423 · 58 Wellington Street,
          Virginia QLD 4014, Australia
        </p>
        <p className="footer-acknowledgment">
          We acknowledge the Traditional Custodians of Country, and pay respect to
          Elders past and present.
        </p>
        <p className="footer-legal-mini">
          <Link href="/legal#privacy-policy">Privacy</Link>
          <span className="footer-legal-sep" aria-hidden="true">·</span>
          <Link href="/legal#terms-and-conditions">Terms</Link>
          <span className="footer-legal-sep" aria-hidden="true">·</span>
          <a href="#cookie-settings">Cookie settings</a>
        </p>
      </div>
    </footer>
  );
}
