import { Fragment, type ReactNode } from "react";

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i} className="font-semibold text-white">
        {p.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{p}</Fragment>
    ),
  );
}

function isSep(row: string): boolean {
  return row.includes("-") && /^\s*\|?[\s:|-]+\|?\s*$/.test(row);
}

// Lightweight markdown renderer for SecretarIA's answers (headings, bold, lists, tables).
export default function MarkdownLite({ content, testId = "ai-response-content" }: { content: string; testId?: string }) {
  const out: ReactNode[] = [];
  const lines = content.split("\n");
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim().startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        if (!isSep(lines[i])) {
          rows.push(
            lines[i].trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim()),
          );
        }
        i++;
      }
      out.push(
        <div key={key++} className="my-3 overflow-x-auto rounded-lg border border-slate-700/60" data-testid={`${testId}-table-${key}`}>
          <table className="w-full text-sm">
            {rows[0] && (
              <thead>
                <tr className="bg-slate-800/60">
                  {rows[0].map((c, ci) => (
                    <th key={ci} className="px-3 py-2 text-left font-medium text-slate-300">
                      {inline(c)}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {rows.slice(1).map((r, ri) => (
                <tr key={ri} className="border-t border-slate-700/50">
                  {r.map((c, ci) => (
                    <td key={ci} className="px-3 py-2 text-slate-200">
                      {inline(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (/^[-*]\s+/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i++;
      }
      out.push(
        <ul key={key++} className="my-2 list-disc space-y-1 pl-5 text-slate-200">
          {items.map((it, ii) => (
            <li key={ii}>{inline(it)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\d+[.)]\s+/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+[.)]\s+/, ""));
        i++;
      }
      out.push(
        <ol key={key++} className="my-2 list-decimal space-y-1 pl-5 text-slate-200">
          {items.map((it, ii) => (
            <li key={ii}>{inline(it)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    if (line.trim().startsWith("### ")) {
      out.push(
        <h4 key={key++} className="mt-4 text-xs font-semibold uppercase tracking-wider text-sky-300">
          {inline(line.trim().slice(4))}
        </h4>,
      );
      i++;
      continue;
    }

    if (line.trim().startsWith("## ")) {
      out.push(
        <h3 key={key++} className="mt-4 text-lg font-bold tracking-tight text-white">
          {inline(line.trim().slice(3))}
        </h3>,
      );
      i++;
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    out.push(
      <p key={key++} className="my-2 leading-relaxed text-slate-200">
        {inline(line)}
      </p>,
    );
    i++;
  }

  return (
    <div className="text-[15px]" data-testid={testId}>
      {out}
    </div>
  );
}
