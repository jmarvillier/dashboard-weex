import { useState, useEffect }       from 'react'
import { useTrading }                 from './hooks/useTrading.js'
import LoadingOverlay                 from './components/LoadingOverlay.jsx'
import Landing                        from './components/Landing.jsx'
import AppShell                       from './components/AppShell.jsx'
import InstallPrompt                  from './components/InstallPrompt.jsx'
import AuthGate                       from './components/AuthGate.jsx'
import { auth, onAuthStateChanged }   from './lib/firebase.js'

export default function App() {
  const [authUser, setAuthUser] = useState(undefined)
  const [authUid, setAuthUid]   = useState(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      setAuthUser(user ?? null)
      setAuthUid(user?.uid ?? null)
    })
    return unsub
  }, [])

  const {
    view, zone, loading, loadingTxt,
    fileName, loadedAt, pairList, rawRows, excluded, driveErr,
    repoAvailable,
    // Prix live
    prices, pricesLoading, pricesError, priceSource, lastPriceUpdate, refreshPrices,
    setZone, setDriveErr,
    openFromRepository,
    loadFromFile,
    loadFromDrive,
    clearRepository,
    refreshRepoAvailable,
    toggleFlag,
    backToLanding,
  } = useTrading()

  const [activePage, setActivePage] = useState('dashboard')

  useEffect(() => {
    if (view === 'landing') setActivePage('dashboard')
  }, [view])

  useEffect(() => {
    if (authUid !== null) backToLanding()
  }, [authUid])

  const handleEnterApp = (page = 'dashboard') => {
    setActivePage(page)
    openFromRepository()
  }

  const handleBackToLanding = () => {
    setActivePage('dashboard')
    backToLanding()
  }

  if (authUser === undefined) return <LoadingOverlay visible text="Vérification…" />
  if (!authUser) return <AuthGate />

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
          rawRows={rawRows}
          prices={prices}
          repoAvailable={repoAvailable}
          clearRepository={clearRepository}
          backToLanding={handleBackToLanding}
          toggleFlag={toggleFlag}
          loadFromFile={loadFromFile}
          loadFromDrive={loadFromDrive}
          driveErr={driveErr}
          setDriveErr={setDriveErr}
          onRepoUpdated={refreshRepoAvailable}
          pricesLoading={pricesLoading}
          pricesError={pricesError}
          priceSource={priceSource}
          lastPriceUpdate={lastPriceUpdate}
          refreshPrices={refreshPrices}
        />
      )}

      <InstallPrompt />
    </>
  )
}
