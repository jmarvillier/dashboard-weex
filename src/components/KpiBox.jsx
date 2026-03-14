/**
 * KpiBox.jsx
 * Case métrique réutilisable avec tooltip optionnel
 */
import KpiTooltip from './KpiTooltip.jsx'

export default function KpiBox({
  label,
  value,
  sublabel,
  tooltipTitle,
  tooltipDesc,
  tooltipFormula,
  valueColor = 'default', // 'default' | 'pos' | 'neg' | 'neu'
  openId,
  setOpenId,
  tooltipId,
  fullWidth = false,
}) {
  const colorClass = {
    pos: 'kpi-val-pos',
    neg: 'kpi-val-neg',
    neu: 'kpi-val-neu',
    default: '',
  }[valueColor] || ''

  return (
    <div className={`kpi-box${fullWidth ? ' kpi-box-full' : ''}`}>
      <div className="kpi-box-label">
        {label}
        {tooltipId && (
          <KpiTooltip
            id={tooltipId}
            title={tooltipTitle}
            description={tooltipDesc}
            formula={tooltipFormula}
            openId={openId}
            setOpenId={setOpenId}
          />
        )}
      </div>
      <div className={`kpi-box-value ${colorClass}`}>{value}</div>
      {sublabel && <div className="kpi-box-sublabel">{sublabel}</div>}
    </div>
  )
}
