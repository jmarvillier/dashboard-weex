import { useState, useEffect }       from 'react'
import { useTrading }                 from './hooks/useTrading.js'
import LoadingOverlay                 from './components/LoadingOverlay.jsx'
import AppShell                       from './components/AppShell.jsx'
import InstallPrompt                  from './components/InstallPrompt.jsx'
import AuthGate                       from './components/AuthGate.jsx'
import { auth, onAuthStateChanged }   from './lib/firebase.js'

export default function App() {
  const [authUser, setAuthUser] = useState(undefined)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      setAuthUser(user ?? null)
    })
    return unsub
  }, [])

  // Reload unique quand un nouveau SW prend le contrôle
  useEffect(() => {
    let reloading = false
    const handler = () => {
      if (reloading) return
      reloading = true
      console.log('[App] Nouveau SW actif → reload')
      window.location.reload()
    }
    navigator.serviceWorker?.addEventListener('controllerchange', handler)
    return () => navigator.serviceWorker?.removeEventListener('controllerchange', handler)
  }, [])

  const {
    loading, loadingTxt,
    fileName, loadedAt, pairList, excluded, driveErr,
    repoAvailable,
    pricesLoading, pricesError, priceSource, lastPriceUpdate, refreshPrices,
    setDriveErr,
    openFromRepository,
    loadFromFile,
    loadFromDrive,
    clearRepository,
    refreshRepoAvailable,
    toggleFlag,
  } = useTrading()

  const [activePage, setActivePage] = useState('dashboard')

  // Dès que l'utilisateur est authentifié, on charge les données depuis le repo
  useEffect(() => {
    if (authUser) openFromRepository()
  }, [authUser])

  if (authUser === undefined) return <LoadingOverlay visible text="Vérification…" />
  if (!authUser) return <AuthGate />

  return (
    <>
      <LoadingOverlay visible={loading} text={loadingTxt} />
      <AppShell
        activePage={activePage}
        setActivePage={setActivePage}
        fileName={fileName}
        loadedAt={loadedAt}
        excluded={excluded}
        pairList={pairList}
        repoAvailable={repoAvailable}
        clearRepository={clearRepository}
        backToLanding={() => {}}
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
      <InstallPrompt />
    </>
  )
}
