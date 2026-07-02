import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "../api/client";
import { storage } from "./storage";
import { clearPushToken, registerForPushNotifications } from "../push/register";
import type { NamedTemplate } from "../api/metadata";

export interface Me {
  userId: string;
  role: "admin" | "user";
  sportsbetUsername?: string;
  talentId?: string;
  talentName?: string;
  talentInitials?: string;
  /** Admin-authored named metadata templates the talent picks from at submit. */
  metadataTemplates?: NamedTemplate[];
}

interface AuthValue {
  me: Me | null;
  loading: boolean;
  signUp: (sportsbetUsername: string, signupToken: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const boot = async () => {
      const access = await storage.getAccess();
      if (!access) {
        setLoading(false);
        return;
      }
      try {
        const user = await api<Me>("/me");
        setMe(user);
        void registerForPushNotifications();
      } catch {
        await storage.clear();
      } finally {
        setLoading(false);
      }
    };
    void boot();
  }, []);

  const signUp = async (sportsbetUsername: string, signupToken: string) => {
    const data = await api<{
      accessToken: string;
      refreshToken: string;
      user: Me;
    }>("/auth/signup", {
      method: "POST",
      body: { sportsbetUsername, signupToken },
      auth: false,
    });
    await storage.set(data.accessToken, data.refreshToken);
    setMe(data.user);
    void registerForPushNotifications();
  };

  const signOut = async () => {
    await clearPushToken();
    await storage.clear();
    setMe(null);
  };

  const value = useMemo<AuthValue>(
    () => ({ me, loading, signUp, signOut }),
    [me, loading]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
};
