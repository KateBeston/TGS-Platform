'use client';

import { useActionState } from 'react';
import { createContact } from '@/app/actions/contacts';

export default function NewContact() {
  const [state, action, pending] = useActionState(
    async (_p: unknown, fd: FormData) => createContact(fd), null
  );

  return (
    <form action={action} style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'flex-end',
                                   flexWrap: 'wrap' }}>
      <div className="f" style={{ minWidth: 150 }}>
        <label htmlFor="first_name">Add a contact</label>
        <input data-bwignore data-1p-ignore data-lpignore="true" data-form-type="other" id="first_name" name="first_name" placeholder="First name" />
      </div>
      <div className="f" style={{ minWidth: 150 }}>
        <label htmlFor="surname">&nbsp;</label>
        <input data-bwignore data-1p-ignore data-lpignore="true" data-form-type="other" id="surname" name="surname" placeholder="Surname" />
      </div>
      <div className="f" style={{ minWidth: 180 }}>
        <label htmlFor="organisation">&nbsp;</label>
        <input data-bwignore data-1p-ignore data-lpignore="true" data-form-type="other" id="organisation" name="organisation" placeholder="Organisation" />
      </div>
      <div className="f" style={{ minWidth: 200 }}>
        <label htmlFor="email">&nbsp;</label>
        <input data-bwignore data-1p-ignore data-lpignore="true" data-form-type="other" id="email" name="email" type="email" placeholder="Email" />
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
