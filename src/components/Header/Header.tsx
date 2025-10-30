import { useAuth } from "../contexts/AuthContext";
import styles from "./Header.module.css";
import { useNavigate } from "react-router-dom";
import type { JSX } from "react";

export default function Header(): JSX.Element {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const displayName = user?.nombre
    ? user.nombre
    : user?.correo
    ? user.correo.split("@")[0]
    : "Invitado";

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <header className={styles.header}>
      <h1>Reservas unimagdalena</h1>

      <div className={styles.headerRight}>
        <span className={styles.greeting}>Hola {displayName}!</span>

        <div className={styles.headerIcons}>
          <button
            onClick={() => alert("Notificaciones")}
            className={styles.iconBtn}
            title="Notificaciones"
            aria-label="Notificaciones"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden
            >
              <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
            </svg>
          </button>

          <button
            onClick={handleLogout}
            className={styles.iconBtn}
            title="Perfil"
            aria-label="Perfil"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden
            >
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
