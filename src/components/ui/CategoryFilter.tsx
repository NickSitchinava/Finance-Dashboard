import { useState, useRef, useEffect } from "react";
import type { ClientCategory } from "../../hooks/useCategoryAssignments";

interface CategoryFilterProps {
  categories: ClientCategory[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

export default function CategoryFilter({ categories, selected, onChange }: CategoryFilterProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  const label = selected.length === 0
    ? "All Categories"
    : selected.length === 1
    ? categories.find((c) => c.id === selected[0])?.name ?? "1 selected"
    : `${selected.length} selected`;

  return (
    <div ref={ref} className="cat-filter">
      <button
        type="button"
        className={`cat-filter__btn${selected.length > 0 ? " cat-filter__btn--active" : ""}`}
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
        {label}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="cat-filter__dropdown">
          <div className="cat-filter__header">
            <span>Filter by category</span>
            {selected.length > 0 && (
              <button type="button" className="cat-filter__clear" onClick={() => onChange([])}>
                Clear
              </button>
            )}
          </div>

          {categories.length === 0 ? (
            <div className="cat-filter__empty">No categories yet</div>
          ) : (
            categories.map((cat) => (
              <label key={cat.id} className="cat-filter__item">
                <input
                  type="checkbox"
                  checked={selected.includes(cat.id)}
                  onChange={() => toggle(cat.id)}
                  className="cat-filter__checkbox"
                />
                <span className="cat-filter__dot" style={{ background: cat.color }} />
                <span className="cat-filter__name">{cat.name}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}