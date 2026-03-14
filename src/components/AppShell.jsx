/**
 * AppShell.jsx — v5
 * ─────────────────────────────────────────────────────────────────────────────
 * Shell principal avec sidebar fixe + topbar.
 * PageDashboard intègre PeriodFilter + KpiRow v5 + SummaryTable v5.
 */

import { useState, useRef, useEffect } from 'react'
import Logo          from './Logo.jsx'
import KpiRow        from './KpiRow.jsx'
import SummaryTable  from './SummaryTable.jsx'
import PairesView    from './PairesView.jsx'
import DataPanel     from './DataPanel.jsx'
import PeriodFilter  from './PeriodFilter.jsx'
import { usePeriodFilter } from '../hooks/usePeriodFilter.js'
import { auth, signOut }   from '../lib/firebase.js'

const NAV_ITEMS = [
  { id: 'dashboard', icon: '🚀', label: 'Dashboard',  sublabel: 'Vue globale'      },
  { id: 'paires',    icon: '📊', label: 'Paires',     sublabel: 'Détail par paire' },
  { id: 'donnees',   icon: '🗃️', label: 'Données',    sublabel: 'Gérer le journal' },
]

/* ── Topbar ──────────────────────────────────────────────────────────────── */
function Topbar({ activePage, loadedAt, setSidebarOpen }) {
  const pageItem = NAV_ITEMS.find(i => i.id === activePage)

  const [btnMode, setBtnMode]      = useState(null)
  const [showIosGuide, setShowIos] = useState(false)
  const deferredPrompt             = useRef(null)
  const pendingSW                  = useRef(null)
  const newSWsha                   = useRef(null)

  function isIosDevice() {
    const ua = navigator.userAgent
    return /iphone|ipad|ipod/i.test(ua) ||
      (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
  }
  function isIosSafari() {
    const ua = navigator.userAgent
    return isIosDevice() && /safari/i.test(ua) && !/chrome|crios|fxios|android/i.test(ua) && window.navigator.standalone !== true
  }
  function isStandalone() {
    return window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches
  }

  useEffect(() => {
    const handler = e => {
      e.preventDefault()
      deferredPrompt.current = e
      if (!isStandalone() && !localStorage.getItem('ydash-install-dismissed')) setBtnMode('android')
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  useEffect(() => {
    if (isIosSafari() && !localStorage.getItem('ydash-install-dismissed')) setBtnMode('ios')
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.ready.then(reg => {
      const onWaiting = sw => {
        const sha = String(Date.now())
        newSWsha.current = sha
        if (localStorage.getItem('ydash-update-dismissed-sha') !== sha) {
          pendingSW.current = sw
          setBtnMode('update')
        }
      }
      if (reg.waiting) onWaiting(reg.waiting)
      reg.addEventListener('updatefound', () => {
        const inst = reg.installing
        if (!inst) return
        inst.addEventListener('statechange', () => {
          if (inst.state === 'installed' && navigator.serviceWorker.controller) onWaiting(inst)
        })
      })
    })
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload())
  }, [])

  async function handleBtn() {
    if (btnMode === 'ios') { setShowIos(v => !v); return }
    if (btnMode === 'android' && deferredPrompt.current) {
      deferredPrompt.current.prompt()
      const { outcome } = await deferredPrompt.current.userChoice
      deferredPrompt.current = null
      if (outcome === 'accepted') { setBtnMode(null); localStorage.setItem('ydash-install-dismissed', '1') }
      return
    }
    if (btnMode === 'update') {
      const sw = pendingSW.current
      if (sw) sw.postMessage({ type: 'SKIP_WAITING' })
      else window.location.reload()
    }
  }

  function dismissBtn() {
    if (btnMode === 'update') localStorage.setItem('ydash-update-dismissed-sha', newSWsha.current ?? '')
    else localStorage.setItem('ydash-install-dismissed', '1')
    setBtnMode(null)
    setShowIos(false)
  }

  return (
    <>
      <header className="shell-topbar">
        <button className="topbar-burger" onClick={() => setSidebarOpen(v => !v)} aria-label="Menu">
          <span /><span /><span />
        </button>
        <div className="topbar-breadcrumb">
          <span className="topbar-breadcrumb-icon">{pageItem?.icon}</span>
          <span className="topbar-breadcrumb-label">{pageItem?.label}</span>
        </div>
        <div className="topbar-right">
          <div className="topbar-live">
            <span className="live-dot" />
            {loadedAt && <span className="topbar-time">Chargé {loadedAt}</span>}
          </div>
          {btnMode && (
            <div className="topbar-install-wrap">
              <button
                className={`btn-sm btn-install-topbar${btnMode === 'update' ? ' btn-install-update' : ''}`}
                onClick={handleBtn}
              >
                {btnMode === 'update' ? '🔄 Màj' : '📲 Installer'}
              </button>
              <button className="btn-install-dismiss" onClick={dismissBtn} aria-label="Ignorer">✕</button>
            </div>
          )}
        </div>
      </header>

      {showIosGuide && btnMode === 'ios' && (
        <div className="ios-guide-bar">
          <span>1. <strong>⎋ Partager</strong></span>
          <span className="ios-guide-sep">›</span>
          <span>2. <strong>"Sur l'écran d'accueil"</strong></span>
          <span className="ios-guide-sep">›</span>
          <span>3. <strong>Ajouter</strong></span>
          <button className="ios-guide-close" onClick={() => setShowIos(false)}>✕</button>
        </div>
      )}
    </>
  )
}

/* ── Sidebar ─────────────────────────────────────────────────────────────── */
function Sidebar({ activePage, setActivePage, isOpen, setIsOpen, backToLanding }) {
  function navigate(page) {
    setActivePage(page)
    setIsOpen(false)
  }

  async function handleSignOut() {
    try { await signOut(auth) } catch (e) { console.error('Erreur déconnexion :', e) }
  }

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={() => setIsOpen(false)} />}
      <aside className={`shell-sidebar${isOpen ? ' sidebar-open' : ''}`}>
        <div className="sidebar-logo-wrap">
          <Logo small />
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`sidebar-item${activePage === item.id ? ' active' : ''}`}
              onClick={() => navigate(item.id)}
            >
              <span className="sidebar-item-icon">{item.icon}</span>
              <span className="sidebar-item-text">
                <span className="sidebar-item-label">{item.label}</span>
                <span className="sidebar-item-sub">{item.sublabel}</span>
              </span>
              {activePage === item.id && <span className="sidebar-item-bar" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="sidebar-back-btn" onClick={backToLanding}>
            <span>←</span><span>Accueil</span>
          </button>
          <button className="sidebar-back-btn sidebar-signout-btn" onClick={handleSignOut}>
            <span>⎋</span><span>Déconnexion</span>
          </button>
        </div>
      </aside>
    </>
  )
}

/* ── PageDashboard v5 ────────────────────────────────────────────────────── */
function PageDashboard({
  pairList,
  rawRows,
  prices,
  pricesLoading,
  pricesError,
  lastPriceUpdate,
  refreshPrices,
}) {
  const { period, setPeriod, data } = usePeriodFilter(pairList, rawRows, prices)

  return (
    <div className="page-content">

      {/* Filtre période */}
      <PeriodFilter period={period} onChange={setPeriod} />

      {/* KPIs Capital + Performance + Ordres */}
      <KpiRow
        data={data}
        pricesLoading={pricesLoading}
        pricesError={pricesError}
        lastPriceUpdate={lastPriceUpdate}
        refreshPrices={refreshPrices}
      />

      {/* Tableau récapitulatif */}
      <section className="v5-section">
        <h2 className="v5-section-title">Récapitulatif par paire</h2>
        <SummaryTable rows={data.rows} period={period} />
      </section>

    </div>
  )
}

/* ── PagePaires ──────────────────────────────────────────────────────────── */
function PagePaires({ pairList, excluded, toggleFlag }) {
  return (
    <div className="page-content">
      <PairesView
        pairList={pairList}
        excluded={excluded}
        toggleFlag={toggleFlag}
        embedded={true}
      />
    </div>
  )
}

/* ── AppShell export ─────────────────────────────────────────────────────── */
export default function AppShell({
  activePage,
  setActivePage,
  loadedAt,
  excluded,
  pairList,
  rawRows,
  prices,
  repoAvailable,
  backToLanding,
  toggleFlag,
  loadFromFile,
  loadFromDrive,
  driveErr,
  setDriveErr,
  onRepoUpdated,
  pricesLoading,
  pricesError,
  priceSource,
  lastPriceUpdate,
  refreshPrices,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="shell-layout">
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        backToLanding={backToLanding}
      />
      <div className="shell-main">
        <Topbar
          activePage={activePage}
          loadedAt={loadedAt}
          setSidebarOpen={setSidebarOpen}
        />
        <main className="shell-content">
          {activePage === 'dashboard' && (
            <PageDashboard
              pairList={pairList}
              rawRows={rawRows}
              prices={prices}
              pricesLoading={pricesLoading}
              pricesError={pricesError}
              lastPriceUpdate={lastPriceUpdate}
              refreshPrices={refreshPrices}
            />
          )}
          {activePage === 'paires' && (
            <PagePaires
              pairList={pairList}
              excluded={excluded}
              toggleFlag={toggleFlag}
            />
          )}
          {activePage === 'donnees' && (
            <DataPanel
              repoAvailable={repoAvailable}
              loadFromFile={loadFromFile}
              loadFromDrive={loadFromDrive}
              driveErr={driveErr}
              setDriveErr={setDriveErr}
              onRepoUpdated={onRepoUpdated}
            />
          )}
        </main>
      </div>
    </div>
  )
}
