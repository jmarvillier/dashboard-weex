/**
 * Logo.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Composant logo WEEX réutilisable.
 * Affiche "WEEX DASHBOARD" + le numéro de version.
 *
 * Variantes :
 *   - large (défaut) : page d'accueil et sous-menus
 *   - small          : topbar du dashboard
 */

const VERSION = '1.0.8-beta'

export default function Logo({ small = false }) {
  if (small) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className="topbar-logo">WEEX</div>
        <span className="logo-version logo-version-small">v{VERSION}</span>
      </div>
    )
  }

  return (
    <div className="logo-wrap">
      <div className="logo">
        WEEX <span>DASHBOARD</span>
      </div>
      <span className="logo-version">v{VERSION}</span>
    </div>
  )
}
