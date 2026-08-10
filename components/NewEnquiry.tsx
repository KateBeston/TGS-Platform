'use client';

import { useActionState } from 'react';
import { createEnquiry } from '@/app/actions/enquiries';

export default function NewEnquiry() {
  const [state, action, pending] = useActionState(
    async (_p: unknown, fd: FormData) => createEnquiry(fd), null
  );

  const sel = { background: 'var(--warm-white)', border: '1px solid var(--border-input)',
                padding: '8px 10px', fontSize: 13 };

  return (
    <form action={action} style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'flex-end',
                                   flexWrap: 'wrap' }}>
      <div className="f" style={{ minWidth: 160 }}>
        <label htmlFor="et">Record an enquiry</label>
        <select id="et" name="enquiry_type" style={sel}>
          <option>Retreat Host</option>
          <option>Wellness Guest</option>
          <option>Venue</option>
          <option>General</option>
        </select>
      </div>
      <div className="f" style={{ minWidth: 140 }}>
        <label htmlFor="ef">&nbsp;</label>
        <input id="ef" name="first_name" data-bwignore placeholder="First name" style={sel} />
      </div>
      <div className="f" style={{ minWidth: 140 }}>
        <label htmlFor="es">&nbsp;</label>
        <input id="es" name="surname" data-bwignore placeholder="Surname" style={sel} />
      </div>
      <div className="f" style={{ minWidth: 200 }}>
        <label htmlFor="ee">&nbsp;</label>
        <input id="ee" name="email" type="email" data-bwignore placeholder="Email" style={sel} />
      </div>
      <button className="btn" type="submit" disabled={pending}>
        {pending ? 'Creating…' : 'Create'}
      </button>
      {state?.error && (
        <div className="note bad" style={{ width: '100%', marginTop: 'var(--s3)', marginBottom: 0 }}>
          {state.error}
        </div>
      )}
    </form>
  );
}
