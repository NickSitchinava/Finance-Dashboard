export function useGitHub(): boolean {
  try {
    const saved = localStorage.getItem("user_preferences");
    if (saved) {
      const prefs = JSON.parse(saved);
      return prefs.showGitHub !== undefined ? prefs.showGitHub : true;
    }
  } catch {
    return true;
  }
  return true;
}