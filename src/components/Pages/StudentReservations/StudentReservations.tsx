import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../../api/axios";
import Header from "../../Header/Header";
import styles from "./StudentReservations.module.css";
import { useAuth } from "../../contexts/AuthContext";
import type { JSX } from "react";

/* Tipos */
type ReservaDtoResponse = {
  idReserva: number;
  idEstudiante: number;
  idHorarioEspacio: number;
  estadoReserva: string;
  fecha: string; // ISO yyyy-mm-dd
  motivo?: string | null;
};

type HorarioEspacio = {
  idHorarioEspacio: number;
  idEspacio: number;
  dia: string;
  horaInicio: string;
  horaFin: string;
};

type EspacioDetail = {
  id: number;
  nombre: string;
  tipo?: string | null;
};

type EnrichedReservation = {
  idReserva: number;
  tipoEspacio: string;
  nombreEspacio: string;
  fecha: string;
  horario: string;
  estadoReserva: string;
  motivo?: string | null;
};

// DTO que el backend espera en el body del PATCH
type ReservaCambioEstadoDtoRequest = {
  idReserva: number;
  motivo: string;
};

const MAX_REASON = 300; // Límite para el motivo

export default function StudentReservations(): JSX.Element {
  const navigate = useNavigate();
  const { user } = useAuth();
  const idEstudiante =
    user?.idEstudiante ?? Number(localStorage.getItem("idEstudiante") ?? 0);

  const [reservasRaw, setReservasRaw] = useState<ReservaDtoResponse[]>([]);
  const [enriched, setEnriched] = useState<EnrichedReservation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortBy, setSortBy] = useState<"más nuevo" | "más antiguo" | "A-Z">(
    "más nuevo"
  );
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 8;

  // --- ESTADO PARA EL MODAL ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentReservation, setCurrentReservation] =
    useState<EnrichedReservation | null>(null);
  const [motivo, setMotivo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // ----------------------------------

  useEffect(() => {
    if (!idEstudiante || idEstudiante <= 0) {
      setLoading(false);
      setReservasRaw([]);
      setEnriched([]);
      return;
    }

    let mounted = true;
    setLoading(true);

    (async () => {
      try {
        const res = await api.get<ReservaDtoResponse[]>(
          `/estudiantes/${idEstudiante}/reservas`
        );
        if (!mounted) return;
        const data = res.data ?? [];
        setReservasRaw(data);

        // enriquecer cada reserva (horario -> espacio)
        const enrichedPromises = data.map(async (r) => {
          try {
            const h = await api.get<HorarioEspacio>(
              `/horarios-espacios/${r.idHorarioEspacio}`
            );
            const horario = h.data;
            const esp = await api.get<EspacioDetail>(
              `/espacios/${horario.idEspacio}`
            );
            const espacio = esp.data;
            const horarioLabel = `${formatTime(
              horario.horaInicio
            )} - ${formatTime(horario.horaFin)}`;

            return {
              idReserva: r.idReserva,
              tipoEspacio: espacio?.tipo ?? "—",
              nombreEspacio: espacio?.nombre ?? `Espacio ${horario.idEspacio}`,
              fecha: r.fecha,
              horario: horarioLabel,
              estadoReserva: String(r.estadoReserva ?? "DESCONOCIDO"),
              motivo: r.motivo ?? undefined,
            } as EnrichedReservation;
          } catch (err) {
            // fallback: información mínima si fallan las llamadas secundarias
            return {
              idReserva: r.idReserva,
              tipoEspacio: "—",
              nombreEspacio: `Horario ${r.idHorarioEspacio}`,
              fecha: r.fecha,
              horario: "",
              estadoReserva: String(r.estadoReserva ?? "DESCONOCIDO"),
              motivo: r.motivo ?? undefined,
            } as EnrichedReservation;
          }
        });

        const all = await Promise.all(enrichedPromises);
        if (!mounted) return;
        setEnriched(all);
      } catch (err) {
        console.error("Error fetching reservas:", err);
        setReservasRaw([]);
        setEnriched([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [idEstudiante]);

  // filtros, orden y paginación (memoizado)
  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    let list = enriched.slice();

    if (term) {
      list = list.filter(
        (r) =>
          r.nombreEspacio.toLowerCase().includes(term) ||
          r.tipoEspacio.toLowerCase().includes(term) ||
          (r.motivo ?? "").toLowerCase().includes(term) ||
          r.horario.toLowerCase().includes(term)
      );
    }

    if (sortBy === "más nuevo") {
      list.sort((a, b) => +new Date(b.fecha) - +new Date(a.fecha));
    } else if (sortBy === "más antiguo") {
      list.sort((a, b) => +new Date(a.fecha) - +new Date(b.fecha));
    } else {
      list.sort((a, b) => a.nombreEspacio.localeCompare(b.nombreEspacio));
    }

    return list;
  }, [enriched, searchTerm, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const paginated = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortBy, enriched.length]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages]);

  const handleEdit = (idReserva: number) => {
    // Esto navega a la página de edición (como pediste)
    navigate(`/edit-reservation/${idReserva}`);
  };

  // --- LÓGICA DEL MODAL (PARA CANCELAR) ---

  const handleOpenModal = (reserva: EnrichedReservation) => {
    // Quitamos la validación de fecha; se debe poder cancelar en cualquier momento.
    setCurrentReservation(reserva);
    setMotivo(""); // Empezar con motivo vacío para la cancelación
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentReservation(null);
    setMotivo("");
    setIsSubmitting(false);
  };

  /**
   * Esta función ahora llama al PATCH /cancelar con el motivo
   */
  const handleConfirmCancel = async () => {
    if (!currentReservation || !idEstudiante) {
      alert(
        "Error: No se ha seleccionado una reserva o no se ha identificado al estudiante."
      );
      return;
    }

    const motivoTrim = motivo.trim();
    if (motivoTrim.length < 5) {
      alert(
        `El motivo de cancelación debe tener al menos 5 caracteres (actual: ${motivoTrim.length}).`
      );
      return;
    }

    // --- ¡CORRECCIÓN AQUÍ! ---
    // El payload debe coincidir con ReservaCambioEstadoDtoRequest
    const payload: ReservaCambioEstadoDtoRequest = {
      idReserva: currentReservation.idReserva, // <-- Esto faltaba
      motivo: motivoTrim,
    };
    // -------------------------

    setIsSubmitting(true);
    try {
      // Usamos la ruta PATCH .../cancelar que especificaste
      await api.patch(
        `/estudiantes/${idEstudiante}/reservas/${currentReservation.idReserva}/cancelar`,
        payload // Enviamos el payload CORREGIDO en el body
      );

      alert("Reserva cancelada correctamente.");
      handleCloseModal();

      // Actualizar la UI localmente para reflejar el estado "CANCELADO"
      setEnriched((prev) =>
        prev.map((r) =>
          r.idReserva === currentReservation.idReserva
            ? { ...r, estadoReserva: "CANCELADO" } // O "CANCELADA"
            : r
        )
      );
    } catch (err: any) {
      console.error("Error cancelando reserva:", err);
      const msg =
        err?.response?.data?.message ??
        err?.message ??
        "No se pudo cancelar la reserva.";
      // Si el error es 403, damos un mensaje más específico
      if (err?.response?.status === 403) {
        alert(
          `Error 403: No tienes permiso para realizar esta acción. Detalles: ${msg}`
        );
      } else {
        alert(`Error: ${msg}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className={`${styles.container} ${styles["p-4"]}`}>
          Cargando reservas...
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className={`${"container"} ${styles.container}`}>
        <section className={styles.titleSection}>
          <h2 className={styles.pageTitle}>MIS RESERVAS</h2>
          <div className={styles.actionButtons}>
            <button
              className="btn btn-outline-primary me-2"
              onClick={() => window.location.reload()}
            >
              Actualizar
            </button>
          </div>
        </section>

        <section className={styles.reservationsSection}>
          <div className={styles.controls}>
            <div className={styles.searchBox}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden
              >
                <path
                  d="M8 15c-3.86 0-7-3.14-7-7s3.14-7 7-7 7 3.14 7 7-3.14 7-7 7zm6.5-2.5l4.5 4.5"
                  stroke="#999"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              <input
                className={styles.searchInput}
                placeholder="Buscar por espacio, tipo o motivo"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className={styles.sortBox}>
              <label htmlFor="sortSelect">Ordenado por:</label>
              <select
                id="sortSelect"
                className={`${styles.sortSelect}`}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                style={{ width: "auto" }}
              >
                <option>más nuevo</option>
                <option>más antiguo</option>
                <option>A-Z</option>
              </select>
            </div>
          </div>

          <div className={styles.tableContainer}>
            <table className={`table ${styles.table}`}>
              <thead>
                <tr>
                  <th>Tipo Espacio</th>
                  <th>Nombre espacio</th>
                  <th>Fecha</th>
                  <th>Horario</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((r) => (
                  <tr key={r.idReserva}>
                    <td>{r.tipoEspacio}</td>
                    <td>{r.nombreEspacio}</td>
                    <td>{formatDisplayDate(r.fecha)}</td>
                    <td>{r.horario}</td>
                    <td>
                      <span className={getStatusClass(styles, r.estadoReserva)}>
                        {r.estadoReserva}
                      </span>
                    </td>
                    <td>
                      {/* Botón Editar (sin cambios) */}
                      <button
                        className={`btn btn-sm btn-outline-primary me-2 ${
                          styles["btn-sm"] ?? ""
                        }`}
                        title="Editar"
                        onClick={() => handleEdit(r.idReserva)}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          fill="currentColor"
                          viewBox="0 0 16 16"
                          aria-hidden
                        >
                          <path d="M12.146.854a.5.5 0 0 1 .708 0l2.293 2.293a.5.5 0 0 1 0 .708l-9.193 9.193A1 1 0 0 1 6 13H3.5a.5.5 0 0 1-.5-.5V10a1 1 0 0 1 .293-.707l9.353-9.353z" />
                        </svg>
                      </button>
                      {/* Botón Cancelar (sin cambios, sigue abriendo el modal) */}
                      <button
                        className={`btn btn-sm btn-outline-danger ${
                          styles["btn-sm"] ?? ""
                        }`}
                        title="Cancelar Reserva"
                        onClick={() => handleOpenModal(r)} // <-- Abre el modal
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          fill="currentColor"
                          viewBox="0 0 16 16"
                          aria-hidden
                        >
                          <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 1 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}

                {paginated.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center p-4">
                      No hay reservas que mostrar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className={styles.pagination}>
            <button
              className={styles.paginationBtn}
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              {"‹"}
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
              if (totalPages > 8) {
                if (
                  p > 3 &&
                  p < totalPages - 2 &&
                  Math.abs(p - currentPage) > 1
                ) {
                  if (p !== 4 && p !== totalPages - 3) return null;
                }
              }
              return (
                <button
                  key={p}
                  className={`${styles.paginationBtn} ${
                    currentPage === p ? styles.active : ""
                  }`}
                  onClick={() => setCurrentPage(p)}
                >
                  {p}
                </button>
              );
            })}
            <button
              className={styles.paginationBtn}
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              {"›"}
            </button>
          </div>
        </section>
      </main>

      {/* --- INICIO: MODAL DE CANCELACIÓN --- */}
      {isModalOpen && currentReservation && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h5 className={styles.modalTitle}>Cancelar Reserva</h5>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={handleCloseModal}
                aria-label="Cerrar"
              >
                &times;
              </button>
            </div>

            <div className={styles.modalBody}>
              <p>
                Estás a punto de cancelar la reserva para{" "}
                <strong>{currentReservation.nombreEspacio}</strong>
                el día{" "}
                <strong>{formatDisplayDate(currentReservation.fecha)}</strong> (
                {currentReservation.horario}).
              </p>
              <p>
                Por favor, introduce un motivo para la cancelación (mín. 5
                caracteres).
              </p>

              {/* Textarea */}
              <div className="mb-3">
                <label htmlFor="motivoCancelacion" className="form-label">
                  Motivo de la cancelación{" "}
                  <small className="text-muted">
                    ({motivo.length}/{MAX_REASON})
                  </small>
                </label>
                <textarea
                  id="motivoCancelacion"
                  className="form-control"
                  value={motivo}
                  onChange={(e) => {
                    if (e.target.value.length <= MAX_REASON)
                      setMotivo(e.target.value);
                  }}
                  placeholder="Escribe el motivo por el que cancelas esta reserva..."
                  rows={4}
                  maxLength={MAX_REASON}
                  required
                />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCloseModal}
                disabled={isSubmitting}
              >
                Cerrar
              </button>
              <button
                type="button"
                className="btn btn-danger" // Botón rojo para cancelar
                onClick={handleConfirmCancel} // Llama a la función corregida
                disabled={isSubmitting || motivo.trim().length < 5}
              >
                {isSubmitting ? "Cancelando..." : "Confirmar Cancelación"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* --- FIN: NUEVO MODAL --- */}
    </>
  );
}

/* helpers */
function formatTime(t?: string) {
  if (!t) return "";
  return t.split(":").slice(0, 2).join(":");
}
function formatDisplayDate(iso?: string) {
  if (!iso) return "";
  const parts = iso.split("-"); // YYYY, MM, DD
  if (parts.length === 3) {
    // Usamos new Date(Date.UTC(y, m, d)) para evitar problemas de zona horaria
    const d = new Date(
      Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
    );
    return d.toLocaleDateString("es-CO", {
      // 'es-CO' o 'undefined' para local
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "UTC", // Importante para que coincida con la fecha UTC
    });
  }
  return iso; // fallback
}
function getStatusClass(stylesObj: Record<string, string>, estado?: string) {
  if (!estado) return "";
  const s = String(estado).toLowerCase();
  if (s.includes("aprob")) return stylesObj["status-aprobado"] ?? "";
  if (s.includes("espera") || s.includes("pend"))
    return stylesObj["status-enespera"] ?? "";
  if (s.includes("rech") || s.includes("cancel") || s.includes("cance")) {
    return stylesObj["status-rechazado"] ?? "";
  }
  return "";
}
