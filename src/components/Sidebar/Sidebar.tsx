import type { ChangeEvent } from "react";
import styles from "./Sidebar.module.css";
import type { JSX } from "react";

interface Props {
  onSearch?: (term: string) => void;
  onSelectType?: (tipo: string) => void;
  activeType?: string;
}

const TYPES: { value: string; label: string }[] = [
  { value: "ALL", label: "Todos" },
  { value: "CANCHAS", label: "Canchas" },
  { value: "AUDITORIOS", label: "Auditorios" },
  { value: "CUBICULOS", label: "Cubículos" },
  { value: "SALONES", label: "Salones" },
  { value: "ZONAS_COMUNES", label: "Zonas comunes" },
  { value: "SALONES_AUDIVISUALES", label: "Salones Audiovisuales" },
];

export default function Sidebar({ onSearch, onSelectType, activeType = "CANCHAS" }: Props): JSX.Element {
  const handleInput = (e: ChangeEvent<HTMLInputElement>) => {
    onSearch?.(e.target.value);
  };

  const handleSelectType = (value: string) => {
    onSelectType?.(value);
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.searchContainer}>
        <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zM9.5 14C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
        </svg>
        <input
          className={styles.searchInput}
          placeholder="Buscar"
          aria-label="Buscar"
          onChange={handleInput}
        />
        <button className={styles.filterBtn} aria-label="Filtrar" onClick={() => alert("Abrir filtros")}>
          ⏺
        </button>
      </div>

      <nav>
        <ul className={styles.navMenu}>
          {TYPES.map((t) => {
            // activar si coincide (normalizamos comparando uppercase sin tildes)
            const active = normalizeType(t.value) === normalizeType(activeType);
            return (
              <li className={styles.navItem} key={t.value}>
                <button
                  onClick={(e) => { e.preventDefault(); handleSelectType(t.value); }}
                  className={`${styles.navLink} ${active ? styles.active : ""}`}
                  aria-pressed={active}
                >
                  {t.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

/* helper para normalizar (igual que en el dashboard) */
function normalizeType(s?: string) {
  return (s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/\s+/g, "_");
}


// // src/components/Sidebar/Sidebar.tsx
// import type { ChangeEvent } from "react";
// import styles from "./Sidebar.module.css";
// import type { JSX } from "react";

// interface Props {
//   onSearch?: (term: string) => void;
// }

// export default function Sidebar({ onSearch }: Props): JSX.Element {
//   const handleInput = (e: ChangeEvent<HTMLInputElement>) => {
//     onSearch?.(e.target.value);
//   };

//   return (
//     <aside className={styles.sidebar}>
//       <div className={styles.searchContainer}>
//         <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
//           <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zM9.5 14C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
//         </svg>
//         <input
//           className={styles.searchInput}
//           placeholder="Buscar"
//           aria-label="Buscar"
//           onChange={handleInput}
//         />
//         <button className={styles.filterBtn} aria-label="Filtrar" onClick={() => alert("Abrir filtros")}>
//           ⏺
//         </button>
//       </div>

//       <nav>
//         <ul className={styles.navMenu}>
//           <li className={styles.navItem}><a className={`${styles.navLink} ${styles.active}`} href="#">Canchas</a></li>
//           <li className={styles.navItem}><a className={styles.navLink} href="#">Auditorios</a></li>
//           <li className={styles.navItem}><a className={styles.navLink} href="#">Cubículos</a></li>
//           <li className={styles.navItem}><a className={styles.navLink} href="#">Salones</a></li>
//           <li className={styles.navItem}><a className={styles.navLink} href="#">Zonas comunes</a></li>
//           <li className={styles.navItem}><a className={styles.navLink} href="#">Salones Audiovisuales</a></li>
//         </ul>
//       </nav>
//     </aside>
//   );
// }
