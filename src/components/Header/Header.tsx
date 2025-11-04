import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import styles from "./Header.module.css";
import type { JSX } from "react";

export default function Header(): JSX.Element {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const displayName = user?.nombre
    ? user.nombre
    : user?.correo
    ? user.correo.split("@")[0]
    : "Invitado";

  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // cerrar al hacer click fuera
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <header className={styles.header}>
      <h1 className={styles.logo}>Reservas unimagdalena</h1>

      <div className={styles.headerRight}>
        <span className={styles.greeting}>Hola {displayName}!</span>

        <div className={styles.headerIcons}>
          <button
            onClick={() => alert("Notificaciones")}
            className={styles.iconBtn}
            title="Notificaciones"
            aria-label="Notificaciones"
          >
            {/* bell svg */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
            </svg>
          </button>

          <div ref={menuRef} style={{ position: "relative" }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpen((s) => !s);
              }}
              className={styles.iconBtn}
              title="Perfil"
              aria-haspopup="true"
              aria-expanded={open}
              aria-label="Abrir menú de perfil"
            >
              {/* user svg */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            </button>

            {open && (
              <ul className={styles.profileMenu} role="menu" aria-label="Opciones de perfil">
                <li role="none">
                  <button
                    role="menuitem"
                    className="btn btn-link"
                    onClick={() => {
                      setOpen(false);
                      navigate("/perfil");
                    }}
                  >
                    Perfil
                  </button>
                </li>

                <li role="none">
                  <button
                    role="menuitem"
                    className="btn btn-link"
                    onClick={() => {
                      setOpen(false);
                      navigate("/mis-reservas");
                    }}
                  >
                    Mis Reservas
                  </button>
                </li>

                <li role="none">
                  <button
                    role="menuitem"
                    className="btn btn-link"
                    onClick={() => {
                      setOpen(false);
                      navigate("/dashboard");
                    }}
                  >
                    Dashboard
                  </button>
                </li>

                <li role="none">
                  <button
                    role="menuitem"
                    className="btn btn-link"
                    onClick={() => {
                      setOpen(false);
                      navigate("/reportes");
                    }}
                  >
                    Reportes de problemas
                  </button>
                </li>

                <li role="none">
                  <button
                    role="menuitem"
                    className="btn btn-link"
                    onClick={() => {
                      setOpen(false);
                      navigate("/notificaciones");
                    }}
                  >
                    Notificaciones
                  </button>
                </li>

                <li role="none">
                  <button
                    role="menuitem"
                    className="btn btn-link"
                    onClick={() => {
                      setOpen(false);
                      navigate("/configuracion");
                    }}
                  >
                    Configuración
                  </button>
                </li>

                <li><hr className="my-1" /></li>

                <li role="none">
                  <button
                    role="menuitem"
                    className="btn btn-link text-danger"
                    onClick={() => {
                      setOpen(false);
                      handleLogout();
                    }}
                  >
                    Salir
                  </button>
                </li>
              </ul>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

