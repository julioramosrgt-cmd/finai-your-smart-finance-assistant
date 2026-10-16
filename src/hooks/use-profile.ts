import { useEffect, useState } from "react";
import type { Profile } from "@/lib/db";

const PROFILE_KEY = "finai-profile";
const PROFILE_EVENT = "finai-profile-change";

export function getActiveProfile(): Profile {
  return localStorage.getItem(PROFILE_KEY) === "PJ" ? "PJ" : "PF";
}

export function setActiveProfile(profile: Profile) {
  localStorage.setItem(PROFILE_KEY, profile);
  window.dispatchEvent(new Event(PROFILE_EVENT));
}

export function useProfile() {
  const [profile, setProfile] = useState<Profile>(() => (typeof window === "undefined" ? "PF" : getActiveProfile()));
  useEffect(() => {
    const sync = () => setProfile(getActiveProfile());
    sync();
    window.addEventListener(PROFILE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(PROFILE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return profile;
}
