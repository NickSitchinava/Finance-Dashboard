import { useState, useEffect } from "react";
import StatCard from "../components/ui/StatCard";
import HoursBarChart from "../components/charts/HoursBarChart";
import ProjectsTable from "../components/tables/ProjectsTable";
import GitHubHeatmap from "../components/widgets/GitHubHeatmap";
import GitHubActivityTable from "../components/tables/GitHubActivityTable";
import AddGitHubActivityModal from "../components/ui/AddGitHubActivityModal";
import AddProjectModal from "../components/ui/AddProjectModal";
import LogHoursModal from "../components/ui/LogHoursModal";
import LogProgressModal from "../components/ui/LogProgressModal";
import ConfirmModal from "../components/ui/ConfirmModal";
import { supabase } from "../lib/supabase";
import { useAuth } from "../components/auth/AuthProvider";

export default function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  const [githubActivities, setGithubActivities] = useState<any[]>([]);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [activityToEdit, setActivityToEdit] = useState<any>(null);
  const [githubStats, setGithubStats] = useState({
    commits: Array(28).fill(0),
    total: 0,
    streak: 0,
  });

  const [itemToDelete, setItemToDelete] = useState<{
    id: string;
    type: "project" | "github";
  } | null>(null);

  const [hoursProject, setHoursProject] = useState<any>(null);
  const [isHoursModalOpen, setIsHoursModalOpen] = useState(false);

  const [progressProject, setProgressProject] = useState<any>(null);
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);

  async function fetchProjects() {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("projects")
      .select("*, clients ( name )")
      .order("created_at", { ascending: false });

    if (data) {
      const formatted = data.map((d) => ({
        ...d,
        client: d.clients?.name || "Unknown",
        techStack: d.tech_stack ?? [],
        startDate: d.start_date,
        hoursLogged: Number(d.hours_logged),
        percentComplete: Number(d.percent_complete),
        github_link: d.github_link,
        website_link: d.website_link,
        other_link: d.other_link,
      }));
      setProjects(formatted);
    }
    setLoading(false);
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

  function openEditModal(p: any) {
    setProjectToEdit(p);
    setIsModalOpen(true);
  }

  function openAddModal() {
    setProjectToEdit(null);
    setIsModalOpen(true);
  }

  function openEditActivity(a: any) {
    setActivityToEdit(a);
    setIsActivityModalOpen(true);
  }

  function openAddActivity() {
    setActivityToEdit(null);
    setIsActivityModalOpen(true);
  }

  function openLogHours(p: any) {
    setHoursProject(p);
    setIsHoursModalOpen(true);
  }

  function openLogProgress(p: any) {
    setProgressProject(p);
    setIsProgressModalOpen(true);
  }

  useEffect(() => {
    fetchProjects();
    fetchGithubActivity();
  }, [user]);

  const totalHours = projects.reduce((sum, p) => sum + p.hoursLogged, 0);
  const avgHours = projects.length ? Math.round(totalHours / projects.length) : 0;

  const liveStats = [
    { label: "Active Projects", value: projects.length.toString(), trend: "up" as const },
    { label: "Total Hours Logged", value: totalHours.toString() },
    { label: "Avg Hours/Project", value: avgHours.toString() },
  ];

  const liveHoursPerProject = projects.map((p) => ({
    project: p.name,
    hours: p.hoursLogged,
  }));

  return (
    <div className="page">
      <div className="page__toolbar">
        <button className="btn btn--outline" onClick={openAddActivity}>
          + New Activity
        </button>
        <button className="btn btn--primary" onClick={openAddModal}>
          + New Project
        </button>
      </div>

      <div className="page__row page__row--3">
        {liveStats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="page__row page__row--2-1">
        <HoursBarChart data={liveHoursPerProject} />
        <GitHubHeatmap
          commits={githubStats.commits}
          totalCommits={githubStats.total}
          streak={githubStats.streak}
        />
      </div>

      <div className="page__row page__row--full">
        <GitHubActivityTable
          activities={githubActivities}
          onEdit={openEditActivity}
          onDelete={(a) => setItemToDelete({ id: a.id, type: "github" })}
        />
      </div>

      <div className="page__row page__row--full">
        {loading ? (
          <div className="page-loading">Loading projects...</div>
        ) : (
          <ProjectsTable
            data={projects}
            onEdit={openEditModal}
            onDelete={(p) => p.id && setItemToDelete({ id: p.id, type: "project" })}
            onLogHours={openLogHours}
            onLogProgress={openLogProgress}
          />
        )}
      </div>

      <AddProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onProjectAdded={fetchProjects}
        projectToEdit={projectToEdit}
      />

      <AddGitHubActivityModal
        isOpen={isActivityModalOpen}
        onClose={() => setIsActivityModalOpen(false)}
        onActivityAdded={fetchGithubActivity}
        activityToEdit={activityToEdit}
      />

      <LogHoursModal
        isOpen={isHoursModalOpen}
        onClose={() => setIsHoursModalOpen(false)}
        onSaved={fetchProjects}
        project={hoursProject}
      />

      <LogProgressModal
        isOpen={isProgressModalOpen}
        onClose={() => setIsProgressModalOpen(false)}
        onSaved={fetchProjects}
        project={progressProject}
      />

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