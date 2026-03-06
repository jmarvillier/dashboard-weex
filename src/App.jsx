/**
 * App.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Composant racine unifié.
 * Architecture : Shell fixe (Sidebar + Topbar) + zone de contenu dynamique.
 *
 * Pages : 'landing' | 'dashboard' | 'paires' | 'donnees'
 * La sidebar est visible dès que des données sont chargées.
 */

import { useState, useEffect }  from 'react'
import { useTrading }            from './hooks/useTrading.js'
import LoadingOverlay            from './components/LoadingOverlay.jsx'
import Landing                   from './components/Landing.jsx'
import AppShell                  from './components/AppShell.jsx'
import InstallPrompt             from './components/InstallPrompt.jsx'

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

  // Page active dans le shell : 'dashboard' | 'paires' | 'donnees'
  const [activePage, setActivePage] = useState('dashboard')

  // Quand on revient sur la landing, on reset la page active
  useEffect(() => {
    if (view === 'landing') setActivePage('dashboard')
  }, [view])

  const handleEnterApp = (page = 'dashboard') => {
    setActivePage(page)
    openFromRepository()
  }

  const handleBackToLanding = () => {
    setActivePage('dashboard')
    backToLanding()
  }

  return (
    <>
      <LoadingOverlay visible={loading} text={loadingTxt} />

      {view === 'landing' ? (
        <Landing
          zone={zone}
          setZone={setZone}
          driveErr={driveErr}
          setDriveErr={setDriveErr}
          repoAvailable={repoAvailable}
          openFromRepository={() => handleEnterApp('dashboard')}
          onOpenPaires={() => handleEnterApp('paires')}
          onOpenDonnees={() => handleEnterApp('donnees')}
          loadFromDrive={loadFromDrive}
          loadFromFile={loadFromFile}
          onRepoUpdated={refreshRepoAvailable}
        />
      ) : (
        <AppShell
          activePage={activePage}
          setActivePage={setActivePage}
          fileName={fileName}
          loadedAt={loadedAt}
          excluded={excluded}
          pairList={pairList}
          repoAvailable={repoAvailable}
          clearRepository={clearRepository}
          backToLanding={handleBackToLanding}
          toggleFlag={toggleFlag}
          loadFromFile={loadFromFile}
          loadFromDrive={loadFromDrive}
          driveErr={driveErr}
          setDriveErr={setDriveErr}
          onRepoUpdated={refreshRepoAvailable}
        />
      )}

      <InstallPrompt />
    </>
  )
}
