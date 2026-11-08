import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "./AuthProvider";

interface ProfileContextType {
  avatarUrl: string;
  fullName: string;
  loading: boolean;
  setAvatarUrl: (url: string) => void;
  setFullName: (name: string) => void;
}

const ProfileContext = createContext<ProfileContextType>({
  avatarUrl: "",
  fullName: "",
  loading: true,
  setAvatarUrl: () => {},
  setFullName: () => {},
});

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState("");
  const [fullName, setFullName] = useState("");
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const loading = authLoading || Boolean(user && loadedUserId !== user.id);

  useEffect(() => {
    let active = true;
    async function fetchProfile() {
      if (!user) {
        setLoadedUserId(null);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url, full_name")
        .eq("id", user.id)
        .single();
      if (!active) return;
      if (data) {
        setAvatarUrl(data.avatar_url || "");
        setFullName(data.full_name || "");
      } else {
        setAvatarUrl("");
        setFullName("");
      }
      setLoadedUserId(user.id);
    }
    void fetchProfile();
    return () => { active = false; };
  }, [user]);

  return (
    <ProfileContext.Provider value={{ avatarUrl, fullName, loading, setAvatarUrl, setFullName }}>
      {children}
    </ProfileContext.Provider>
  );
}

export const useProfile = () => useContext(ProfileContext);
