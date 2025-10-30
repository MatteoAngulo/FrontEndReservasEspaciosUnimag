import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "../../../api/axios";
import Header from "../../Header/Header";
import styles from "./FacilityDetail.module.css";
import type { JSX } from "react";
import { useAuth } from "../../contexts/AuthContext";

/**
 * DTO que devuelve el backend (EspacioDTOResponse)
 * Long id,
 * String nombre,
 * String tipo,
 * String restricciones,
 * Long idSede,
 * Boolean disponible
 */
type EspacioDetail = {
  id: number;
  nombre: string;
  tipo?: string | null;
  restricciones?: string | null;
  idSede?: number | null;
  disponible?: boolean | null;
};

/** Tipo que devuelve /api/horarios-espacios/por-espacio/{id} */
type HorarioEspacio = {
  idHorarioEspacio: number;
  idEspacio: number;
  dia: string; // e.g. "MONDAY"
  horaInicio: string; // "08:00:00" o "08:00"
  horaFin: string;
};

type ReservaEstDtoRequest = {
  idHorarioEspacio: number;
  fecha: string; // "YYYY-MM-DD"
  motivo: string;
};

type ReservaEstDtoResponse = {
  idReserva: number;
  idHorarioEspacio: number;
  fecha: string;
  motivo: string;
};

// helper: comprobar que la fecha ISO (YYYY-MM-DD) sea estrictamente FUTURA (no hoy)
function isStrictlyFuture(isoDate?: string) {
  if (!isoDate) return false;
  const now = new Date();
  const localToday = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  const todayStr = localToday.toISOString().slice(0, 10); // YYYY-MM-DD
  return isoDate > todayStr; // string compare works for ISO dates
}

// Opcional: si quieres evitar que el usuario pueda seleccionar hoy en el <input type="date">,
// usa minSelectableDate = tomorrow; sustituye tu minDate actual por esta variable en el input.
const minSelectableDate = (() => {
  const now = new Date();
  now.setDate(now.getDate() + 1); // tomorrow
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
})();

