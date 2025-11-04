import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "../../../api/axios";
import Header from "../../Header/Header";
import styles from "./EditStudentReservation.module.css";
import type { JSX } from "react";
import { useAuth } from "../../contexts/AuthContext";


type EspacioDetail = {
  id: number;
  nombre: string;
  tipo?: string | null;
  restricciones?: string | null;
  idSede?: number | null;
  disponible?: boolean | null;
};

type HorarioEspacio = {
  idHorarioEspacio: number;
  idEspacio: number;
  dia: string;
  horaInicio: string;
  horaFin: string;
};

type ReservaEstDtoRequest = {
  idHorarioEspacio: number;
  fecha: string; // "YYYY-MM-DD"
  motivo: string;
};

type ReservaDtoResponse = {
  idReserva: number;
  idEstudiante: number;
  idHorarioEspacio: number;
  estadoReserva: string;
  fecha: string; // ISO yyyy-mm-dd
  motivo?: string | null;
};

type ReservaCheckResponse = {
  idReserva: number;
  estadoReserva: "PENDIENTE" | "APROBADO" | "RECHAZADO" | "CANCELADA";
  
};

// Helper: comprobar que la fecha ISO (YYYY-MM-DD) sea estrictamente FUTURA
function isStrictlyFuture(isoDate?: string) {
  if (!isoDate) return false;
  const now = new Date();
  const localToday = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  const todayStr = localToday.toISOString().slice(0, 10);
  return isoDate > todayStr;
}

// Fecha mínima seleccionable (mañana)
const minSelectableDate = (() => {
  const now = new Date();
  now.setDate(now.getDate() + 1); // tomorrow
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
})();

const MAX_REASON = 300; // Límite para el motivo

