import { supabase } from './supabase';

export type GoalStatus = 'not_started' | 'in_progress' | 'completed';
export type GoalPriority = 'low' | 'medium' | 'high';
export type GoalStep = { id: string; goal_id: string; user_id: string; kind: 'checklist' | 'subgoal'; title: string; description: string; target_date: string | null; completed: boolean; sort_order: number };
export type Goal = {
  id: string; user_id: string; title: string; description: string; notes: string | null;
  priority: GoalPriority; horizon: 'short' | 'long'; start_date: string | null; target_date: string | null;
  status: GoalStatus; progress_method: 'manual' | 'checklist' | 'subgoals'; percent_complete: number;
  completed_at: string | null; created_at: string; updated_at: string; sort_order: number;
  reference_links: string[]; recurrence: 'daily' | 'weekdays' | 'weekly' | 'monthly' | null;
  recurrence_weekdays: number[] | null; reminder_time: string | null; time_zone: string | null;
  goal_steps?: GoalStep[];
};
export type GoalOccurrence = { id: string; goal_id: string; user_id: string; scheduled_date: string; due_at: string; status: 'pending' | 'completed' | 'missed'; resolved_at: string | null };
export type ProgressEvent = { id: string; goal_id: string; progress: number; recorded_at: string };

export const todayLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
export const goalProgress = (goal: Goal) => {
  if (goal.status === 'completed') return 100;
  if (goal.progress_method === 'manual') return Number(goal.percent_complete) || 0;
  const kind = goal.progress_method === 'checklist' ? 'checklist' : 'subgoal';
  const steps = (goal.goal_steps || []).filter(step => step.kind === kind);
  return steps.length ? Math.round(100 * steps.filter(step => step.completed).length / steps.length) : 0;
};
export const isOverdue = (goal: Goal) => !goal.recurrence && goal.status !== 'completed' && !!goal.target_date && goal.target_date < todayLocal();

export async function loadGoals(userId: string) {
  const [goals, occurrences, events] = await Promise.all([
    supabase.from('goals').select('*,goal_steps(*)').eq('user_id',userId).order('sort_order').order('created_at',{ascending:false}),
    supabase.from('goal_occurrences').select('*').eq('user_id',userId).order('due_at',{ascending:false}).limit(1000),
    supabase.from('goal_progress_events').select('id,goal_id,progress,recorded_at').eq('user_id',userId).order('recorded_at',{ascending:true}).limit(1000),
  ]);
  if (goals.error) throw goals.error;
  if (occurrences.error) throw occurrences.error;
  if (events.error) throw events.error;
  return { goals: (goals.data || []) as Goal[], occurrences: (occurrences.data || []) as GoalOccurrence[], events: (events.data || []) as ProgressEvent[] };
}

export async function recordProgress(goal: Goal, progress: number) {
  const { error } = await supabase.from('goal_progress_events').insert({ goal_id: goal.id, user_id: goal.user_id, progress });
  if (error) throw error;
}

export function currentStreak(goalId: string, occurrences: GoalOccurrence[]) {
  const rows = occurrences.filter(o => o.goal_id === goalId).sort((a,b) => b.scheduled_date.localeCompare(a.scheduled_date));
  let streak = 0;
  for (const row of rows) {
    if (row.status === 'pending' && row.due_at > new Date().toISOString()) continue;
    if (row.status !== 'completed') break;
    streak++;
  }
  return streak;
}