export default function FacilityDetail(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [espacio, setEspacio] = useState<EspacioDetail | null>(null);
  const [sedeName, setSedeName] = useState<string>("Sede desconocida");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [horarios, setHorarios] = useState<HorarioEspacio[]>([]);
  const [availableHorarios, setAvailableHorarios] = useState<HorarioEspacio[]>(
    []
  );
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [period, setPeriod] = useState<"morning" | "afternoon" | "night">(
    "afternoon"
  );

  // fecha escogida por el usuario para consultar disponibilidad y reservar (YYYY-MM-DD)
  const [fechaReserva, setFechaReserva] = useState<string>("");

  const [minDate] = useState(() => {
    const now = new Date();
    // compensar offset para obtener la fecha local de forma fiable en YYYY-MM-DD
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10); // "YYYY-MM-DD"
  });

  // motivo de la reserva
  const [motivoReserva, setMotivoReserva] = useState<string>("");

  // límite opcional para el motivo (cambia si quieres otro)
  const MAX_REASON = 300;

  // franjas ejemplo (sólo UI; los horarios reales vienen de la API de horarios-espacios)
  const SLOTS = {
    morning: ["08:00", "09:00", "10:00", "11:00"],
    afternoon: ["14:00", "15:00", "16:00", "17:00"],
    night: ["18:00", "19:00", "20:00", "21:00"],
  } as const;

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // 1) obtener espacio
        const res = await api.get<EspacioDetail>(`/espacios/${id}`);
        const e = res.data;
        setEspacio(e);

        // 2) obtener nombre de sede si idSede presente
        if (e?.idSede) {
          try {
            const r = await api.get<{ id: number; name: string }>(
              `/sedes/${e.idSede}`
            );
            setSedeName(r.data?.name ?? `Sede ${e.idSede}`);
          } catch (err) {
            console.warn("No se pudo obtener sede:", err);
            setSedeName(`Sede ${e.idSede}`);
          }
        } else {
          setSedeName("Sede desconocida");
        }

        // 3) obtener horarios para el espacio (lo hacemos después de tener el espacio)
        try {
          const hres = await api.get<HorarioEspacio[]>(
            `/horarios-espacios/por-espacio/${e.id}`
          );
          setHorarios(hres.data ?? []);
        } catch (herr) {
          console.warn("No se pudieron obtener horarios del espacio:", herr);
          setHorarios([]);
        }
      } catch (err) {
        console.error("Error al obtener espacio:", err);
        setError("No se pudo cargar la información del espacio.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  /**
   * Cuando cambia la fecha seleccionada, volvemos a consultar reservas para
   * los horarios que correspondan al día de la semana de esa fecha.
   * Los horarios reservados se excluyen de `availableHorarios`.
   */
  useEffect(() => {
    if (!fechaReserva || horarios.length === 0) {
      setAvailableHorarios([]);
      return;
    }

    let mounted = true;

    const fetchAvailability = async () => {
      setCheckingAvailability(true);
      try {
        // convertir la fecha a nombre DayOfWeek (coincidir con DayOfWeek Java: MONDAY, ...)
        const d = new Date(fechaReserva + "T00:00:00"); // asegurar parsing como UTC-local
        const idx = d.getDay(); // 0 dom, 1 lun ... 6 sab
        const JS_DAY_TO_DAYOFWEEK = [
          "SUNDAY",
          "MONDAY",
          "TUESDAY",
          "WEDNESDAY",
          "THURSDAY",
          "FRIDAY",
          "SATURDAY",
        ];
        const dayName = JS_DAY_TO_DAYOFWEEK[idx];

        // filtrar horarios que pertenecen a ese día
        const horariosDelDia = horarios.filter((h) => {
          // normalizamos para evitar mayúsculas/minúsculas
          return String(h.dia).toUpperCase() === dayName;
        });

        // por cada horarioDelDia, consultar si existe reserva para fecha + idHorarioEspacio
        // si la API devuelve 404/204 o no devuelve body -> asumimos disponible
        const checks = await Promise.all(
          horariosDelDia.map(async (h) => {
            try {
              const r = await api.get("/admin/reservas/por-horario-y-fecha", {
                params: {
                  fecha: fechaReserva,
                  idHorarioEspacio: h.idHorarioEspacio,
                },
              });
              // si r.status 200 y r.data existe => reservado
              const reservado = !!r.data; // si viene objeto -> reservado
              return { horario: h, reservado };
            } catch (err: any) {
              // si backend responde 404 o 204 -> no reservado
              const status = err?.response?.status;
              if (status === 404 || status === 204) {
                return { horario: h, reservado: false };
              }
              // en caso de otro error, lo logueamos y consideramos no reservado
              console.warn("Error comprobando reserva:", err);
              return { horario: h, reservado: false };
            }
          })
        );

        if (!mounted) return;

        // quedarnos sólo con los que NO están reservados
        const disponibles = checks
          .filter((c) => !c.reservado)
          .map((c) => c.horario);

        setAvailableHorarios(disponibles);
      } finally {
        if (mounted) setCheckingAvailability(false);
      }
    };

    fetchAvailability();

    return () => {
      mounted = false;
    };
  }, [fechaReserva, horarios]);

  const handleReserve = async (horario: HorarioEspacio) => {
    if (!espacio) return;

    // Validaciones UI
    if (!fechaReserva) {
      alert("Por favor selecciona una fecha antes de reservar.");
      return;
    }
    if (!isStrictlyFuture(fechaReserva)) {
      alert("La fecha debe ser una fecha futura (no puede ser hoy).");
      return;
    }
    const motivoTrim = (motivoReserva ?? "").trim();
    if (!motivoTrim || motivoTrim.length < 5) {
      alert("Por favor escribe un motivo de al menos 5 caracteres.");
      return;
    }
    if (motivoTrim.length > MAX_REASON) {
      alert(`El motivo es muy largo. Máximo ${MAX_REASON} caracteres.`);
      return;
    }

    // <-- Aquí usamos el id desde el contexto de auth (user) -->
    const studentId = user?.idEstudiante ?? null;
    if (!studentId || Number(studentId) <= 0) {
      alert(
        "No se pudo identificar tu usuario. Por favor inicia sesión de nuevo."
      );
      // opcional: navigate('/login');
      return;
    }

    // Label legible
    const label = `${formatDay(fechaReserva)} ${formatTime(
      horario.horaInicio
    )} - ${formatTime(horario.horaFin)}`;

    const ok = confirm(
      `Confirmar reserva:\n\nEspacio: ${espacio.nombre}\nFecha: ${fechaReserva}\nHorario: ${label}\nMotivo: ${motivoTrim}`
    );
    if (!ok) return;

    const payload: ReservaEstDtoRequest = {
      idHorarioEspacio: horario.idHorarioEspacio,
      fecha: fechaReserva,
      motivo: motivoTrim,
    };

    try {
      const res = await api.post<ReservaEstDtoResponse>(
        `/estudiantes/${studentId}/reservas`,
        payload
      );

      // actualizar UI
      setSelectedSlot(String(horario.idHorarioEspacio));
      setAvailableHorarios((prev) =>
        prev.filter((x) => x.idHorarioEspacio !== horario.idHorarioEspacio)
      );

      alert(
        `Reserva creada (id: ${res.data.idReserva}).\nFecha: ${res.data.fecha}`
      );
      // opcional: limpiar campos
      // setFechaReserva("");
      // setMotivoReserva("");
    } catch (err: any) {
      console.error("Error creando reserva:", err);
      // manejo 401 (token expirado) -> sugerencia: forzar logout si detectas 401
      const status = err?.response?.status;
      if (status === 401) {
        alert("Sesión expirada. Inicia sesión de nuevo.");
        // si quieres forzar logout: logout(); // necesitas traer logout desde useAuth
        return;
      }
      const msg =
        err?.response?.data?.message ??
        err?.response?.data ??
        err?.message ??
        "No se pudo completar la reserva.";
      alert(
        `Error al reservar: ${
          typeof msg === "string" ? msg : JSON.stringify(msg)
        }`
      );
    }
  };

  const handleReport = async () => {
    const text = prompt("Describe el problema que encontraste:");
    if (text && text.trim()) {
      // stub: enviar a endpoint de incidencias si tienes
      alert("Reporte enviado. Gracias.");
      console.log("Reporte:", text.trim());
    }
  };

  if (loading) {
    return <div className={styles.center}>Cargando información...</div>;
  }

  if (error || !espacio) {
    return (
      <div className={styles.center}>
        <p className={styles.error}>{error ?? "Espacio no encontrado."}</p>
        <button
          className={`btn btn-secondary ${styles.backButton}`}
          onClick={() => navigate(-1)}
        >
          ← Volver
        </button>
      </div>
    );
  }

  const imageUrl = getImageForTipo(espacio.tipo);

  return (
    <>
      <Header />
      <div className={styles.mainContent}>
        <aside className={styles.sidebar}>
          {imageUrl ? (
            // Vite sirve public/ desde la raíz: /assets/...
            <img
              src={imageUrl}
              alt={espacio.nombre}
              className={styles.facilityImage}
            />
          ) : (
            <div className={styles.placeholder}>🏟️</div>
          )}

          <button
            type="button"
            className={styles.reportBtn}
            onClick={handleReport}
          >
            reportar problema
          </button>

          <div className={styles.restrictions}>
            <h3>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
              Restricciones
            </h3>
            <p className={styles.restrictionsText}>
              {espacio.restricciones ?? "No hay restricciones registradas."}
            </p>
          </div>
        </aside>

        <section className={styles.facilityDetails}>
          <div className={styles.facilityHeader}>
            <svg
              className={styles.locationIcon}
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden
            >
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            </svg>

            <div className={styles.titleRow}>
              <h2 className={styles.title}>{espacio.nombre}</h2>
              <span
                className={
                  espacio.disponible
                    ? styles.badgeAvailable
                    : styles.badgeUnavailable
                }
              >
                {espacio.disponible ? "Disponible" : "No disponible"}
              </span>
            </div>

            <div className={styles.sedeInfo}>
              <strong>Sede:</strong> {sedeName}
            </div>
          </div>

          <div className={styles.facilitySpecs}>
            <div className={styles.specCard}>
              <p className={styles.specText}>
                {espacio.tipo ?? "Tipo no especificado"}
              </p>
              {espacio.restricciones && (
                <p className={styles.smallText}>({espacio.restricciones})</p>
              )}
            </div>
          </div>

          <div className={styles.scheduleSection}>
            <h3>Horarios de hoy</h3>

            <div className={styles.timeTabs} role="tablist">
              <button
                type="button"
                className={`${styles.timeTab} ${
                  period === "morning" ? styles.active : ""
                }`}
                onClick={() => setPeriod("morning")}
              >
                MAÑANA
              </button>
              <button
                type="button"
                className={`${styles.timeTab} ${
                  period === "afternoon" ? styles.active : ""
                }`}
                onClick={() => setPeriod("afternoon")}
              >
                TARDE
              </button>
              <button
                type="button"
                className={`${styles.timeTab} ${
                  period === "night" ? styles.active : ""
                }`}
                onClick={() => setPeriod("night")}
              >
                NOCHE
              </button>
            </div>

            <div className={styles.timeSlots}>
              {SLOTS[period].map((s) => (
                <div key={s} className={styles.timeSlot}>
                  {s}
                </div>
              ))}
            </div>
          </div>

          <div className={styles.availableSchedules}>
            <h3>Horarios Disponibles</h3>

            <div className="mb-3">
              <label htmlFor="fechaReserva" className="form-label">
                Selecciona una fecha:
              </label>
              <input
                id="fechaReserva"
                type="date"
                className="form-control"
                value={fechaReserva}
                min={minSelectableDate}
                onChange={(e) => {
                  const v = e.target.value; // formato YYYY-MM-DD
                  // si por alguna razón el usuario escribe manualmente una fecha < minSelectableDate, la rechazamos
                  if (v && v < minSelectableDate) {
                    // opcional: mostrar mensaje corto o simplemente forzar al minSelectableDate
                    alert("No puedes seleccionar una fecha anterior a hoy.");
                    setFechaReserva(minSelectableDate);
                  } else {
                    setFechaReserva(v);
                  }
                }}
              />
            </div>

            {checkingAvailability && (
              <p className={styles.checking}>Comprobando disponibilidad...</p>
            )}
            {!fechaReserva && (
              <p className={styles.helper}>
                Selecciona una fecha para ver horarios disponibles.
              </p>
            )}
            {fechaReserva &&
              !checkingAvailability &&
              availableHorarios.length === 0 && (
                <p className={styles.helper}>
                  No hay horarios disponibles para la fecha seleccionada.
                </p>
              )}

            {availableHorarios.map((h) => {
              const label = `${formatDay(fechaReserva)} ${formatTime(
                h.horaInicio
              )} - ${formatTime(h.horaFin)}`;
              return (
                <div key={h.idHorarioEspacio} className={styles.scheduleItem}>
                  <div className={styles.scheduleInfo}>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden
                      className={styles.clockIcon}
                    >
                      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" />
                      <path d="M12.5 7H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
                    </svg>
                    <span className={styles.scheduleTime}>{label}</span>
                  </div>

                  <div className={styles.scheduleDate}>{fechaReserva}</div>

                  <button
                    className={styles.reserveBtn}
                    type="button"
                    onClick={() => handleReserve(h)}
                    disabled={
                      selectedSlot === String(h.idHorarioEspacio) ||
                      !espacio.disponible ||
                      !fechaReserva ||
                      !isStrictlyFuture(fechaReserva) ||
                      motivoReserva.trim().length < 5 ||
                      !user?.idEstudiante
                    }
                    aria-disabled={
                      selectedSlot === String(h.idHorarioEspacio) ||
                      !espacio.disponible ||
                      !fechaReserva ||
                      !isStrictlyFuture(fechaReserva) ||
                      motivoReserva.trim().length < 5
                    }
                  >
                    {selectedSlot === String(h.idHorarioEspacio)
                      ? "Reservado"
                      : espacio.disponible
                      ? "Apartar"
                      : "No disponible"}
                  </button>
                </div>
              );
            })}
          </div>
          <div className="mb-3">
            <label htmlFor="motivoReserva" className="form-label">
              Motivo de la reserva{" "}
              <small className="text-muted">
                ({motivoReserva.length}/{MAX_REASON})
              </small>
            </label>
            <textarea
              id="motivoReserva"
              className="form-control"
              value={motivoReserva}
              onChange={(e) => {
                if (e.target.value.length <= MAX_REASON)
                  setMotivoReserva(e.target.value);
              }}
              placeholder="Escribe el motivo por el que reservas este espacio..."
              rows={3}
              maxLength={MAX_REASON}
              required
            />
            <div className="form-text">
              Explica brevemente por qué necesitas el espacio (máx. {MAX_REASON}{" "}
              caracteres).
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

/* Helper imagen según tipo: retorna ruta pública (assets en public/) */
export function getImageForTipo(tipo?: string | null): string {
  const defaultUrl = "/assets/default.png";

  if (!tipo) return defaultUrl;

  const t = (tipo ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase();

  const patterns: { keyword: string; url: string }[] = [
    { keyword: "SALONES_AUDIVISUALES", url: "/assets/salonAudivisual.png" },
    { keyword: "AUDITORIO", url: "/assets/auditorio.png" },
    { keyword: "CANCHA", url: "/assets/cancha.png" },
    { keyword: "CUBICUL", url: "/assets/cubiculo.png" }, // cubículo / cubiculos -> 'CUBICUL'
    { keyword: "SALONES", url: "/assets/salon.png" },
    { keyword: "ZONA", url: "/assets/zonaComun.png" },
  ];

  for (const { keyword, url } of patterns) {
    if (t.includes(keyword)) return url;
  }

  return defaultUrl;
}

/* small helpers */
function formatTime(t?: string) {
  if (!t) return "";
  // t puede venir como "08:00:00" o "08:00" -> devolver "08:00"
  return t.split(":").slice(0, 2).join(":");
}
function formatDay(isoDate?: string) {
  if (!isoDate) return "";
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
