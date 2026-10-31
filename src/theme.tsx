import { createContext, useContext, useState, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";
const storageKey = "jubarte.theme";
const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
} | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, updateTheme] = useState<Theme>(() =>
    document.documentElement.dataset.theme === "dark" ? "dark" : "light",
  );

  function setTheme(next: Theme) {
    document.documentElement.dataset.theme = next;
    updateTheme(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // A troca continua funcionando quando o navegador bloqueia armazenamento.
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("Tema indisponível fora do ThemeProvider.");
  return context;
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const label = theme === "light" ? "Ativar tema escuro" : "Ativar tema claro";
  return (
    <button
      type="button"
      className="btn btn-outline theme-toggle"
      aria-label={label}
      title={label}
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
    >
      {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
    </button>
  );
}

export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  return (
    <fieldset className="theme-picker">
      <legend>Aparência</legend>
      <p>Escolha o tema. Sua preferência fica salva neste navegador.</p>
      <div className="theme-options">
        {(["light", "dark"] as const).map((value) => (
          <button
            key={value}
            type="button"
            className="btn btn-outline"
            aria-pressed={theme === value}
            onClick={() => setTheme(value)}
          >
            {value === "light" ? <Sun size={18} /> : <Moon size={18} />}
            {value === "light" ? "Claro" : "Escuro"}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
