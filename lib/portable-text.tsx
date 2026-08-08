import Link from 'next/link';
import { imageUrl, type PortableBlock } from '@/lib/sanity';

/* A Portable Text renderer.
 *
 * Portable Text is an array of blocks, each with a style and children
 * carrying marks. The marks that need a definition — links — are in
 * markDefs on the block, keyed. That indirection is the only part that
 * catches people out.
 *
 * Handles what the schema actually uses: normal, h2/h3/h4, blockquote,
 * lists, and em/strong/link. An unknown style renders as a paragraph
 * rather than disappearing, because a block that vanishes is worse than
 * one that looks plain.
 */

type Child = { _key?: string; text?: string; marks?: string[] };
type MarkDef = { _key: string; _type: string; href?: string };

function Spans({ children, markDefs }: {
  children: Child[]; markDefs: MarkDef[];
}) {
  return (
    <>
      {children.map((span, i) => {
        const text = span.text ?? '';
        if (!text) return null;

        const marks = span.marks ?? [];
        let node: React.ReactNode = text;

        // Decorators, innermost first so nesting reads correctly.
        if (marks.includes('code')) node = <code>{node}</code>;
        if (marks.includes('em')) node = <em>{node}</em>;
        if (marks.includes('strong')) node = <strong>{node}</strong>;

        // Annotations: a mark that is not a decorator is a key into
        // markDefs. This is the part a naive renderer drops.
        const linkKey = marks.find((m) =>
          !['em', 'strong', 'code', 'underline', 'strike-through'].includes(m));

        if (linkKey) {
          const def = markDefs.find((d) => d._key === linkKey);
          if (def?.href) {
            const internal = def.href.startsWith('/');
            node = internal
              ? <Link href={def.href}>{node}</Link>
              : <a href={def.href} target="_blank" rel="noopener noreferrer">{node}</a>;
          }
        }

        return <span key={span._key ?? i}>{node}</span>;
      })}
    </>
  );
}

function Block({ block }: { block: PortableBlock }) {
  const children = block.children ?? [];
  const markDefs = (block.markDefs ?? []) as MarkDef[];
  const inner = <Spans children={children} markDefs={markDefs} />;

  switch (block.style) {
    case 'h1':
    case 'h2': return <h2>{inner}</h2>;
    case 'h3': return <h3>{inner}</h3>;
    case 'h4': return <h4>{inner}</h4>;
    case 'blockquote':
      return <blockquote className="pull-quote">{inner}</blockquote>;
    default:
      // An unrecognised style renders as a paragraph. A block that
      // vanishes because nobody anticipated its style is worse than one
      // that looks plain.
      return <p>{inner}</p>;
  }
}

export default function PortableText({ blocks }: { blocks: PortableBlock[] | null }) {
  if (!blocks?.length) return null;

  const out: React.ReactNode[] = [];
  let list: { items: PortableBlock[]; type: string } | null = null;

  const flush = (key: string) => {
    if (!list) return;
    const Tag = list.type === 'number' ? 'ol' : 'ul';
    out.push(
      <Tag key={`list-${key}`}>
        {list.items.map((b, i) => (
          <li key={b._key ?? i}>
            <Spans children={b.children ?? []}
              markDefs={(b.markDefs ?? []) as MarkDef[]} />
          </li>
        ))}
      </Tag>
    );
    list = null;
  };

  blocks.forEach((block, i) => {
    const key = block._key ?? String(i);

    // An image sitting in the body, which the schema allows even if the
    // articles so far do not use one.
    if (block._type === 'image') {
      flush(key);
      const src = imageUrl(block.asset?._ref, { w: 1200 });
      if (src) {
        out.push(
          <figure key={key} className="article-figure">
            <img src={src} alt={block.alt ?? ''} loading="lazy" />
            {block.alt && <figcaption>{block.alt}</figcaption>}
          </figure>
        );
      }
      return;
    }

    if (block._type !== 'block') { flush(key); return; }

    // Consecutive list items become one list. Portable Text has no list
    // container — each item is its own block — so runs have to be
    // gathered or every bullet becomes a list of one.
    if (block.listItem) {
      if (list && list.type !== block.listItem) flush(key);
      list ??= { items: [], type: block.listItem };
      list.items.push(block);
      return;
    }

    flush(key);
    out.push(<Block key={key} block={block} />);
  });

  flush('end');
  return <>{out}</>;
}

/** Roughly how long it takes to read. Counted from the blocks rather
 *  than guessed, and only shown where it is worth knowing. */
export function readingMinutes(blocks: PortableBlock[] | null) {
  if (!blocks?.length) return null;
  const words = blocks
    .filter((b) => b._type === 'block')
    .flatMap((b) => (b.children ?? []).map((c) => c.text ?? ''))
    .join(' ').trim().split(/\s+/).length;
  return words > 200 ? Math.max(1, Math.round(words / 220)) : null;
}
