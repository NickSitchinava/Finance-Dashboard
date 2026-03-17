import { useState, useEffect } from "react";
import StatCard from "../components/ui/StatCard";
import MilestoneTimeline from "../components/ui/MilestoneTimeline";
import GoalCard from "../components/ui/GoalCard";
import AddGoalModal from "../components/ui/AddGoalModal";
import AddMilestoneModal from "../components/ui/AddMilestoneModal";
import ConfirmModal from "../components/ui/ConfirmModal";
import { supabase } from "../lib/supabase";
import { useAuth } from "../components/auth/AuthProvider";

export default function GoalsPage() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);

  const [goalToEdit, setGoalToEdit] = useState<any>(null);
  const [milestoneToEdit, setMilestoneToEdit] = useState<any>(null);
  const [itemToDelete, setItemToDelete] = useState<{
    id: string;
    type: "goal" | "milestone";
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  async function fetchGoalsAndMilestones() {
    if (!user) return;
    setLoading(true);

    const [{ data: goalsData }, { data: milestonesData }] = await Promise.all([
      supabase.from("goals").select("*").order("target_date", { ascending: true }),
      supabase.from("milestones").select("*").order("target_date", { ascending: true }),
    ]);

    if (goalsData) {
      setGoals(goalsData.map((d) => ({
        ...d,
        targetDate: d.target_date,
        percentComplete: d.percent_complete,
      })));
    }

    if (milestonesData) setMilestones(milestonesData);
    setLoading(false);
  }

  async function handleDeleteConfirm() {
    if (!itemToDelete) return;
    setIsDeleting(true);
    const table = itemToDelete.type === "goal" ? "goals" : "milestones";
    await supabase.from(table).delete().eq("id", itemToDelete.id);
    setIsDeleting(false);
    setItemToDelete(null);
    fetchGoalsAndMilestones();
  }

  function openEditGoal(g: any) { setGoalToEdit(g); setIsGoalModalOpen(true); }
  function openAddGoal() { setGoalToEdit(null); setIsGoalModalOpen(true); }
  function openEditMilestone(m: any) { setMilestoneToEdit(m); setIsMilestoneModalOpen(true); }
  function openAddMilestone() { setMilestoneToEdit(null); setIsMilestoneModalOpen(true); }

  useEffect(() => { fetchGoalsAndMilestones(); }, [user]);

  const activeGoals = goals.filter((g) => g.percentComplete < 100);
  const completedGoals = goals.filter((g) => g.percentComplete === 100);

  const liveStats = [
    { label: "Total Goals", value: goals.length.toString() },
    { label: "Completed", value: completedGoals.length.toString() },
    { label: "In Progress", value: activeGoals.length.toString() },
  ];

  const goalCardProps = (goal: any) => ({
    key: goal.id,
    goal,
    onEdit: openEditGoal,
    onDelete: (g: any) => g.id && setItemToDelete({ id: g.id, type: "goal" as const }),
    onRefresh: fetchGoalsAndMilestones,
  });

  return (
    <div className="page">
      <div className="page__toolbar">
        <button className="btn btn--outline" onClick={openAddMilestone}>
          + New Milestone
        </button>
        <button className="btn btn--primary" onClick={openAddGoal}>
          + New Goal
        </button>
      </div>

      <div className="page__row page__row--3">
        {liveStats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="page__row page__row--full">
        <MilestoneTimeline
          milestones={milestones.map((m) => ({
            ...m,
            date: m.target_date
              ? new Date(m.target_date).toLocaleDateString([], { month: "short", year: "numeric" })
              : "No date",
          }))}
          onEdit={openEditMilestone}
          onDelete={(m) => setItemToDelete({ id: m.id, type: "milestone" })}
        />
      </div>

      {/* Active Goals */}
      {!loading && activeGoals.length > 0 && (
        <>
          <div className="goals-section-header">
            <span className="goals-section-header__title">In Progress</span>
            <span className="goals-section-header__count">{activeGoals.length}</span>
          </div>
          <div className="page__row page__row--3">
            {activeGoals.map((goal) => (
              <GoalCard {...goalCardProps(goal)} />
            ))}
          </div>
        </>
      )}

      {loading && <div className="page-loading">Loading goals...</div>}

      {!loading && goals.length === 0 && (
        <div className="page-loading">No goals yet. Add one above!</div>
      )}

      {/* Completed Goals */}
      {!loading && completedGoals.length > 0 && (
        <>
          <div className="goals-section-divider" />
          <div className="goals-section-header goals-section-header--completed">
            <span className="goals-section-header__title">Completed</span>
            <span className="goals-section-header__count goals-section-header__count--completed">
              {completedGoals.length}
            </span>
          </div>
          <div className="page__row page__row--3">
            {completedGoals.map((goal) => (
              <GoalCard {...goalCardProps(goal)} />
            ))}
          </div>
        </>
      )}

      <AddGoalModal
        isOpen={isGoalModalOpen}
        onClose={() => setIsGoalModalOpen(false)}
        onGoalAdded={fetchGoalsAndMilestones}
        goalToEdit={goalToEdit}
      />
      <AddMilestoneModal
        isOpen={isMilestoneModalOpen}
        onClose={() => setIsMilestoneModalOpen(false)}
        onMilestoneAdded={fetchGoalsAndMilestones}
        milestoneToEdit={milestoneToEdit}
      />
      <ConfirmModal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        title={itemToDelete?.type === "goal" ? "Delete Goal" : "Delete Milestone"}
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