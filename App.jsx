import { useTrading }      from './hooks/useTrading.js'
import LoadingOverlay      from './components/LoadingOverlay.jsx'
import Landing             from './components/Landing.jsx'
import Topbar              from './components/Topbar.jsx'
import KpiRow              from './components/KpiRow.jsx'
import PairCard            from './components/PairCard.jsx'
import SummaryTable        from './components/SummaryTable.jsx'

export default function App() {
  const {
    view, zone, loading, loadingTxt,
    fileName, loadedAt, pairList, excluded, driveErr,
    setZone, setDriveErr,
    loadDefault, reloadDefault, loadFromDrive, loadFromFile,
    toggleFlag, backToLanding,
  } = useTrading()

  return (
    <>
      {/* ── Loading overlay ── */}
      <LoadingOverlay visible={loading} text={loadingTxt} />

      {/* ── Landing ── */}
      {view === 'landing' && (
        <Landing
          zone={zone}
          setZone={setZone}
          driveErr={driveErr}
          setDriveErr={setDriveErr}
          loadDefault={loadDefault}
          loadFromDrive={loadFromDrive}
          loadFromFile={loadFromFile}
        />
      )}

      {/* ── Dashboard ── */}
      {view === 'dashboard' && (
        <div id="dashboard" style={{ display: 'block' }}>
          <Topbar
            fileName={fileName}
            loadedAt={loadedAt}
            excluded={excluded}
            reloadDefault={reloadDefault}
            backToLanding={backToLanding}
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
    </>
  )
}