export default function EditStudentReservation(): JSX.Element {
  // 1. OBTENEMOS EL ID DE LA RESERVA de la URL
  const { idReserva } = useParams<{ idReserva: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const studentId = user?.idEstudiante;

  const [espacio, setEspacio] = useState<EspacioDetail | null>(null);
  const [sedeName, setSedeName] = useState<string>("Sede desconocida");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [horarios, setHorarios] = useState<HorarioEspacio[]>([]);
  const [availableHorarios, setAvailableHorarios] = useState<HorarioEspacio[]>(
    []
  );
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // Para deshabilitar botones al enviar

  // Estados del formulario (pre-poblados)
  const [fechaReserva, setFechaReserva] = useState<string>("");
  const [motivoReserva, setMotivoReserva] = useState<string>("");

  const [originalSlotId, setOriginalSlotId] = useState<number | null>(null);

  // 2. LÓGICA DE CARGA INICIAL
  useEffect(() => {
    if (!idReserva || !studentId) {
      if (!studentId) setError("Usuario no identificado.");
      if (!idReserva) setError("ID de reserva no encontrado.");
      setLoading(false);
      return;
    }

    const loadReservationAndFacility = async () => {
      setLoading(true);
      setError(null);
      try {
        // A) Obtener la reserva actual
        const res = await api.get<ReservaDtoResponse>(
          `/estudiantes/${studentId}/reservas/${idReserva}`
        );
        const reserva = res.data;

        // B) Pre-poblar el formulario
        setFechaReserva(reserva.fecha);
        setMotivoReserva(reserva.motivo ?? "");
        setOriginalSlotId(reserva.idHorarioEspacio);

        // C) Obtener el idEspacio (a través del horario)
        const resHorario = await api.get<HorarioEspacio>(
          `/horarios-espacios/${reserva.idHorarioEspacio}`
        );
        const idEspacio = resHorario.data.idEspacio;

        // D) Cargar el resto de la UI (lógica de FacilityDetail)
        const resEspacio = await api.get<EspacioDetail>(`/espacios/${idEspacio}`);
        const e = resEspacio.data;
        setEspacio(e);

        if (e?.idSede) {
          try {
            const r = await api.get<{ id: number; name: string }>(
              `/sedes/${e.idSede}`
            );
            setSedeName(r.data?.name ?? `Sede ${e.idSede}`);
          } catch (err) {
            setSedeName(`Sede ${e.idSede}`);
          }
        }

        const resHorarios = await api.get<HorarioEspacio[]>(
          `/horarios-espacios/por-espacio/${e.id}`
        );
        setHorarios(resHorarios.data ?? []);
      } catch (err: any) {
        console.error("Error al cargar datos para edición:", err);
        const msg =
          err?.response?.data?.message ??
          "No se pudo cargar la reserva para editar.";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    loadReservationAndFacility();
  }, [idReserva, studentId]);

  // 3. LÓGICA DE DISPONIBILIDAD 
  useEffect(() => {
    if (!fechaReserva || horarios.length === 0) {
      setAvailableHorarios([]);
      return;
    }

    let mounted = true;
    setCheckingAvailability(true);

    (async () => {
      try {
        const d = new Date(fechaReserva + "T00:00:00");
        const idx = d.getDay();
        const JS_DAY_TO_DAYOFWEEK = [
          "SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY",
          "THURSDAY", "FRIDAY", "SATURDAY",
        ];
        const dayName = JS_DAY_TO_DAYOFWEEK[idx];

        const horariosDelDia = horarios.filter(
          (h) => String(h.dia).toUpperCase() === dayName
        );

        const checks = await Promise.all(
          horariosDelDia.map(async (h) => {
            try {
              const r = await api.get<ReservaCheckResponse>(
                "/admin/reservas/por-horario-y-fecha",
                {
                  params: {
                    fecha: fechaReserva,
                    idHorarioEspacio: h.idHorarioEspacio,
                  },
                }
              );
              const reserva = r.data;
              if (!reserva) return { horario: h, reservado: false };

              if (reserva.idReserva === Number(idReserva)) {
                return { horario: h, reservado: false };
              }

              const estado = String(reserva.estadoReserva).toUpperCase();
              const estaReservado =
                estado === "PENDIENTE" || estado === "APROBADO";
              return { horario: h, reservado: estaReservado };
            } catch (err: any) {
              const status = err?.response?.status;
              if (status === 404 || status === 204) {
                return { horario: h, reservado: false };
              }
              return { horario: h, reservado: false };
            }
          })
        );

        if (!mounted) return;
        const disponibles = checks
          .filter((c) => !c.reservado)
          .map((c) => c.horario);
        setAvailableHorarios(disponibles);
      } finally {
        if (mounted) setCheckingAvailability(false);
      }
    })();

    return () => { (mounted = false) };
  }, [fechaReserva, horarios, idReserva]); // idReserva es dependencia clave

  // 4. LÓGICA DE ACTUALIZACIÓN 
  const handleUpdate = async (horario: HorarioEspacio) => {
    if (!espacio || !studentId || !idReserva) return;

    // Validaciones
    if (!isStrictlyFuture(fechaReserva)) {
      alert("La fecha debe ser una fecha futura (no puede ser hoy).");
      return;
    }
    const motivoTrim = motivoReserva.trim();
    if (motivoTrim.length < 5) {
      alert("El motivo debe tener al menos 5 caracteres.");
      return;
    }

    const label = `${formatDay(fechaReserva)} ${formatTime(
      horario.horaInicio
    )} - ${formatTime(horario.horaFin)}`;

    const ok = confirm(
      `Confirmar actualización:\n\nEspacio: ${espacio.nombre}\nNuevo Horario: ${label}\nMotivo: ${motivoTrim}`
    );
    if (!ok) return;

    const payload: ReservaEstDtoRequest = {
      idHorarioEspacio: horario.idHorarioEspacio,
      fecha: fechaReserva,
      motivo: motivoTrim,
    };

    setIsSubmitting(true);
    try {
      // Usamos PUT al endpoint de actualización
      await api.put(
        `/estudiantes/${studentId}/reservas/${idReserva}`,
        payload
      );

      alert("Reserva actualizada correctamente.");
      navigate("/mis-reservas"); // Volvemos a la lista
    } catch (err: any) {
      console.error("Error actualizando reserva:", err);
      const msg =
        err?.response?.data?.message ??
        err?.message ??
        "No se pudo completar la actualización.";
      alert(`Error: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- RENDER ---

  if (loading) {
    return <div className={styles.center}>Cargando reserva para editar...</div>;
  }

  if (error || !espacio) {
    return (
      <div className={styles.center}>
        <p className={styles.error}>{error ?? "No se encontró el espacio."}</p>
        <button
          className={`btn btn-secondary ${styles.backButton}`}
          onClick={() => navigate("/mis-reservas")} // Volver a "Mis Reservas"
        >
          ← Volver a Mis Reservas
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
          <img
            src={imageUrl}
            alt={espacio.nombre}
            className={styles.facilityImage}
          />
          <div className={styles.restrictions}>
            <h3>Restricciones</h3>
            <p className={styles.restrictionsText}>
              {espacio.restricciones ?? "No hay restricciones registradas."}
            </p>
          </div>
        </aside>

        <section className={styles.facilityDetails}>
          <div className={styles.facilityHeader}>
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

          <div className={styles.availableSchedules}>
            <h3>Editar Reserva</h3>
            <p className="text-muted">
              Selecciona una nueva fecha o un nuevo horario.
            </p>

            <div className="mb-3">
              <label htmlFor="fechaReserva" className="form-label">
                Selecciona la fecha:
              </label>
              <input
                id="fechaReserva"
                type="date"
                className="form-control"
                value={fechaReserva}
                min={minSelectableDate} // Usamos la validación de fecha futura
                onChange={(e) => {
                  const v = e.target.value;
                  if (v && v < minSelectableDate) {
                    setFechaReserva(minSelectableDate);
                  } else {
                    setFechaReserva(v);
                  }
                }}
              />
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
                rows={3}
                maxLength={MAX_REASON}
              />
            </div>

            <hr />
            <h4 className={styles.availableTitle}>
              Selecciona el nuevo horario:
            </h4>

            {checkingAvailability && (
              <p className={styles.checking}>Comprobando disponibilidad...</p>
            )}
            
            {/* Lista de botones de horario */}
            {availableHorarios.map((h) => {
              const label = `${formatDay(fechaReserva)} ${formatTime(
                h.horaInicio
              )} - ${formatTime(h.horaFin)}`;
              
              // Resaltamos el horario que está seleccionado actualmente
              const isOriginal =
                h.idHorarioEspacio === originalSlotId &&
                fechaReserva === (espacio ? (espacio as any).fechaOriginal : ""); // Comparamos fecha también

              return (
                <div key={h.idHorarioEspacio} className={styles.scheduleItem}>
                  <div className={styles.scheduleInfo}>
                    <svg /* icon */ className={styles.clockIcon}><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" /><path d="M12.5 7H11v6l5.25 3.15.75-1.23-4.5-2.67z" /></svg>
                    <span className={styles.scheduleTime}>{label}</span>
                  </div>

                  <button
                    className={
                      isOriginal
                        ? styles.reserveBtnOriginal // Botón diferente si es el original
                        : styles.reserveBtn
                    }
                    type="button"
                    onClick={() => handleUpdate(h)} // Llama a handleUpdate
                    disabled={
                      isSubmitting || // Deshabilitado si CUALQUIERA se está enviando
                      !espacio.disponible ||
                      !isStrictlyFuture(fechaReserva) ||
                      motivoReserva.trim().length < 5
                    }
                  >
                    {isSubmitting
                      ? "Guardando..."
                      : isOriginal
                      ? "Actualizar" // O "Mantener Horario"
                      : "Cambiar Horario"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}

// --- Helpers (Idénticos a FacilityDetail) ---

function getImageForTipo(tipo?: string | null): string {
  const defaultUrl = "/assets/default.png";
  if (!tipo) return defaultUrl;
  const t = (tipo ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase();
  
  const patterns = [
    { keyword: "SALONES_AUDIVISUALES", url: "/assets/salonAudivisual.png" },
    { keyword: "AUDITORIO", url: "/assets.auditorio.png" },
    { keyword: "CANCHA", url: "/assets/cancha.png" },
    { keyword: "CUBICUL", url: "/assets/cubiculo.png" },
    { keyword: "SALONES", url: "/assets/salon.png" },
    { keyword: "ZONA", url: "/assets/zonaComun.png" },
  ];
  for (const { keyword, url } of patterns) {
    if (t.includes(keyword)) return url;
  }
  return defaultUrl;
}

function formatTime(t?: string) {
  if (!t) return "";
  return t.split(":").slice(0, 2).join(":");
}

function formatDay(isoDate?: string) {
  if (!isoDate) return "";
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
}