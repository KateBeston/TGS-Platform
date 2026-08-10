/* ═══════════════════════════════════════════════════════════════════════
   FILE TYPES

   What a file is, described once. Browsers report the same file
   differently depending on the operating system — a zip arrives as
   application/zip on macOS, application/x-zip-compressed on Windows and
   sometimes multipart/x-zip — so grouping on the MIME type alone gives an
   inconsistent answer. The extension is the more reliable signal.
   ═══════════════════════════════════════════════════════════════════════ */

export type FileFormat = {
  key: string;
  label: string;
  extensions: string[];
  mimes: string[];
  isArchive?: boolean;
  /** Whether the browser can show it without downloading. */
  previewable?: boolean;
};

export const FILE_FORMATS: FileFormat[] = [
  { key: 'pdf', label: 'PDF', extensions: ['pdf'],
    mimes: ['application/pdf'], previewable: true },
  { key: 'word', label: 'Word', extensions: ['doc', 'docx', 'odt'],
    mimes: ['application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.oasis.opendocument.text'] },
  { key: 'spreadsheet', label: 'Spreadsheet', extensions: ['xls', 'xlsx', 'ods', 'csv'],
    mimes: ['application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.oasis.opendocument.spreadsheet', 'text/csv'] },
  { key: 'text', label: 'Text', extensions: ['txt', 'md', 'rtf'],
    mimes: ['text/plain', 'text/markdown', 'application/rtf', 'text/rtf'],
    previewable: true },
  { key: 'image', label: 'Image', extensions: ['jpg', 'jpeg', 'png', 'webp', 'tif', 'tiff', 'heic'],
    mimes: ['image/jpeg', 'image/png', 'image/webp', 'image/tiff', 'image/heic'],
    previewable: true },
  { key: 'archive', label: 'Archive', extensions: ['zip', '7z', 'gz', 'tar'],
    mimes: ['application/zip', 'application/x-zip-compressed', 'multipart/x-zip',
            'application/x-7z-compressed', 'application/gzip', 'application/x-tar'],
    isArchive: true },
  { key: 'signature', label: 'Signature', extensions: ['p7s', 'p7b'],
    mimes: ['application/pkcs7-signature', 'application/x-pkcs7-certificates'] },
];

export function detectFormat(fileName: string, mime?: string | null): FileFormat | null {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return FILE_FORMATS.find((f) => f.extensions.includes(ext))
    ?? (mime ? FILE_FORMATS.find((f) => f.mimes.includes(mime)) : undefined)
    ?? null;
}

export const isArchive = (fileName: string, mime?: string | null) =>
  detectFormat(fileName, mime)?.isArchive === true;

/** The accept attribute for a file input. Listing extensions as well as
 *  MIME types matters: Windows often reports an unfamiliar type as
 *  application/octet-stream, and a MIME-only accept list rejects it. */
export const ACCEPT_LEGAL = [
  ...FILE_FORMATS.flatMap((f) => f.extensions.map((e) => `.${e}`)),
  ...FILE_FORMATS.flatMap((f) => f.mimes),
].join(',');

export const ACCEPT_MEDIA = [
  '.jpg', '.jpeg', '.png', '.webp', '.avif', '.svg', '.tif', '.tiff', '.heic',
  '.pdf', '.mp4', '.mov', '.webm', '.zip',
  'image/*', 'video/mp4', 'video/quicktime', 'video/webm', 'application/pdf',
  'application/zip', 'application/x-zip-compressed',
].join(',');

export function humanSize(bytes: number | null | undefined): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
