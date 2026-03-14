/**
 * PeriodFilter.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Sélecteur de période réutilisable — 1j / 1s / 1m / 1a / Tout
 * Utilisé sur le Dashboard et prévu pour la vue Paires.
 */

export const PERIODS = [
  { key: '1j',   label: '1j'  },
  { key: '1s',   label: '1s'  },
  { key: '1m',   label: '1m'  },
  { key: '1a',   label: '1a'  },
  { key: 'tout', label: 'Tout' },
]

/**
 * Retourne la date de début d'une période à partir d'aujourd'hui.
 * @param {'1j'|'1s'|'1m'|'1a'|'tout'} period
 * @returns {Date|null} null = pas de borne (tout)
 */
export function periodStart(period) {
  const now = new Date()
  switch (period) {
    case '1j': {
      const d = new Date(now)
      d.setHours(0, 0, 0, 0)
      return d
    }
    case '1s': {
      const d = new Date(now)
      d.setDate(d.getDate() - 6)
      d.setHours(0, 0, 0, 0)
      return d
    }
    case '1m': {
      const d = new Date(now)
      d.setDate(d.getDate() - 29)
      d.setHours(0, 0, 0, 0)
      return d
    }
    case '1a': {
      const d = new Date(now)
      d.setFullYear(d.getFullYear() - 1)
      d.setHours(0, 0, 0, 0)
      return d
    }
    case 'tout':
    default:
      return null
  }
}

/**
 * Formate la notice de plage de dates selon la période.
 */
export function periodNotice(period) {
  const fmt = (d) =>
    d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
  const today = new Date()

  switch (period) {
    case '1j':
      return `Données du ${fmt(today)} — capital, PnL et ordres filtrés sur la période`
    case '1s': {
      const start = new Date(today)
      start.setDate(start.getDate() - 6)
      return `Du ${fmt(start)} au ${fmt(today)} — capital, PnL et ordres filtrés sur la période`
    }
    case '1m': {
      const start = new Date(today)
      start.setDate(start.getDate() - 29)
      return `Du ${fmt(start)} au ${fmt(today)} — capital, PnL et ordres filtrés sur la période`
    }
    case '1a': {
      const start = new Date(today)
      start.setFullYear(start.getFullYear() - 1)
      return `Du ${fmt(start)} au ${fmt(today)} — capital, PnL et ordres filtrés sur la période`
    }
    case 'tout':
      return 'Depuis le premier trade enregistré — toutes périodes confondues'
    default:
      return ''
  }
}

/**
 * Composant PeriodFilter
 *
 * Props :
 *   period    {string}   — période active ('1j' par défaut)
 *   onChange  {Function} — (key: string) => void
 */
export default function PeriodFilter({ period = '1j', onChange }) {
  return (
    <div className="period-bar">
      <div className="period-tabs" role="tablist">
        {PERIODS.map(({ key, label }) => (
          <button
            key={key}
            role="tab"
            aria-selected={period === key}
            className={`ptab${period === key ? ' active' : ''}`}
            onClick={() => onChange(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="period-notice">{periodNotice(period)}</div>
    </div>
  )
}
