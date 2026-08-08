import Link from 'next/link';

/* The footer, on every page including article templates.
 *
 * The audit found it rendering on /contact and not on articles. Included
 * by the layout so there is no template that can forget it.
 *
 * Carries the address, the ABN, and the Acknowledgement of Country. */

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="footer-grid">
          <div>
            <div className="footer-mark">The Global Sanctum</div>
            <p className="footer-line">
              Retreat spaces · Wellness experiences · Globally curated
            </p>
          </div>

          <div>
            <div className="footer-title">Discover</div>
            <Link href="/venues">All venues</Link>
            <Link href="/venues?marketplace=Retreat">Retreat venues</Link>
            <Link href="/venues?marketplace=Wellness">Wellness venues</Link>
            <Link href="/wellness-experiences">Wellness experiences</Link>
          </div>

          <div>
            <div className="footer-title">Learn</div>
            <Link href="/about">About us</Link>
            <Link href="/how-it-works">How it works</Link>
            <Link href="/the-wellness-edit">The Wellness Edit</Link>
          </div>

          <div>
            <div className="footer-title">Connect</div>
            <Link href="/contact">Contact us</Link>
            <Link href="/list-your-venue">List your venue</Link>
            <a href="mailto:hello@theglobalsanctum.com">hello@theglobalsanctum.com</a>
          </div>
        </div>

        <div className="acknowledgement">
          The Global Sanctum acknowledges the Traditional Custodians of the lands on
          which we work, and pays respect to Elders past and present. Sovereignty was
          never ceded.
        </div>

        <div className="footer-legal">
          <div>
            Aurella Group Pty Ltd · ABN 70 649 742 423<br />
            58 Wellington Street, Virginia QLD 4014, Australia
          </div>
          <div className="footer-legal-links">
            <Link href="/legal#terms-and-conditions">Terms</Link>
            <Link href="/legal#privacy-policy">Privacy</Link>
            <Link href="/legal#cookie-policy">Cookies</Link>
            {/* Re-opens the banner. A choice somebody cannot change is
                not a choice, and burying it is the same as removing it. */}
            <a href="#cookie-settings">Cookie settings</a>
            <Link href="/legal">All policies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
