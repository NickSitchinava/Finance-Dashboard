import { supabase } from "../../lib/supabase";

export async function ensureProfile(userId: string, name: string) {
  const { data, error } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (error) throw new Error("Profile lookup failed");
  if (data) return;
  const { error: insertError } = await supabase.from("profiles").insert({ id: userId, full_name: name.trim() || null });
  if (insertError && insertError.code !== "23505") throw new Error("Profile setup failed");
}
