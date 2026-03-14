import KpiTooltip from './KpiTooltip.jsx'

export default function KpiBox({
  label, value, sublabel,
  valueColor = 'default',
  tooltipId, tooltipTitle, tooltipDesc, tooltipFormula,
  openId, setOpenId,
}) {
  const vc = { pos: 'pos', neg: 'neg', neu: 'neu', default: '' }[valueColor] || ''

  return (
    <div className="kb">
      <div className="kb-label">
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
      <div className={`kb-val${vc ? ' ' + vc : ''}`}>{value}</div>
      {sublabel && <div className="kb-sub">{sublabel}</div>}
    </div>
  )
}
