import { FINANCE_CATEGORY_ICONS, FinanceCategoryIcon } from './finance-category-icon';

export function FinanceCategoryPicker({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  return <fieldset className="finance-category-picker">
    <legend>Icon</legend>
    <div className="finance-category-picker__grid">
      {FINANCE_CATEGORY_ICONS.map(name => <button key={name} type="button" className={value === name ? 'is-active' : ''} aria-label={name} aria-pressed={value === name} title={name} onClick={() => onChange(name)}><FinanceCategoryIcon name={name}/></button>)}
    </div>
  </fieldset>;
}
