import type { ReactNode } from 'react';

function Line({ width = '100%', height = 10, className = '' }: { width?: string; height?: number; className?: string }) {
  return <span className={`finance-skel-line ${className}`} style={{ width, height }} aria-hidden="true" />;
}

export const FinanceSkeletonLine = Line;

export function FinanceLoadError({ title, retry }: { title: string; retry: () => void }) {
  return <div className="finance-load-error" role="alert"><strong>{title} unavailable</strong><p>We could not load this section.</p><button type="button" onClick={retry}>Retry</button></div>;
}

export function FinanceUpdating({ children = 'Updating…' }: { children?: ReactNode }) {
  return <span className="finance-updating" role="status">{children}</span>;
}

export function FinanceKpiSkeleton() {
  return <section className="finance-metrics" aria-label="Financial summary loading">{[0,1,2].map(index => <div className="dashboard-metric finance-metric finance-metric--skeleton" role="status" aria-label="Loading financial summary" key={index}>
    <Line width={index === 1 ? '64px' : '72px'} height={10}/>
    <Line width={index === 2 ? '118px' : '136px'} height={25}/>
    <Line width="104px" height={9}/>
  </div>)}</section>;
}

export function FinanceChartSkeleton({ bar }: { bar: boolean }) {
  return <div className="finance-chart__loading" role="status" aria-label="Loading financial performance">
    <div className="finance-chart__summary"><Line width="108px" height={25}/><Line width="105px" height={9}/></div>
    <div className="finance-chart__body"><div className={`finance-skel-chart${bar ? ' finance-skel-chart--bar' : ''}`}>
      <div className="finance-skel-chart__grid"/>
      {bar ? <div className="finance-skel-chart__bars">{[0,1,2,3,4,5].map(index => <span key={index}><i/><i/></span>)}</div> : <div className="finance-skel-chart__area"/>}
    </div></div>
    <Line width="250px" height={9}/>
  </div>;
}

export function FinanceBreakdownSkeleton({ title, income }: { title: string; income: boolean }) {
  return <section className={`finance-panel finance-breakdown ${income ? 'finance-breakdown--income' : 'finance-breakdown--expense'}`} role="status" aria-label={`Loading ${title}`}>
    <div className="finance-panel__head"><div><h2>{title}</h2><p>{income ? 'Income' : 'Expenses'} by category</p></div></div>
    <div className="finance-breakdown__content">
      <div className="finance-donut finance-skel-donut"><div className="finance-skel-donut__ring"><div><Line width="78px" height={22}/><Line width="55px" height={9}/></div></div></div>
      <div className="finance-breakdown__list">{[0,1,2].map(index => <div className="finance-breakdown__item finance-skel-breakdown-row" key={index}><Line width="14px" height={14}/><Line width={index === 1 ? '85px' : '110px'} height={10}/><Line width="65px" height={10}/><Line width="29px" height={9}/></div>)}</div>
    </div>
  </section>;
}

export function FinanceProjectSkeleton() {
  return <section className="finance-panel" role="status" aria-label="Loading project profitability"><div className="finance-panel__head"><div><h2>Project profitability</h2><p>Recorded project income and costs</p></div><Line width="76px" height={9}/></div>
    <div className="finance-project-list">{[0,1,2].map(index => <div key={index}><Line width="78%" height={11}/><Line width="70%" height={9}/><Line width="70%" height={9}/><Line width="55px" height={10}/><Line width="46px" height={9}/></div>)}</div>
  </section>;
}

export function FinanceTransactionSkeleton() {
  return <div role="status" aria-label="Loading transactions" className="finance-skel-transactions"><div className="finance-table-wrap"><table className="finance-table finance-skel-table"><thead><tr><th>Transaction</th><th>Category / link</th><th>Date</th><th>Original</th><th>Display</th><th>Actions</th></tr></thead><tbody>{[0,1,2,3].map(index => <tr key={index}>
    <td data-label="Transaction"><Line width={index % 2 ? '92px' : '120px'} height={11}/><Line width="49px" height={9}/></td>
    <td data-label="Category"><Line width="86px" height={10}/><Line width="60px" height={8}/></td>
    <td data-label="Date"><Line width="74px" height={10}/></td>
    <td data-label="Original"><Line width="68px" height={10}/></td>
    <td data-label="Display"><Line width="65px" height={10}/></td>
    <td data-label="Actions"><Line width="60px" height={10}/></td>
  </tr>)}</tbody></table></div><div className="finance-pagination"><Line width="64px" height={9}/><Line width="112px" height={25}/></div></div>;
}

export function FinanceRecurringSkeleton() {
  return <div className="finance-recurring-grid" role="status" aria-label="Loading recurring activity">{[['Recurring schedules','Automation creates expected items, never recorded payments.'],['Expected activity','Review and record when money actually moves.']].map(([title,description]) => <section className="finance-panel" key={title}><div className="finance-panel__head"><div><h2>{title}</h2><p>{description}</p></div></div><div className="finance-schedule-list">{[0,1,2].map(index => <div key={index}><div><Line width="126px" height={11}/><Line width="166px" height={9}/></div><Line width="52px" height={10}/><Line width="70px" height={10}/></div>)}</div></section>)}</div>;
}

export function FinanceCategoriesSkeleton() {
  return <div className="finance-category-grid" role="status" aria-label="Loading categories"><section className="finance-panel"><div className="finance-panel__head"><div><h2>Manage categories</h2><p>Archive categories without changing past records.</p></div></div>{['Income','Expense'].map(type => <div className="finance-category-list" key={type}><h3>{type}</h3>{[0,1].map(index => <div key={index}><Line width="8px" height={8}/><Line width="90px" height={10}/><Line width="26px" height={26}/><Line width="34px" height={9}/></div>)}</div>)}</section><section className="finance-panel"><h2>New category</h2><div className="finance-form"><Line width="40px" height={9}/><Line width="100%" height={38}/><Line width="35px" height={9}/><Line width="100%" height={38}/><Line width="100%" height={39}/></div></section></div>;
}

export function FinanceReportsSkeleton() {
  return <div role="status" aria-label="Loading financial reports"><div className="finance-report-grid"><section className="finance-panel"><div className="finance-panel__head"><div><h2>Financial report</h2><Line width="136px" height={9}/></div></div><div className="finance-report-totals">{[0,1,2].map(index => <div key={index}><Line width="57px" height={9}/><Line width="82px" height={18}/></div>)}</div><div className="finance-report-note"><Line width="90%" height={9}/></div><div className="finance-report-actions"><Line width="92px" height={34}/><Line width="92px" height={34}/></div></section><section className="finance-panel"><h2>Client summary</h2>{[0,1].map(index => <div className="finance-summary-row" key={index}><Line width="90px" height={10}/><Line width="65px" height={10}/></div>)}<h2 className="finance-subhead">Project summary</h2>{[0,1].map(index => <div className="finance-summary-row" key={index}><Line width="112px" height={10}/><Line width="65px" height={10}/></div>)}</section></div><section className="finance-panel finance-invoice-summary"><div className="finance-panel__head"><div><h2>Invoice activity</h2><Line width="235px" height={9}/></div><Line width="100px" height={9}/></div><div className="finance-report-totals">{[0,1,2].map(index => <div key={index}><Line width="72px" height={9}/><Line width="36px" height={18}/></div>)}</div></section></div>;
}
