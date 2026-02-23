const fmt  = (v, d = 2) => isNaN(+v) ? '—' : (+v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })
const fmtS = v => { const n = +v; return isNaN(n) ? '—' : (n >= 0 ? '+ ' : '- ') + fmt(Math.abs(n)) }
const cc   = v => v > 0 ? 'g' : v < 0 ? 'r' : ''

export default function KpiRow({ pairList, excluded }) {
  const active   = pairList.filter(p => !excluded.has(p.name))
  const sDepose  = pairList.reduce((s, p) => s + p.capital_depose, 0)
  const sInv     = active.filter(p => !p.is_depot).reduce((s, p) => s + p.usdt_investi, 0)
  const sPnlR    = active.filter(p => !p.is_depot).reduce((s, p) => s + p.pnl_realise, 0)
  const sPnlL    = active.filter(p => !p.is_depot).reduce((s, p) => s + p.pnl_latent, 0)
  const sPnl     = sPnlR + sPnlL
  const sTot     = active.reduce((s, p) => s + p.nb_total, 0)
  const sExec    = active.reduce((s, p) => s + p.nb_exec, 0)
  const sCanc    = active.reduce((s, p) => s + p.nb_annule, 0)
  const ePct     = sTot > 0 ? sExec / sTot * 100 : 0
  const nActif   = active.filter(p => !p.is_depot).length

  const kpis = [
    { l: 'Capital Déposé',  v: fmt(sDepose) + ' USDT',   c: 'o', s: 'Total des dépôts effectués' },
    { l: 'Capital Investi', v: fmt(sInv)    + ' USDT',   c: 'o', s: `${nActif} paires actives` },
    { l: 'PnL Réalisé',     v: fmtS(sPnlR)  + ' USDT',  c: cc(sPnlR), s: 'Gains/pertes clôturés' },
    { l: 'PnL Latent',      v: fmtS(sPnlL)  + ' USDT',  c: cc(sPnlL), s: 'Positions ouvertes' },
    { l: 'PnL Total',       v: fmtS(sPnl)   + ' USDT',  c: cc(sPnl),  s: 'Réalisé + Latent' },
    { l: 'Total Ordres',    v: sTot,                      c: '',        s: `${sExec} exec · ${sCanc} annulés` },
    { l: 'Taux Exécution',  v: fmt(ePct, 1) + '%',        c: '',        s: 'Ordres exécutés / total' },
  ]

  return (
    <div className="kpi-row">
      {kpis.map((k, i) => (
        <div key={k.l} className="kpi" style={{ animationDelay: `${i * .07}s` }}>
          <div className="kpi-l">{k.l}</div>
          <div className={`kpi-v ${k.c}`}>{k.v}</div>
          <div className="kpi-s">{k.s}</div>
        </div>
      ))}
    </div>
  )
}
