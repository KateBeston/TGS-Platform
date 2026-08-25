'use client';

import { useState } from 'react';
import { AsYouType, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

type Country = { id: number; name: string; iso_code: string; dialling_code: string };

function flag(iso: string) {
  if (!iso || iso.length !== 2) return '';
  return String.fromCodePoint(...[...iso.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)));
}

/** Country-aware phone field that stores a single clean E.164 string.
 *  Person types naturally; it formats per the chosen country as they type,
 *  strips the trunk 0 per that country's rules, validates, and emits E.164.
 *  Use `name` for FormData POST forms (renders a hidden input carrying the
 *  E.164), and/or `onChange` for state-driven forms. */
export default function PhoneField({
  countries, value, onChange, name, defaultIso = '',
}: {
  countries: Country[];
  value?: string;                                  // existing E.164, or ''
  onChange?: (e164: string, valid: boolean) => void;
  name?: string;                                   // hidden input name for form POST
  defaultIso?: string;
}) {
  const withCodes = countries.filter((c) => c.dialling_code);
  const initial = value ? parsePhoneNumberFromString(value) : undefined;
  const [iso, setIso] = useState<string>(initial?.country ?? defaultIso);
  const [display, setDisplay] = useState<string>(initial ? initial.formatNational() : (value ?? ''));
  const [touched, setTouched] = useState(false);

  function emit(text: string, isoCode: string) {
    const cc = isoCode.toUpperCase() as CountryCode;
    if (cc && text.trim()) {
      const parsed = parsePhoneNumberFromString(text, cc);
      if (parsed) { onChange?.(parsed.number, parsed.isValid()); return; }
    }
    onChange?.('', false);
  }

  function handleNumber(raw: string) {
    const cc = iso.toUpperCase() as CountryCode;
    const formatted = iso ? new AsYouType(cc).input(raw) : raw;
    setDisplay(formatted); emit(formatted, iso);
  }

  function handleCountry(newIso: string) {
    setIso(newIso);
    const raw = display.replace(/\D/g, '');
    const formatted = newIso ? new AsYouType(newIso.toUpperCase() as CountryCode).input(raw) : raw;
    setDisplay(formatted); emit(formatted, newIso);
  }

  const parsed = iso && display.trim()
    ? parsePhoneNumberFromString(display, iso.toUpperCase() as CountryCode) : null;
  const invalid = touched && display.trim() !== '' && (!parsed || !parsed.isValid());
  const e164 = parsed?.isValid() ? parsed.number : '';

  return (
    <div>
      <div className="phone-row">
        <select className="phone-dial" value={iso} onChange={(e) => handleCountry(e.target.value)} aria-label="Country dialling code">
          <option value="">＋ —</option>
          {withCodes.map((c) => (
            <option key={c.id} value={c.iso_code}>{flag(c.iso_code)} {c.dialling_code} {c.name}</option>
          ))}
        </select>
        <input className="phone-num" type="tel" value={display}
          onChange={(e) => handleNumber(e.target.value)} onBlur={() => setTouched(true)}
          placeholder="Phone number" aria-invalid={invalid || undefined} />
      </div>
      {name && <input type="hidden" name={name} value={e164} />}
      {invalid && <p className="phone-invalid">That doesn&rsquo;t look like a valid number for the country selected.</p>}
    </div>
  );
}
