import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Mode = "vendedor" | "cliente";

interface ModeValue {
  mode: Mode;
  setMode: (m: Mode) => void;
}

const ModeContext = createContext<ModeValue>({ mode: "vendedor", setMode: () => {} });

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(() =>
    localStorage.getItem("secretaria-mode") === "cliente" ? "cliente" : "vendedor",
  );
  useEffect(() => {
    localStorage.setItem("secretaria-mode", mode);
  }, [mode]);
  return <ModeContext.Provider value={{ mode, setMode }}>{children}</ModeContext.Provider>;
}

export function useMode() {
  return useContext(ModeContext);
}
