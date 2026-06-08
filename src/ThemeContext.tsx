import React, { createContext, useContext, useState, useEffect } from "react";

export type ThemeMode = "Midnight" | "High-Contrast Blueprint";

interface ThemeContextType {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem("pog2_theme");
    return (saved as ThemeMode) || "Midnight";
  });

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    localStorage.setItem("pog2_theme", newTheme);
  };

  const toggleTheme = () => {
    setTheme(theme === "Midnight" ? "High-Contrast Blueprint" : "Midnight");
  };

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "High-Contrast Blueprint") {
      root.classList.add("theme-blueprint");
      document.body.style.backgroundColor = "#020b1e";
    } else {
      root.classList.remove("theme-blueprint");
      document.body.style.backgroundColor = "#0D0F12";
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
