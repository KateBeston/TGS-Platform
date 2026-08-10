/* The lockup is the mark, so its colour is declared here rather than
   inherited — a stylesheet elsewhere recolouring it on hover is what made
   the script word read as gold, and inheritance is the mechanism that
   allowed it.
 *
 * `top` may be omitted to render the service word alone, which is the
 * right register where the surrounding page already establishes whose
 * portal this is. Repeating SANCTUM on every division header is noise. */

export default function Lockup({
  word, register = 'script', top, size = 'md',
}: {
  word: string;
  register?: 'script' | 'caps';
  top?: string | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const scale = size === 'lg' ? 1.5 : size === 'sm' ? 0.78 : 1;

  return (
    <div className={`lockup ${size === 'lg' ? 'lg' : ''}`} style={{ color: 'var(--charcoal)' }}>
      {top && (
        <div className="lk-sanctum" style={{ fontSize: 18 * scale, color: 'var(--charcoal)' }}>
          {top}
        </div>
      )}
      <div className="lk-rule"
           style={{ color: 'var(--charcoal)', marginTop: top ? undefined : 0 }}>
        <span className={`lk-word ${register}`}
              style={{ color: 'var(--charcoal)',
                       fontSize: (register === 'script' ? 29 : 16) * scale }}>
          {word}
        </span>
      </div>
    </div>
  );
}
