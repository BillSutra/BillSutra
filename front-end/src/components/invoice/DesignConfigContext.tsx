"use client";

import type { CSSProperties, ReactNode } from "react";
import { createContext, useContext } from "react";
import type { SectionKey } from "@/types/invoice-template";

export type SectionStyleConfig = {
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  fontSize: number;
  padding: number;
  margin: number;
  borderRadius: number;
  width: "contained" | "full";
  backgroundImage?: string;
};

export type DesignConfig = Record<SectionKey, SectionStyleConfig>;

export const DEFAULT_DESIGN_CONFIG: DesignConfig = {
  header: {
    backgroundColor: "#ffffff",
    textColor: "#334155",
    fontFamily: "var(--font-geist-sans)",
    fontSize: 14,
    padding: 20,
    margin: 0,
    borderRadius: 16,
    width: "full",
    backgroundImage: "",
  },
  company_details: {
    backgroundColor: "#ffffff",
    textColor: "#334155",
    fontFamily: "var(--font-geist-sans)",
    fontSize: 14,
    padding: 20,
    margin: 0,
    borderRadius: 16,
    width: "full",
    backgroundImage: "",
  },
  client_details: {
    backgroundColor: "#ffffff",
    textColor: "#334155",
    fontFamily: "var(--font-geist-sans)",
    fontSize: 14,
    padding: 20,
    margin: 0,
    borderRadius: 16,
    width: "full",
    backgroundImage: "",
  },
  items: {
    backgroundColor: "#ffffff",
    textColor: "#334155",
    fontFamily: "var(--font-geist-sans)",
    fontSize: 14,
    padding: 20,
    margin: 0,
    borderRadius: 16,
    width: "full",
    backgroundImage: "",
  },
  service_items: {
    backgroundColor: "#ffffff",
    textColor: "#334155",
    fontFamily: "var(--font-geist-sans)",
    fontSize: 14,
    padding: 20,
    margin: 0,
    borderRadius: 16,
    width: "full",
    backgroundImage: "",
  },
  tax: {
    backgroundColor: "#ffffff",
    textColor: "#334155",
    fontFamily: "var(--font-geist-sans)",
    fontSize: 14,
    padding: 20,
    margin: 0,
    borderRadius: 16,
    width: "full",
    backgroundImage: "",
  },
  discount: {
    backgroundColor: "#ffffff",
    textColor: "#334155",
    fontFamily: "var(--font-geist-sans)",
    fontSize: 14,
    padding: 20,
    margin: 0,
    borderRadius: 16,
    width: "full",
    backgroundImage: "",
  },
  payment_info: {
    backgroundColor: "#ffffff",
    textColor: "#334155",
    fontFamily: "var(--font-geist-sans)",
    fontSize: 14,
    padding: 20,
    margin: 0,
    borderRadius: 16,
    width: "full",
    backgroundImage: "",
  },
  notes: {
    backgroundColor: "#ffffff",
    textColor: "#334155",
    fontFamily: "var(--font-geist-sans)",
    fontSize: 14,
    padding: 20,
    margin: 0,
    borderRadius: 16,
    width: "full",
    backgroundImage: "",
  },
  footer: {
    backgroundColor: "#f8fafc",
    textColor: "#334155",
    fontFamily: "var(--font-geist-sans)",
    fontSize: 14,
    padding: 16,
    margin: 0,
    borderRadius: 16,
    width: "full",
    backgroundImage: "",
  },
};

export const createDesignConfig = (): DesignConfig => {
  const entries = Object.entries(DEFAULT_DESIGN_CONFIG).map(([key, value]) => [
    key,
    { ...value },
  ]);
  return Object.fromEntries(entries) as DesignConfig;
};

export const normalizeDesignConfig = (
  input?: Partial<DesignConfig> | null,
): DesignConfig => {
  const defaults = createDesignConfig();
  if (!input) return defaults;
  (Object.keys(defaults) as SectionKey[]).forEach((section) => {
    if (input[section]) {
      defaults[section] = {
        ...defaults[section],
        ...(input[section] as Partial<SectionStyleConfig>),
      };
    }
  });
  return defaults;
};

export const getDefaultSectionConfig = (section: SectionKey) => {
  return { ...DEFAULT_DESIGN_CONFIG[section] };
};

export type DesignConfigContextValue = {
  designConfig: DesignConfig;
  updateSection: (
    section: SectionKey,
    updates: Partial<SectionStyleConfig>,
  ) => void;
  resetSection: (section: SectionKey) => void;
  resetAll: () => void;
};

const DesignConfigContext = createContext<DesignConfigContextValue>({
  designConfig: DEFAULT_DESIGN_CONFIG,
  updateSection: () => {},
  resetSection: () => {},
  resetAll: () => {},
});

export const DesignConfigProvider = ({
  value,
  children,
}: {
  value: DesignConfigContextValue;
  children: ReactNode;
}) => {
  return (
    <DesignConfigContext.Provider value={value}>
      {children}
    </DesignConfigContext.Provider>
  );
};

export const useDesignConfig = () => useContext(DesignConfigContext);

export const useSectionStyles = (section: SectionKey) => {
  const { designConfig } = useDesignConfig();
  const config = designConfig[section] ?? DEFAULT_DESIGN_CONFIG[section];
  const widthStyles =
    config.width === "contained" ? { maxWidth: "720px" } : { width: "100%" };
  const marginStyles =
    config.width === "contained"
      ? {
          marginTop: config.margin,
          marginBottom: config.margin,
          marginLeft: "auto",
          marginRight: "auto",
        }
      : {
          marginTop: config.margin,
          marginRight: config.margin,
          marginBottom: config.margin,
          marginLeft: config.margin,
        };

  return {
    config,
    style: {
      backgroundColor: config.backgroundColor,
      color: config.textColor,
      fontFamily: config.fontFamily,
      fontSize: config.fontSize,
      padding: config.padding,
      borderRadius: config.borderRadius,
      backgroundImage: config.backgroundImage
        ? `url(${config.backgroundImage})`
        : undefined,
      backgroundSize: config.backgroundImage ? "cover" : undefined,
      backgroundPosition: config.backgroundImage ? "center" : undefined,
      backgroundRepeat: config.backgroundImage ? "no-repeat" : undefined,
      ...marginStyles,
      ...widthStyles,
    } as CSSProperties,
  };
};
