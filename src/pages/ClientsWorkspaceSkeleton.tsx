import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, GripVertical, Search } from "lucide-react";
import "./ClientsWorkspaceSkeleton.css";

type SkeletonProps = {
  view?: "kanban" | "list";
  tab?: "clients" | "pipeline";
};

function subscribeHeaderTarget(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}

function getHeaderTarget() {
  return document.getElementById("clients-header-actions");
}

function Bar({ width, height = 10, className = "" }: { width: string; height?: number; className?: string }) {
  return <span className={`crm-skeleton__bar ${className}`} style={{ width, height }} />;
}

function Card({ index }: { index: number }) {
  return <div className="crm-skeleton__card">
    <div className="crm-skeleton__card-identity">
      <span className="crm-skeleton__avatar" />
      <div className="crm-skeleton__card-copy">
        <Bar width={index % 2 ? "57%" : "70%"} height={11} />
        <Bar width={index % 2 ? "76%" : "48%"} height={8} />
      </div>
      <GripVertical size={15} className="crm-skeleton__grip" />
    </div>
    <div className="crm-skeleton__card-meta"><span className="crm-skeleton__mini-icon" /><Bar width={index % 2 ? "70px" : "57px"} height={8} /></div>
  </div>;
}

function Board({ tab }: { tab: "clients" | "pipeline" }) {
  const stages = tab === "clients" ? ["Active", "Completed", "Archived"] : ["Lead", "Contacted", "Negotiating"];
  return <>
    <div className="crm-skeleton__mobile-stage"><ArrowLeft size={16} /><span>{stages[0]}</span><ArrowRight size={16} /></div>
    <div className="crm-skeleton__board">
      {stages.map((stage, column) => <section className={`crm-skeleton__column${column ? " crm-skeleton__mobile-hidden" : ""}`} key={stage}>
        <div className="crm-skeleton__column-head"><strong>{stage}</strong><Bar width="19px" height={19} className="crm-skeleton__count" /></div>
        <Bar width={column === 1 ? "72%" : "59%"} height={8} className="crm-skeleton__column-subtitle" />
        <div className="crm-skeleton__cards">{Array.from({ length: column === 1 ? 1 : 2 }, (_, index) => <Card key={index} index={column + index} />)}</div>
      </section>)}
    </div>
  </>;
}

function ListSkeleton() {
  return <div className="crm-list crm-skeleton__list">
    <div className="crm-list-head"><span>Client</span><span>Email</span><span>Phone</span><span>Industry</span><span>Projects</span><span>Stage</span></div>
    {Array.from({ length: 4 }, (_, index) => <div className="crm-list-row crm-skeleton__list-row" key={index}>
      <span className="crm-skeleton__list-person"><span className="crm-skeleton__avatar" /><Bar width={index % 2 ? "85px" : "116px"} height={10} /></span>
      <Bar width={index % 2 ? "75%" : "60%"} height={9} />
      <Bar width={index % 2 ? "70%" : "54%"} height={9} />
      <span className="crm-skeleton__list-chip"><Bar width="77px" height={8} /></span>
      <Bar width="52px" height={9} />
      <span className="crm-skeleton__list-select"><Bar width="48px" height={9} /><span className="crm-skeleton__chevron" /></span>
    </div>)}
  </div>;
}

export default function ClientsWorkspaceSkeleton({ view = "kanban", tab = "clients" }: SkeletonProps) {
  const headerActions = useSyncExternalStore(subscribeHeaderTarget, getHeaderTarget, () => null);
  return <div className="page crm-page crm-skeleton" role="status" aria-label="Loading clients workspace" aria-busy="true">
    {headerActions && createPortal(<span className="crm-skeleton__header-actions" aria-hidden="true"><Bar width="105px" height={34} /><Bar width="112px" height={34} /></span>, headerActions)}
    <div aria-hidden="true">
      <div className="crm-overview-row crm-skeleton__overview">
        <div className="crm-skeleton__tabs"><Bar width="78px" height={32} /><Bar width="88px" height={32} /></div>
        <div className="crm-skeleton__stats">{["Total clients", "Active", "Pipeline prospects"].map((label) => <div key={label}><Bar width="18px" height={17} /><span>{label}</span></div>)}</div>
      </div>
      <div className="crm-skeleton__controls">
        <div className="crm-skeleton__search"><Search size={15} /><Bar width="61%" height={9} /></div>
        <div className="crm-skeleton__filter"><span className="crm-skeleton__filter-icon" /><Bar width="83px" height={9} /><span className="crm-skeleton__chevron" /></div>
        <div className="crm-skeleton__check"><span /><Bar width="87px" height={9} /></div>
        <div className="crm-skeleton__check"><span /><Bar width="88px" height={9} /></div>
        <div className="crm-skeleton__view"><span /><span /></div>
      </div>
      <div className="crm-skeleton__utility"><div><Bar width="44px" height={9} /><Bar width="43px" height={9} /><Bar width="48px" height={9} /></div><Bar width="100px" height={9} /></div>
      {view === "kanban" ? <Board tab={tab} /> : <ListSkeleton />}
    </div>
  </div>;
}
