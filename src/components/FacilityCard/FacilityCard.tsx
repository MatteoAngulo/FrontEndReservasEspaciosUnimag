import { useNavigate } from "react-router-dom";
import styles from "./FacilityCard.module.css";
import type { JSX } from "react";

type Facility = {
  id: string;
  nombre: string;
  tipo?: string;
  sede: string;
  imagenUrl?: string;
};

interface Props {
  facility: Facility;
}

export default function FacilityCard({ facility }: Props): JSX.Element {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/espacio/${encodeURIComponent(facility.id)}`);
  };

  // friendly tipo (quita underscores y pone capitalizado)
  const formatTipo = (t?: string) => {
    if (!t) return "";
    return t
      .replace(/_/g, " ")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <article
      className={styles.card}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") handleClick();
      }}
    >
      <div className={styles.header}>
        {facility.imagenUrl ? (
          <img src={facility.imagenUrl} alt={facility.nombre} className={styles.image} />
        ) : (
          <div className={styles.placeholder}>🏟️</div>
        )}

        <div className={styles.info}>
          <h3 className={styles.title}>{facility.nombre}</h3>

          <div className={styles.metaRow}>
            <div className={styles.location}>
              <svg className={styles.locationIcon} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
              <span>{facility.sede}</span>
            </div>

            {facility.tipo && (
              <div className={styles.typeBadge}>
                {formatTipo(facility.tipo)}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

