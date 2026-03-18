/**
 * DcaStepper.jsx — Indicateur de progression du wizard DCA
 */

/* ── Stepper ─────────────────────────────────────────────────────────────── */
function Stepper({ step }) {
  const steps = [['Paire','& période'],['Pointage','opérations'],['Paramètres','stratégie']]
  return (
    <div className="dca-stepper">
      {steps.map(([label, sub], i) => {
        const done = i+1 < step, active = i+1 === step
        return (
          <span key={i} style={{display:'contents'}}>
            <div className={`dca-step${active?' active':done?' done':''}`}>
              <div className="dca-step-circle">{done ? '✓' : i+1}</div>
              <div className="dca-step-text">{label}<br/>{sub}</div>
            </div>
            {i < steps.length-1 && <div className={`dca-step-line${done?' done':''}`}/>}
          </span>
        )
      })}
    </div>
  )
}

export default Stepper
