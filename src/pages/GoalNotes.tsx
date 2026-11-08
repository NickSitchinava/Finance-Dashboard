import { useRef } from "react";
import type { ReactNode } from "react";
import { Bold, Italic, Link2, List, ListOrdered } from "lucide-react";

function inline(value: string): ReactNode[] {
  return value.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\(https:\/\/[^)]+\))/g).filter(Boolean).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={i}>{part.slice(1, -1)}</em>;
    const link = part.match(/^\[([^\]]+)\]\((https:\/\/[^)]+)\)$/);
    if (link) return <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer">{link[1]}</a>;
    return part;
  });
}

export function GoalNotesDisplay({ value }: { value: string }) {
  return <div className="goals-notes">{value.split("\n").map((line, i) => {
    if (line.startsWith("- ")) return <p className="goals-notes__bullet" key={i}>{inline(line.slice(2))}</p>;
    if (/^\d+\. /.test(line)) return <p className="goals-notes__number" key={i}>{inline(line)}</p>;
    return <p key={i}>{line ? inline(line) : <br />}</p>;
  })}</div>;
}

export function GoalNotesEditor({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const input = useRef<HTMLTextAreaElement>(null);
  function insert(before: string, after = "") {
    const field = input.current;
    if (!field) return;
    const start = field.selectionStart, end = field.selectionEnd;
    const selected = value.slice(start, end) || "text";
    onChange(value.slice(0, start) + before + selected + after + value.slice(end));
    requestAnimationFrame(() => { field.focus(); field.setSelectionRange(start + before.length, start + before.length + selected.length); });
  }
  function line(prefix: string) {
    const field = input.current;
    if (!field) return;
    const at = value.lastIndexOf("\n", field.selectionStart - 1) + 1;
    onChange(value.slice(0, at) + prefix + value.slice(at));
    requestAnimationFrame(() => field.focus());
  }
  return <div className="goals-notes-editor"><div className="goals-notes-editor__toolbar" aria-label="Note formatting"><button type="button" onClick={() => insert("**", "**")} aria-label="Bold"><Bold size={14}/></button><button type="button" onClick={() => insert("*", "*")} aria-label="Italic"><Italic size={14}/></button><button type="button" onClick={() => line("- ")} aria-label="Bullet list"><List size={14}/></button><button type="button" onClick={() => line("1. ")} aria-label="Numbered list"><ListOrdered size={14}/></button><button type="button" onClick={() => insert("[", "](https://example.com)")} aria-label="Link"><Link2 size={14}/></button></div><textarea ref={input} value={value} onChange={event => onChange(event.target.value)} rows={4} aria-label="Formatted notes" placeholder="Write a note…"/></div>;
}
