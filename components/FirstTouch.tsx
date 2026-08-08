'use client';

import { useEffect } from 'react';
import { captureFirstTouch } from '@/lib/attribution';

/* Mounted once by the layout. Records how somebody arrived, on their
 * first page, and never again in that session. */
export default function FirstTouch() {
  useEffect(() => { captureFirstTouch(); }, []);
  return null;
}
