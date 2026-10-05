import type { TextBlock } from '../data/privateData'

export function LongTextSection({ blocks }: { blocks: TextBlock[] }) {
  return (
    <div className="long-text-section">
      {blocks.map((b, i) =>
        b.kind === 'heading' ? <h4 key={i}>{b.text}</h4> : <p key={i}>{b.text}</p>,
      )}
    </div>
  )
}
