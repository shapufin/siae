import { createContext, useContext, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "./AuthContext";
import type { SiteSettings } from "../types";

const DEFAULT_SETTINGS: SiteSettings = {
  brand_name: "Omni Calendar",
  client_role_label: "Client",
  consultant_role_label: "Consultant",
  email_backend: "smtp",
  postfix_host: "host.docker.internal",
  postfix_port: 25,
  client_email: "",
  email_template_enabled: false,
  email_template_subject: "",
  email_template_body: "",
  announcement_enabled: false,
  announcement_text: "",
  announcement_color: "red",
};

const SiteSettingsContext = createContext<SiteSettings>(DEFAULT_SETTINGS);

export function SiteSettingsProvider({ children }: { children: React.ReactNode }) {
  const { data } = useQuery<SiteSettings>({
    queryKey: ["site-settings-public"],
    queryFn: async () => {
      const res = await api.get("/settings/public/");
      return res.data;
    },
    staleTime: 0,
    retry: 1,
  });

  const value = data ?? DEFAULT_SETTINGS;

  useEffect(() => {
    if (value.brand_name) {
      document.title = value.brand_name;
    }
  }, [value.brand_name]);

  return (
    <SiteSettingsContext.Provider value={value}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

export function useSiteSettings() {
  return useContext(SiteSettingsContext);
}
