/** Whether a password has appeared in a known breach.
 *
 *  Uses Have I Been Pwned's range API, which is built so the password
 *  never leaves the browser: the first five characters of its SHA-1 are
 *  sent, and around 500 hashes come back to compare locally. HIBP cannot
 *  tell which one was being asked about, and neither can anybody watching
 *  the request.
 *
 *  Worth doing because length rules do not catch the actual problem.
 *  "Password123!" satisfies most complexity requirements and appears in
 *  breach corpora millions of times.
 */
export type PasswordVerdict = {
  ok: boolean;
  breached: boolean;
  timesSeen: number;
  reason?: string;
};

async function sha1(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export async function checkPassword(password: string): Promise<PasswordVerdict> {
  if (password.length < 12) {
    return { ok: false, breached: false, timesSeen: 0,
             reason: 'At least twelve characters.' };
  }

  // A long phrase beats a short one with symbols in it, but a long phrase
  // of one repeated word does not.
  if (/^(.)\1+$/.test(password)) {
    return { ok: false, breached: false, timesSeen: 0,
             reason: 'That is one character repeated.' };
  }

  try {
    const hash = await sha1(password);
    const prefix = hash.slice(0, 5);
    const rest = hash.slice(5);

    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
    });
    if (!res.ok) {
      // A check that cannot run must not block somebody from setting a
      // password. Failing open is right here — the alternative is being
      // locked out because a third party is down.
      return { ok: true, breached: false, timesSeen: 0 };
    }

    const text = await res.text();
    for (const line of text.split('\n')) {
      const [suffix, count] = line.trim().split(':');
      if (suffix === rest) {
        const times = Number(count ?? 0);
        return {
          ok: false, breached: true, timesSeen: times,
          reason: `This password appears in known breaches ${
            times.toLocaleString('en-AU')} times. It is not obscure — it is on lists that `
            + 'attackers try first.',
        };
      }
    }

    return { ok: true, breached: false, timesSeen: 0 };
  } catch {
    return { ok: true, breached: false, timesSeen: 0 };
  }
}
