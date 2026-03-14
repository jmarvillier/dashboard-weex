/**
 * Logo.jsx — Ydash v5
 * Icône SVG Y+$+€/¥ · bleu nuit / or
 *
 * Variantes :
 *   large (défaut) — landing, sidebar
 *   small          — topbar
 */

const VERSION = import.meta.env.VITE_APP_VERSION ?? '0.0.0'

function YdashIcon({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="31"   fill="#090f1c"/>
      <circle cx="32" cy="32" r="30.5" stroke="#1a3450" strokeWidth="1"/>
      {/* Y — trois branches silver-bleu */}
      <line x1="32" y1="33" x2="13" y2="10" stroke="#7aaec8" strokeWidth="4.5" strokeLinecap="round"/>
      <line x1="32" y1="33" x2="51" y2="10" stroke="#7aaec8" strokeWidth="4.5" strokeLinecap="round"/>
      <line x1="32" y1="33" x2="32" y2="58" stroke="#7aaec8" strokeWidth="4.5" strokeLinecap="round"/>
      {/* Barre verticale $ */}
      <line x1="32" y1="6"  x2="32" y2="58" stroke="#c8a020" strokeWidth="2"   strokeLinecap="round"/>
      {/* Arc supérieur — demi-cercle bombé vers le haut */}
      <path d="M 25,41 A 7,7 0 0 1 39,41" stroke="#c8a020" strokeWidth="2.4" fill="none" strokeLinecap="round"/>
      {/* Arc inférieur — demi-cercle bombé vers le bas */}
      <path d="M 39,45 A 7,7 0 0 1 25,45" stroke="#c8a020" strokeWidth="2.4" fill="none" strokeLinecap="round"/>
      {/* Barres horizontales €/¥ */}
      <line x1="20" y1="41" x2="44" y2="41" stroke="#c8a020" strokeWidth="2.2" strokeLinecap="round"/>
      <line x1="20" y1="45" x2="44" y2="45" stroke="#c8a020" strokeWidth="1.8" strokeLinecap="round"/>
      {/* Nœud central */}
      <circle cx="32" cy="33" r="3.2" fill="#c8a020"/>
      <circle cx="32" cy="33" r="1.5" fill="#090f1c"/>
    </svg>
  )
}

export default function Logo({ small = false }) {
  if (small) {
    return (
      <div className="logo-small">
        <YdashIcon size={28} />
        <div className="logo-small-text">
          <span className="logo-small-name">Ydash</span>
          <span className="logo-small-version">v{VERSION}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="logo-large">
      <YdashIcon size={48} />
      <div className="logo-large-text">
        <div className="logo-large-name">Ydash</div>
        <div className="logo-large-sub">journal</div>
        <span className="logo-large-version">v{VERSION}</span>
      </div>
    </div>
  )
}
