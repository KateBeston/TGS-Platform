/** A readable device name from a user agent string.
 *
 *  Nobody reads a raw agent string, and an access log people cannot read
 *  is an access log people do not check. Deliberately rough — the point
 *  is "was this me on my laptop" rather than exact identification.
 */
export function deviceFrom(ua: string | null | undefined): string {
  if (!ua) return 'Unknown';

  const os =
    /iPhone/i.test(ua) ? 'iPhone'
    : /iPad/i.test(ua) ? 'iPad'
    : /Android/i.test(ua) ? 'Android'
    : /Macintosh|Mac OS X/i.test(ua) ? 'Mac'
    : /Windows/i.test(ua) ? 'Windows'
    : /Linux/i.test(ua) ? 'Linux'
    : 'Unknown device';

  // Order matters: Edge and Chrome both claim Safari, and Chrome claims
  // Safari too. Most specific first.
  const browser =
    /Edg\//i.test(ua) ? 'Edge'
    : /OPR\/|Opera/i.test(ua) ? 'Opera'
    : /Chrome\//i.test(ua) ? 'Chrome'
    : /Firefox\//i.test(ua) ? 'Firefox'
    : /Safari\//i.test(ua) ? 'Safari'
    : null;

  return browser ? `${os} · ${browser}` : os;
}
