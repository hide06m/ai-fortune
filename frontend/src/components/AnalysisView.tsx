/**
 * AIの診断文を、読みやすく見せる
 *
 * 診断文は、「## 見出し」で区切られた、いくつかの部分でできている。長いと、読む気がなくなるので、
 * 最初の部分（総合結論）だけを開いておき、あとの部分は、見出しだけを並べて、押すと開く形にする。
 * 「ぜんぶ開く」で、一度に開ける。
 */

import { useMemo, useState } from 'react';
import Markdown from 'react-markdown';
import remarkCjkFriendly from 'remark-cjk-friendly';

const COMPONENTS = {
  h1: ({ node, ...props }: any) => <h1 className="markdown-h1" {...props} />,
  h2: ({ node, ...props }: any) => <h2 className="markdown-h2" {...props} />,
  h3: ({ node, ...props }: any) => <h3 className="markdown-h3" {...props} />,
  p: ({ node, ...props }: any) => <p className="markdown-p" {...props} />,
  ul: ({ node, ...props }: any) => <ul className="markdown-ul" {...props} />,
  ol: ({ node, ...props }: any) => <ol className="markdown-ol" {...props} />,
  li: ({ node, ...props }: any) => <li className="markdown-li" {...props} />,
  strong: ({ node, ...props }: any) => <strong className="markdown-strong" {...props} />,
  em: ({ node, ...props }: any) => <em className="markdown-em" {...props} />,
};

function Md({ children }: { children: string }) {
  return (
    <Markdown remarkPlugins={[remarkCjkFriendly]} components={COMPONENTS}>
      {children}
    </Markdown>
  );
}

interface Section {
  title: string | null;
  body: string;
}

/** 行頭の「## 」で、部分に分ける（最初の見出しより前の文章は、見出しなしの部分になる） */
export function splitSections(text: string): Section[] {
  const lines = text.split('\n');
  const out: Section[] = [];
  let cur: Section = { title: null, body: '' };
  for (const line of lines) {
    const m = /^##\s+(.*)$/.exec(line);
    if (m) {
      if (cur.title !== null || cur.body.trim()) out.push(cur);
      cur = { title: m[1].trim(), body: '' };
    } else {
      cur.body += line + '\n';
    }
  }
  if (cur.title !== null || cur.body.trim()) out.push(cur);
  return out;
}

export function AnalysisView({ text }: { text: string }) {
  const sections = useMemo(() => splitSections(text), [text]);
  const [openAll, setOpenAll] = useState(false);
  const [nonce, setNonce] = useState(0);

  // 見出しが、ひとつもない（短い診断など）ときは、そのまま全部を出す
  if (sections.length <= 1 && sections[0]?.title === null) return <Md>{text}</Md>;

  // 見出しなしの先頭の部分、または、最初の見出しの部分は、開いておく
  const head = sections[0];
  const rest = sections.slice(head.title === null ? 1 : 0);
  const firstOpen = head.title !== null; // 先頭が見出しつきなら、それを開く

  return (
    <div className="analysis-view">
      {head.title === null && <Md>{head.body}</Md>}
      {rest.length > 0 && (
        <div className="analysis-toolbar">
          <button
            type="button"
            onClick={() => {
              setOpenAll((v) => !v);
              setNonce((n) => n + 1);
            }}
          >
            {openAll ? 'ぜんぶ閉じる' : 'ぜんぶ開く'}
          </button>
        </div>
      )}
      {rest.map((s, i) => (
        <details key={`${nonce}-${i}`} className="analysis-section" open={openAll || (firstOpen && i === 0)}>
          <summary>{s.title}</summary>
          <Md>{s.body}</Md>
        </details>
      ))}
    </div>
  );
}
