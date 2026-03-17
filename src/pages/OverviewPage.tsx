import { useState, useEffect } from "react";
import StatCard from "../components/ui/StatCard";
import RevenueLineChart from "../components/charts/RevenueLineChart";
import ActiveProjectsTable from "../components/tables/ActiveProjectsTable";
import AddProjectModal from "../components/ui/AddProjectModal";
import ConfirmModal from "../components/ui/ConfirmModal";
import { supabase } from "../lib/supabase";
import { useAuth } from "../components/auth/AuthProvider";
import GitHubHeatmap from "../components/widgets/GitHubHeatmap";
import GitHubActivityTable from "../components/tables/GitHubActivityTable";
import AddGitHubActivityModal from "../components/ui/AddGitHubActivityModal";
import { useCurrency } from "../hooks/useCurrency";
import { useGitHub } from "../hooks/useGitHub";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function OverviewPage() {
  const { user } = useAuth();
  const { format, formatRate } = useCurrency();
  const showGitHub = useGitHub();

  const [activeProjects, setActiveProjects] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  const [liveStats, setLiveStats] = useState([
    { label: "Total Revenue", value: format(0) },
    { label: "Avg Hourly Rate", value: formatRate(0) },
    { label: "Total Clients", value: "0" },
    { label: "Project Completion", value: "0%" },
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [monthlyRevenue, setMonthlyRevenue] = useState<any[]>([]);

  const [githubActivities, setGithubActivities] = useState<any[]>([]);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [activityToEdit, setActivityToEdit] = useState<any>(null);
  const [itemToDelete, setItemToDelete] = useState<{
    id: string;
    type: "project" | "github";
  } | null>(null);
  const [githubStats, setGithubStats] = useState({
    commits: Array(28).fill(0),
    total: 0,
    streak: 0,
  });

  async function fetchProjects() {
    if (!user) return;
    const { data: projData } = await supabase
      .from("projects")
      .select("*, clients(name)")
      .neq("status", "Completed")
      .order("deadline", { ascending: true })
      .limit(5);

    if (projData) {
      setActiveProjects(
        projData.map((p) => ({
          name: p.name,
          client: p.clients?.name || "Unknown",
          deadline: p.deadline,
          hoursLogged: Number(p.hours_logged),
          status: p.status,
          id: p.id,
          client_id: p.client_id,
          techStack: p.tech_stack,
          startDate: p.start_date,
          github_link: p.github_link,
          website_link: p.website_link,
          other_link: p.other_link,
        }))
      );
    }
  }

  async function fetchGithubActivity() {
    if (!user) return;
    const { data } = await supabase
      .from("github_activity")
      .select("*")
      .order("date", { ascending: false });

    if (data) {
      setGithubActivities(data);
      const counts = Array(28).fill(0);
      let total = 0;
      data.forEach((a) => {
        total++;
        const d = new Date(a.date);
        const day = Math.abs(new Date().getDate() - d.getDate()) % 28;
        counts[27 - day] += 1;
      });
      setGithubStats({ commits: counts, total, streak: total > 0 ? 5 : 0 });
    }
  }

  useEffect(() => {
    async function fetchDashboardData() {
      if (!user) return;
      setLoadingProjects(true);

      await fetchProjects();
      setLoadingProjects(false);

      const [{ data: allProj }, { data: allTrans }, { data: allClients }] =
        await Promise.all([
          supabase.from("projects").select("status, hours_logged"),
          supabase.from("transactions").select("amount, date, category").eq("type", "Income"),
          supabase.from("clients").select("id", { count: "exact" }),
        ]);

      const totalRev = allTrans?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      const totalHours = allProj?.reduce((sum, p) => sum + Number(p.hours_logged), 0) || 0;
      const avgRate = totalHours > 0 ? Math.round(totalRev / totalHours) : 0;
      const completedProj = allProj?.filter((p) => p.status === "Completed").length || 0;
      const totalProjCount = allProj?.length || 0;
      const compRate = totalProjCount > 0 ? Math.round((completedProj / totalProjCount) * 100) : 0;

      setLiveStats([
        { label: "Total Revenue", value: format(totalRev) },
        { label: "Avg Hourly Rate", value: formatRate(avgRate) },
        { label: "Total Clients", value: (allClients?.length || 0).toString() },
        { label: "Project Completion", value: `${compRate}%` },
      ]);

      if (allTrans) {
        const monthlyMap: Record<string, number> = {};
        allTrans.forEach((t) => {
          const monthStr = MONTHS[new Date(t.date).getUTCMonth()];
          monthlyMap[monthStr] = (monthlyMap[monthStr] || 0) + Number(t.amount);
        });

        const curMonth = new Date().getUTCMonth();
        const last6Months = [];
        for (let i = 5; i >= 0; i--) {
          let mIndex = curMonth - i;
          if (mIndex < 0) mIndex += 12;
          const label = MONTHS[mIndex];
          last6Months.push({ month: label, revenue: monthlyMap[label] || 0 });
        }
        setMonthlyRevenue(last6Months);
      }

      if (showGitHub) await fetchGithubActivity();
    }

    fetchDashboardData();
  }, [user]);

  async function handleDeleteConfirm() {
    if (!itemToDelete) return;
    setIsDeleting(true);
    const table = itemToDelete.type === "project" ? "projects" : "github_activity";
    await supabase.from(table).delete().eq("id", itemToDelete.id);
    setIsDeleting(false);
    setItemToDelete(null);
    if (itemToDelete.type === "project") fetchProjects();
    else fetchGithubActivity();
  }

  function openEditModal(p: any) { setProjectToEdit(p); setIsModalOpen(true); }
  function openAddModal() { setProjectToEdit(null); setIsModalOpen(true); }
  function openEditActivity(a: any) { setActivityToEdit(a); setIsActivityModalOpen(true); }
  function openAddActivity() { setActivityToEdit(null); setIsActivityModalOpen(true); }

  return (
    <div className="page">
      <div className="page__toolbar">
        {showGitHub && (
          <button className="btn btn--outline" onClick={openAddActivity}>
            + New Activity
          </button>
        )}
        <button className="btn btn--primary" onClick={openAddModal}>
          + New Project
        </button>
      </div>

      <div className="page__row page__row--4">
        {liveStats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      {showGitHub ? (
        <div className="page__row page__row--2-1">
          <RevenueLineChart data={monthlyRevenue} />
          <GitHubHeatmap
            commits={githubStats.commits}
            totalCommits={githubStats.total}
            streak={githubStats.streak}
          />
        </div>
      ) : (
        <div className="page__row page__row--full">
          <RevenueLineChart data={monthlyRevenue} />
        </div>
      )}

      {showGitHub && (
        <div className="page__row page__row--full">
          <GitHubActivityTable
            activities={githubActivities}
            onEdit={openEditActivity}
            onDelete={(a) => setItemToDelete({ id: a.id, type: "github" })}
          />
        </div>
      )}

      <div className="page__row page__row--full">
        {loadingProjects ? (
          <div className="page-loading">Loading active projects...</div>
        ) : (
          <ActiveProjectsTable
            data={activeProjects}
            onEdit={openEditModal}
            onDelete={(p) => p.id && setItemToDelete({ id: p.id, type: "project" })}
          />
        )}
      </div>

      <AddProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onProjectAdded={fetchProjects}
        projectToEdit={projectToEdit}
      />

      {showGitHub && (
        <AddGitHubActivityModal
          isOpen={isActivityModalOpen}
          onClose={() => setIsActivityModalOpen(false)}
          onActivityAdded={fetchGithubActivity}
          activityToEdit={activityToEdit}
        />
      )}

      <ConfirmModal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        title={itemToDelete?.type === "project" ? "Delete Project" : "Delete Activity"}
        message="Are you sure you want to delete this? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteConfirm}
        confirmVariant="danger"
        loading={isDeleting}
      />
    </div>
  );
}