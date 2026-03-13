/**
 * AppShell.jsx
 */

import { useState, useRef, useEffect } from 'react'
import Logo         from './Logo.jsx'
import KpiRow       from './KpiRow.jsx'
import SummaryTable from './SummaryTable.jsx'
import PairesView   from './PairesView.jsx'
import DataPanel    from './DataPanel.jsx'
import { auth, signOut } from '../lib/firebase.js'

const NAV_ITEMS = [
  { id: 'dashboard', icon: '🚀', label: 'Dashboard',  sublabel: 'Vue globale'      },
  { id: 'paires',    icon: '📊', label: 'Paires',     sublabel: 'Détail par paire' },
  { id: 'donnees',   icon: '🗃️', label: 'Données',    sublabel: 'Gérer le journal' },
]

function Topbar({ activePage, loadedAt, setSidebarOpen }) {
  const pageItem = NAV_ITEMS.find(i => i.id === activePage)

  return (
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
      </div>
    </header>
  )
}

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
          <button className="sidebar-back-btn sidebar-signout-btn" onClick={handleSignOut}>
            <span>⎋</span><span>Déconnexion</span>
          </button>
        </div>
      </aside>
    </>
  )
}

function SectionHeader({ icon, title, subtitle }) {
  return (
    <div className="page-section-header">
      <div className="page-section-title"><span>{icon}</span> {title}</div>
      {subtitle && <div className="page-section-sub">{subtitle}</div>}
    </div>
  )
}

function PageDashboard({ pairList, excluded, pricesLoading, pricesError, priceSource, lastPriceUpdate, refreshPrices }) {
  return (
    <div className="page-content">
      <SectionHeader icon="📊" title="Performance Globale" subtitle="Vue consolidée de tous vos investissements" />
      <KpiRow
        pairList={pairList}
        excluded={excluded}
        pricesLoading={pricesLoading}
        pricesError={pricesError}
        priceSource={priceSource}
        lastPriceUpdate={lastPriceUpdate}
        refreshPrices={refreshPrices}
      />
      <SectionHeader icon="📋" title="Tableau Récapitulatif" subtitle="Détail par paire de trading" />
      <SummaryTable pairList={pairList} excluded={excluded} />
    </div>
  )
}

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

export default function AppShell({
  activePage,
  setActivePage,
  loadedAt,
  excluded,
  pairList,
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
              excluded={excluded}
              pricesLoading={pricesLoading}
              pricesError={pricesError}
              priceSource={priceSource}
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
