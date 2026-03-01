/**
 * App.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Composant racine.
 * Vues : 'landing' | 'dashboard' | 'paires'
 *
 * view      → géré par useTrading ('landing' | 'dashboard')
 * subView   → surcharge locale pour afficher 'paires' sur les données chargées
 */

import { useState, useEffect } from 'react'
import { useTrading }   from './hooks/useTrading.js'
import LoadingOverlay   from './components/LoadingOverlay.jsx'
import Landing          from './components/Landing.jsx'
import Topbar           from './components/Topbar.jsx'
import KpiRow           from './components/KpiRow.jsx'
import PairCard         from './components/PairCard.jsx'
import SummaryTable     from './components/SummaryTable.jsx'
import InstallPrompt    from './components/InstallPrompt.jsx'
import PairesView       from './components/PairesView.jsx'

export default function App() {
  const {
    view, zone, loading, loadingTxt,
    fileName, loadedAt, pairList, excluded, driveErr,
    repoAvailable,
    setZone, setDriveErr,
    openFromRepository,
    loadFromFile,
    loadFromDrive,
    clearRepository,
    refreshRepoAvailable,
    toggleFlag,
    backToLanding,
  } = useTrading()

  // null = suivre `view` normalement
  const [subView, setSubView] = useState(null)
  // Flag pour basculer sur 'paires' après le chargement async
  const [pendingPaires, setPendingPaires] = useState(false)

  // Quand view passe à 'dashboard' et qu'on attendait 'paires', on bascule
  useEffect(() => {
    if (view === 'dashboard' && pendingPaires) {
      setSubView('paires')
      setPendingPaires(false)
    }
  }, [view, pendingPaires])

  // Quand on retourne au landing, reset subView
  useEffect(() => {
    if (view === 'landing') setSubView(null)
  }, [view])

  // Handlers
  const handleOpenDashboard = () => {
    setSubView(null)
    openFromRepository()
  }

  const handleOpenPaires = () => {
    setPendingPaires(true)
    openFromRepository()
  }

  const handleBackToLanding = () => {
    setSubView(null)
    backToLanding()
  }

  // Vue effective
  const effective =
    view === 'landing'       ? 'landing'
    : subView === 'paires'   ? 'paires'
    : 'dashboard'

  return (
    <>
      <LoadingOverlay visible={loading} text={loadingTxt} />

      {effective === 'landing' && (
        <Landing
          zone={zone}
          setZone={setZone}
          driveErr={driveErr}
          setDriveErr={setDriveErr}
          repoAvailable={repoAvailable}
          openFromRepository={handleOpenDashboard}
          onOpenPaires={handleOpenPaires}
          loadFromDrive={loadFromDrive}
          loadFromFile={loadFromFile}
          onRepoUpdated={refreshRepoAvailable}
        />
      )}

      {effective === 'dashboard' && (
        <div id="dashboard" style={{ display: 'block' }}>
          <Topbar
            fileName={fileName}
            loadedAt={loadedAt}
            excluded={excluded}
            clearRepository={clearRepository}
            backToLanding={handleBackToLanding}
          />
          <div className="content">
            <div className="sec">Vue Globale</div>
            <KpiRow pairList={pairList} excluded={excluded} />

            <div className="sec">Par Paire</div>
            <div className="pairs-grid">
              {pairList.map((p, i) => (
                <PairCard
                  key={p.name}
                  p={p}
                  index={i}
                  excluded={excluded}
                  onToggle={toggleFlag}
                />
              ))}
            </div>

            <div className="sec">Tableau Récapitulatif</div>
            <SummaryTable pairList={pairList} excluded={excluded} />
          </div>
        </div>
      )}

      {effective === 'paires' && (
        <PairesView
          pairList={pairList}
          excluded={excluded}
          toggleFlag={toggleFlag}
          onBack={handleBackToLanding}
        />
      )}

      <InstallPrompt />
    </>
  )
}
