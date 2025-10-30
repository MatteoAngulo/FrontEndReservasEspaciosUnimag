import React, { createContext, useContext, useState, useEffect } from "react";
import api from "../../api/axios"; // para peticiones a tu backend

export interface User {
  correo: string;
  role?: string | null;
  idEstudiante?: number | null;
  nombre?: string | null; // nuevo campo
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  setAuth: (token: string, user: User, remember: boolean) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem("authToken") ?? sessionStorage.getItem("authToken");
  });

  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem("authUser") ?? sessionStorage.getItem("authUser");
    return raw ? JSON.parse(raw) : null;
  });

  const setAuth = (newToken: string, newUser: User, remember: boolean) => {
    setToken(newToken);
    setUser(newUser);
    const userJson = JSON.stringify(newUser);

    if (remember) {
      localStorage.setItem("authToken", newToken);
      localStorage.setItem("authUser", userJson);
      sessionStorage.removeItem("authToken");
      sessionStorage.removeItem("authUser");
    } else {
      sessionStorage.setItem("authToken", newToken);
      sessionStorage.setItem("authUser", userJson);
      localStorage.removeItem("authToken");
      localStorage.removeItem("authUser");
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = "/login";
  };

  // Si al recargar hay token y no tenemos nombre, tratamos de completarlo
  useEffect(() => {
    (async () => {
      if (!token || !user) return;
      if (user.nombre) return;

      const id = user.idEstudiante;
      if (!id || id <= 0) return;

      try {
        const res = await api.get<{ idEstudiante: number; nombre: string }>(`/estudiantes/${id}`);
        const nombre = res.data?.nombre ?? null;

        if (nombre) {
          const updated = { ...user, nombre };
          setUser(updated);

          if (localStorage.getItem("authToken") === token) {
            localStorage.setItem("authUser", JSON.stringify(updated));
          } else {
            sessionStorage.setItem("authUser", JSON.stringify(updated));
          }
        }
      } catch {
        // si falla, no pasa nada; se queda con correo
      }
    })();
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, setAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
};

