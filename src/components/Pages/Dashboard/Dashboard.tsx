import { useEffect, useState } from "react";
import api from "../../../api/axios";
import Header from "../../Header/Header";
import FacilityCard from "../../FacilityCard/FacilityCard";
import Sidebar from "../../Sidebar/Sidebar";
import styles from "./Dashboard.module.css";
import type { JSX } from "react";

/**
 * DTOs desde el backend
 */
type Espacio = {
  id: number;
  nombre: string;
  tipo?: string | null;
  restricciones?: string | null;
  idSede?: number | null;
};

type Facility = {
  id: string;
  nombre: string;
  tipo?: string;
  sede: string;
  imagenUrl?: string;
};

export default function Dashboard(): JSX.Element {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [term, setTerm] = useState("");
  const [selectedTipo, setSelectedTipo] = useState<string>("ALL"); // default

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // 1) traer espacios
        const res = await api.get<Espacio[]>("/espacios");
        const espacios = res.data ?? [];

        // 2) crear set de idSede únicos
        const sedeIds = Array.from(new Set(espacios.map((e) => e.idSede).filter(Boolean))) as number[];

        // 3) Fetch paralelo de sedes -> map id -> name
        const sedeMap: Record<number, string> = {};
        if (sedeIds.length > 0) {
          await Promise.all(
            sedeIds.map(async (id) => {
              try {
                const r = await api.get<{ id: number; name: string }>(`/sedes/${id}`);
                if (r.data?.name) sedeMap[id] = r.data.name;
              } catch (err) {
                // Si falla, dejamos fallback por id (no abortamos todo)
                console.warn(`No se pudo obtener sede ${id}:`, err);
              }
            })
          );
        }

        // 4) convertir cada espacio a Facility con imagen y nombre de sede
        const items: Facility[] = espacios.map((e) => {
          const sedeName = e.idSede ? sedeMap[e.idSede] ?? `Sede ${e.idSede}` : "Sede desconocida";
          return {
            id: String(e.id),
            nombre: e.nombre,
            tipo: e.tipo ?? undefined,
            sede: sedeName,
            imagenUrl: getImageForTipo(e.tipo),
          };
        });

        setFacilities(items);
      } catch (err: unknown) {
        const maybe = err as any;
        if (maybe?.isAxiosError === true || typeof maybe?.response !== "undefined") {
          console.error("Axios/network error:", maybe.response?.data ?? maybe.message ?? maybe);
        } else if (err instanceof Error) {
          console.error("Error:", err.message);
        } else {
          console.error("Unknown error:", err);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // normalización para comparar tipos sin problemas de tildes/minúsculas/espacios
  const normalize = (s?: string | null) =>
    (s ?? "")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toUpperCase()
      .replace(/\s+/g, "_");

  const filtered = facilities.filter((f) => {
    const matchesTerm = f.nombre.toLowerCase().includes(term.toLowerCase());
    const tipoNormalized = normalize(f.tipo);
    const selectedNormalized = normalize(selectedTipo);
    const matchesTipo = selectedTipo === "ALL" ? true : tipoNormalized === selectedNormalized;
    return matchesTerm && matchesTipo;
  });

  return (
    <>
      <Header />
      <div className={styles.mainContainer}>
        <aside className={styles.sidebarWrapper}>
          <Sidebar
            onSearch={setTerm}
            onSelectType={(t) => setSelectedTipo(t)}
            activeType={selectedTipo}
          />
        </aside>

        <main className={styles.content}>
          <div className={styles.contentHeader}>
            <h2 className={styles.contentTitle}>
              {selectedTipo === "ALL" ? "Espacios" : toHumanTitle(selectedTipo)}
            </h2>
          </div>

          {loading ? (
            <p>Cargando...</p>
          ) : (
            <div className={styles.facilitiesGrid}>
              {filtered.map((f) => (
                <FacilityCard key={f.id} facility={f} />
              ))}
            </div>
          )}
        </main>
      </div>
    </>
  );
}

/* Helper: devolver ruta pública de la imagen según tipo */
export function getImageForTipo(tipo?: string | null): string {
  const defaultUrl = "/assets/default.png";

  if (!tipo) return defaultUrl;

  // normalizar: quitar tildes, pasar a mayúsculas y espacios -> underscore
  const t = (tipo ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase();

  // lista de patrones (orden importante: coincidir strings únicos primero si aplica)
  const patterns: { keyword: string; url: string }[] = [
    { keyword: "SALONES_AUDIVISUALES", url: "/assets/salonAudivisual.png" },
    { keyword: "AUDITORIO", url: "/assets/auditorio.png" },
    { keyword: "CANCHA", url: "/assets/cancha.png" },
    { keyword: "CUBICUL", url: "/assets/cubiculo.png" }, // cubículo / cubiculos -> 'CUBICUL' cubriéndolo
    { keyword: "SALONES", url: "/assets/salon.png" },
    { keyword: "ZONA", url: "/assets/zonaComun.png" },
  ];

  // buscar por inclusión (más tolerante que equals)
  for (const { keyword, url } of patterns) {
    if (t.match(keyword)) return url;
  }

  return defaultUrl;
}


/* Helper para mostrar título legible */
function toHumanTitle(tipo: string) {
  if (!tipo) return "Espacios";
  const s = tipo.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}


