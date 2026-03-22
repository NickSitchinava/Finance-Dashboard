import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "./AuthProvider";

interface ProfileContextType {
  avatarUrl: string;
  fullName: string;
  setAvatarUrl: (url: string) => void;
  setFullName: (name: string) => void;
}

const ProfileContext = createContext<ProfileContextType>({
  avatarUrl: "",
  fullName: "",
  setAvatarUrl: () => {},
  setFullName: () => {},
});

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState("");
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    async function fetchProfile() {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url, full_name")
        .eq("id", user.id)
        .single();
      if (data) {
        setAvatarUrl(data.avatar_url || "");
        setFullName(data.full_name || "");
      }
    }
    fetchProfile();
  }, [user]);

  return (
    <ProfileContext.Provider value={{ avatarUrl, fullName, setAvatarUrl, setFullName }}>
      {children}
    </ProfileContext.Provider>
  );
}

export const useProfile = () => useContext(ProfileContext);