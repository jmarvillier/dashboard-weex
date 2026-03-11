import { useState, useEffect }       from 'react'
import { useTrading }                 from './hooks/useTrading.js'
import LoadingOverlay                 from './components/LoadingOverlay.jsx'
import Landing                        from './components/Landing.jsx'
import AppShell                       from './components/AppShell.jsx'
import InstallPrompt                  from './components/InstallPrompt.jsx'
import AuthGate                       from './components/AuthGate.jsx'
import { auth, onAuthStateChanged }   from './lib/firebase.js'

export default function App() {
  const [authUser, setAuthUser]     = useState(undefined)  // undefined = vérif en cours
  const [authUid, setAuthUid]       = useState(null)       // uid de l'utilisateur actif

  // Écoute l'état de connexion Firebase
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      setAuthUser(user ?? null)
      setAuthUid(user?.uid ?? null)
    })
    return unsub
  }, [])

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

  const [activePage, setActivePage] = useState('dashboard')

  useEffect(() => {
    if (view === 'landing') setActivePage('dashboard')
  }, [view])

  // Quand l'utilisateur change (déconnexion / reconnexion avec autre compte)
  // → on revient sur la landing pour forcer un rechargement propre des données
  useEffect(() => {
    if (authUid !== null) {
      backToLanding()
    }
  }, [authUid])

  const handleEnterApp = (page = 'dashboard') => {
    setActivePage(page)
    openFromRepository()
  }

  const handleBackToLanding = () => {
    setActivePage('dashboard')
    backToLanding()
  }

  // Vérification auth en cours → écran vide (évite le flash)
  if (authUser === undefined) {
    return <LoadingOverlay visible text="Vérification…" />
  }

  // Non connecté → AuthGate
  if (!authUser) {
    return <AuthGate />
  }

  // Connecté → app normale
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
