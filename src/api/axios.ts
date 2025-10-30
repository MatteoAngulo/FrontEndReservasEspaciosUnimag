// src/api/axios.ts
import axios from "axios";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) ?? "";

const api = axios.create({
  baseURL: API_BASE ? `${API_BASE}/api` : "/api",
  headers: { "Content-Type": "application/json" },
});

function clearAuthStorage() {
  try {
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
  } catch (e) {
    // noop
  }
  try {
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("authUser");
  } catch (e) {
    // noop
  }
}

/**
 * Limpia storage y redirige al login (si no estamos ya en /login).
 */
function clearAuthAndRedirectToLogin() {
  clearAuthStorage();
  if (typeof window !== "undefined" && window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

/**
 * Request interceptor: agrega token con formato Bearer, excepto en /auth/authentication
 */
api.interceptors.request.use((config) => {
  const token =
    localStorage.getItem("authToken") ?? sessionStorage.getItem("authToken");

  const url = (config.url ?? "").toString();
  const isAuthEndpoint =
    url.includes("/auth/authentication") || url.includes("/authentication");

  if (token && config.headers && !isAuthEndpoint) {
    // Aseguramos que el formato sea Authorization: Bearer <token>
    (config.headers as any).Authorization = `Bearer ${token.trim()}`;
  }

  return config;
});

/**
 * Response interceptor: maneja 401/403 y errores de conexión.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;

    // Token inválido/expirado o no autorizado: limpiar + redirigir al login
    if (status === 401 || status === 403) {
      clearAuthAndRedirectToLogin();
    } else if (!error?.response) {
      // No hay respuesta del servidor (Network / CORS / server down)
      clearAuthStorage();
    }

    return Promise.reject(error);
  }
);

export default api;


// // src/api/axios.ts
// import axios from "axios";

// const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) ?? "";

// const api = axios.create({
//   baseURL: API_BASE ? `${API_BASE}/api` : "/api",
//   headers: { "Content-Type": "application/json" },
// });

// function clearAuthStorage() {
//   try {
//     localStorage.removeItem("authToken");
//     localStorage.removeItem("authUser");
//   } catch (e) {
//     // noop
//   }
//   try {
//     sessionStorage.removeItem("authToken");
//     sessionStorage.removeItem("authUser");
//   } catch (e) {
//     // noop
//   }
// }

// /**
//  * Limpia storage y redirige al login (si no estamos ya en /login).
//  */
// function clearAuthAndRedirectToLogin() {
//   clearAuthStorage();
//   if (typeof window !== "undefined" && window.location.pathname !== "/login") {
//     window.location.href = "/login";
//   }
// }

// /**
//  * Request interceptor: evita agregar Authorization en el endpoint de login
//  */


// api.interceptors.request.use((config) => {
//   const token = localStorage.getItem("authToken") ?? sessionStorage.getItem("authToken");
//   const url = (config.url ?? "").toString();
//   const isAuthEndpoint = url.includes("/auth/authentication") || url.includes("/authentication");

//   if (token && config.headers && !isAuthEndpoint) {
//     // asignación simple para evitar errores de typing estrictos
//     (config.headers as any).Authorization = `Bearer ${token}`;
//   }

//   return config;
// });

// /**
//  * Response interceptor: maneja 401/403 y errores de conexión.
//  */
// api.interceptors.response.use(
//   (response) => response,
//   (error) => {
//     const status = error?.response?.status;

//     // Token inválido/expirado o no autorizado: limpiar + redirigir al login
//     if (status === 401 || status === 403) {
//       clearAuthAndRedirectToLogin();
//     } else if (!error?.response) {
//       // No hay respuesta del servidor (Network / CORS / server down).
//       // Limpiamos storage para evitar enviar token inválidos luego,
//       // pero no forzamos redirect automático — así el usuario puede intentar reconectar.
//       clearAuthStorage();
//     }

//     return Promise.reject(error);
//   }
// );

// export default api;
