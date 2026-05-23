import { useState, useRef, useEffect } from "react";
import type { ClientCategory } from "../../hooks/useCategoryAssignments";

interface CategoryComboboxProps {
  categories: ClientCategory[];
  selected: ClientCategory[];
  onChange: (selected: ClientCategory[]) => void;
}

export default function CategoryCombobox({
  categories,
  selected,
  onChange,
}: CategoryComboboxProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = categories.filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) &&
      !selected.find((s) => s.id === c.id)
  );

  function select(cat: ClientCategory) {
    onChange([...selected, cat]);
    setQuery("");
  }

  function remove(id: string) {
    onChange(selected.filter((s) => s.id !== id));
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="form-group">
      <label>Categories <span style={{ opacity: 0.5, fontWeight: 400, fontSize: "0.75rem" }}>(optional)</span></label>

      {selected.length > 0 && (
        <div className="cat-chips">
          {selected.map((cat) => (
            <span key={cat.id} className="cat-chip" style={{ borderColor: cat.color, color: cat.color, background: `${cat.color}18` }}>
              <span className="cat-chip__dot" style={{ background: cat.color }} />
              {cat.name}
              <button
                type="button"
                className="cat-chip__remove"
                onClick={() => remove(cat.id)}
                aria-label={`Remove ${cat.name}`}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      <div ref={containerRef} style={{ position: "relative" }}>
        <input
          type="text"
          placeholder={categories.length === 0 ? "No categories yet — create them in Settings" : "Search categories..."}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          disabled={categories.length === 0}
          autoComplete="off"
        />

        {open && (filtered.length > 0 || query.length > 0) && (
          <div className="cat-dropdown">
            {filtered.length === 0 ? (
              <div className="cat-dropdown__empty">No matching categories</div>
            ) : (
              filtered.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className="cat-dropdown__item"
                  onMouseDown={(e) => { e.preventDefault(); select(cat); setOpen(false); }}
                >
                  <span className="cat-dropdown__dot" style={{ background: cat.color }} />
                  {cat.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}