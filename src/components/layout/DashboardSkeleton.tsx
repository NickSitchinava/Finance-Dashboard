import { useLocation } from "react-router-dom";
import "./DashboardSkeleton.css";

function Bar({ width, height = 10 }: { width: string; height?: number }) {
  return <span className="dashboard-skel__bar" style={{ width, height }} aria-hidden="true" />;
}

export function ProjectsContentSkeleton() {
  return <>
    <div className="dashboard-skel__metrics">
      {[0, 1, 2, 3].map(index => <div className={`dashboard-skel__metric${index === 0 ? " dashboard-skel__metric--primary" : ""}`} key={index}>
        <Bar width={index === 3 ? "110px" : "90px"} />
        <Bar width={index === 3 ? "90px" : "48px"} height={28} />
        <Bar width="135px" height={9} />
      </div>)}
    </div>
    <div className="dashboard-skel__collection">
      <div className="dashboard-skel__collection-head">
        <div className="dashboard-skel__tabs"><Bar width="110px" height={32}/><Bar width="120px" height={32}/></div>
        <Bar width="66px" height={30}/>
      </div>
      <div className="dashboard-skel__filters">
        {[0, 1, 2, 3, 4].map(index => <Bar key={index} width="100%" height={36}/>)}
      </div>
      <div className="dashboard-skel__project-cards">
        {[0, 1, 2].map(index => <div className="dashboard-skel__project-card" key={index}>
          <div className="dashboard-skel__card-top"><Bar width="74px" height={9}/><Bar width="66px" height={20}/></div>
          <Bar width={index === 1 ? "66%" : "48%"} height={18}/>
          <Bar width="88%" height={10}/>
          <Bar width="72%" height={10}/>
          <div className="dashboard-skel__tags"><Bar width="68px" height={20}/><Bar width="54px" height={20}/></div>
          <Bar width="100%" height={6}/>
          <div className="dashboard-skel__card-foot"><Bar width="82px" height={9}/><Bar width="100px" height={9}/></div>
        </div>)}
      </div>
    </div>
  </>;
}

function OverviewRouteSkeleton() {
  return <>
    <div className="dashboard-skel__toolbar"><Bar width="112px" height={12}/><Bar width="310px" height={34}/></div>
    <div className="dashboard-skel__overview-kpis">
      {[0, 1, 2, 3, 4].map(index => <div className={`dashboard-skel__metric${index === 0 ? " dashboard-skel__metric--primary" : ""}`} key={index}>
        <Bar width="105px" height={10}/><Bar width="115px" height={28}/><Bar width="150px" height={9}/>
      </div>)}
    </div>
    <div className="dashboard-skel__overview-grid">
      <div className="dashboard-skel__panel dashboard-skel__panel--chart">
        <div className="dashboard-skel__panel-head"><Bar width="160px" height={16}/><Bar width="130px" height={9}/></div>
        <Bar width="125px" height={25}/>
        <div className="dashboard-skel__chart"><div className="dashboard-skel__chart-shape"/></div>
      </div>
      <div className="dashboard-skel__panel dashboard-skel__panel--list">
        <Bar width="128px" height={16}/>
        {[0, 1, 2].map(index => <div className="dashboard-skel__list-row" key={index}><Bar width="28px" height={28}/><Bar width="62%" height={10}/><Bar width="48px" height={9}/></div>)}
      </div>
    </div>
  </>;
}

function FinancesRouteSkeleton() {
  return <>
    <div className="dashboard-skel__toolbar"><Bar width="240px" height={12}/><Bar width="150px" height={35}/></div>
    <div className="dashboard-skel__toolbar"><div className="dashboard-skel__tabs"><Bar width="92px" height={34}/><Bar width="105px" height={34}/><Bar width="90px" height={34}/><Bar width="95px" height={34}/></div><Bar width="205px" height={34}/></div>
    <div className="dashboard-skel__finance-kpis">
      {[0, 1, 2].map(index => <div className="dashboard-skel__metric" key={index}><Bar width="80px" height={10}/><Bar width="125px" height={28}/><Bar width="105px" height={9}/></div>)}
    </div>
    <div className="dashboard-skel__panel dashboard-skel__panel--finance-chart">
      <div className="dashboard-skel__panel-head"><div><Bar width="170px" height={16}/><Bar width="240px" height={9}/></div><Bar width="190px" height={34}/></div>
      <Bar width="125px" height={28}/>
      <div className="dashboard-skel__chart"><div className="dashboard-skel__chart-shape"/></div>
    </div>
  </>;
}

export function DashboardRouteSkeleton({ route }: { route?: string }) {
  const location = useLocation();
  const path = route ?? location.pathname;
  const section = path === "/finances" ? "finances" : path === "/projects" ? "projects" : "overview";
  return <div className={`dashboard-skel dashboard-skel--${section}`} role="status" aria-label={`Loading ${section}`}>
    {section === "projects" ? <><div className="dashboard-skel__toolbar"><div><Bar width="150px" height={27}/><Bar width="310px" height={10}/></div><Bar width="130px" height={35}/></div><ProjectsContentSkeleton/></> : section === "finances" ? <FinancesRouteSkeleton/> : <OverviewRouteSkeleton/>}
  </div>;
}
