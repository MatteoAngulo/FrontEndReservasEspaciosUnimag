import React, { useState, type JSX } from "react";
import styles from "./Login.module.css";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import api from "../../../api/axios";

/**
 * Según tu backend AuthController -> LoginResponseDTO(jwt, rolEnum, idEstudiante)
 * Tipamos esa respuesta aquí.
 */
interface LoginResponse {
  // token generado por JwtUtil.generateToken(...)
  token?: string;
  // por si el nombre cambia en el futuro
  jwt?: string;
  accessToken?: string;

  // rol que viene del usuario -> rol.getRolEnum()
  rolEnum?: string;
  role?: string;

  // idEstudiante viene como Long en el backend; lo tratamos como number o null
  idEstudiante?: number | null;

  // posible mensaje de error o info
  message?: string;
}

export default function Login(): JSX.Element {
  const { setAuth } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // REGEX simple pero efectivo para validar email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const validate = (): string | null => {
    if (!email.trim() || !password) {
      return "Por favor completa todos los campos.";
    }
    if (!emailRegex.test(email.trim())) {
      return "Por favor ingresa un correo institucional válido.";
    }

    // Backend tiene @Size(min = 6) -> requerimos al menos 6 caracteres.
    if (password.length < 6) {
      return "La contraseña debe tener al menos 6 caracteres.";
    }

    return null;
  };

  const extractErrorMessage = (err: any): string => {
    // axios error usual: err.response?.data puede ser objeto, string o HTML
    const resp = err?.response?.data;

    // si backend devuelve JSON con { message: "..." }
    if (resp && typeof resp === "object" && resp.message) {
      // return String(resp.message);
      return "Correo o Contraseña INCORRECTA o No Está Registrado... Verifique e Intente nuevamente";
    }

    // si el backend devolvió un string plano (p.ej. "Invalid username or password")
    if (resp && typeof resp === "string") {
      // a veces Spring devuelve HTML; limpiamos tags si vienen
      const stripped = resp.replace(/<[^>]*>/g, "").trim();
      if (stripped) return stripped;
    }

    // otros intentos: axios error.message o código HTTP
    if (err?.response?.status) {
      return "Correo o Contraseña INCORRECTA o No Está Registrado... Verifique e Intente nuevamente";
      // ME FALTA EL MANEJO DE ERRORES
      // return `Error ${err.response.status}: ${
      //   err.response.statusText || "error"
      // }${err?.response?.data ? " - " + JSON.stringify(err.response.data) : ""}`;
    }

    return err?.message ?? "Error de conexión. Intenta nuevamente.";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const clientErr = validate();
    if (clientErr) {
      setError(clientErr);
      return;
    }

    setLoading(true);
    try {
      const res = await api.post<LoginResponse>("/auth/authentication", {
        correo: email.trim(),
        contrasena: password,
      });

      const data = res.data ?? ({} as LoginResponse);
      const token = data.token ?? data.jwt ?? data.accessToken ?? null;
      const role = data.rolEnum ?? data.role ?? null;

      let idEstudiante: number | null = null;
      if (typeof data.idEstudiante === "number" && data.idEstudiante > 0) {
        idEstudiante = data.idEstudiante;
      }

      if (!token) {
        setError("Login exitoso pero no se recibió token.");
        setLoading(false);
        return;
      }

      // Traer nombre del estudiante si existe id
      let nombre: string | null = null;
      if (idEstudiante) {
        try {
          const r = await api.get<{ idEstudiante: number; nombre: string }>(
            `/estudiantes/${idEstudiante}`
          );
          nombre = r.data?.nombre ?? null;
        } catch {
          // no interrumpe el login
        }
      }

      const user = { correo: email.trim(), role, idEstudiante, nombre };
      setAuth(token, user, remember);
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`d-flex align-items-center justify-content-center ${styles.page}`}
    >
      <div className={styles.overlay} />
      <div className={`card ${styles.loginContainer}`}>
        <div className="card-body text-center">
          <div className={styles.logoText}>Universidad del Magdalena</div>
          <div className={styles.logo} aria-hidden="true" />
          <h1 className="h5 mb-2">
            Bienvenido a
            <br />
            Reservas Unimagdalena
          </h1>
          <p className="text-muted mb-3">Ingresa con tu cuenta institucional</p>

          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-3 text-start">
              <label htmlFor="email" className="form-label">
                Correo institucional
              </label>
              <input
                id="email"
                type="email"
                className="form-control"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
            </div>

            <div className="mb-2 text-start">
              <label htmlFor="password" className="form-label">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <a href="#" className="small d-block mt-1">
                Olvidé contraseña
              </a>
            </div>

            <div className="form-check mb-3 text-start">
              <input
                id="remember"
                className="form-check-input"
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <label htmlFor="remember" className="form-check-label">
                Recordar
              </label>
            </div>

            <button
              className="btn btn-primary w-100"
              type="submit"
              disabled={loading}
            >
              {loading ? "Ingresando..." : "Ingresar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
