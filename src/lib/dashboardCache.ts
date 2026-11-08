// Short lived, user scoped snapshots let revisited pages render immediately.
// Every request still revalidates in the background when its page mounts.
const MAX_AGE_MS = 15 * 60 * 1000;
const MAX_SNAPSHOTS = 150;
const snapshots = new Map<string, { data: unknown; savedAt: number }>();

export function dashboardSnapshot<T>(key: string): T | null {
  const entry = snapshots.get(key);
  if (!entry) return null;
  if (Date.now() - entry.savedAt > MAX_AGE_MS) return null;
  return entry.data as T;
}

export function saveDashboardSnapshot<T>(key: string, data: T): void {
  if (!key) return;
  snapshots.delete(key);
  snapshots.set(key, { data, savedAt: Date.now() });
  while (snapshots.size > MAX_SNAPSHOTS) snapshots.delete(snapshots.keys().next().value!);
}

export function clearDashboardSnapshots(): void {
  snapshots.clear();
}
