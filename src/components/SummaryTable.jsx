const fmt  = (v, d = 2) => isNaN(+v) ? '—' : (+v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })
const fmtV = v => {
  if (isNaN(+v)) return '—'
  const n = +v; if (n === 0) return '0'
  const dec = n >= 1 ? 4 : n >= 0.01 ? 6 : 8
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: dec })
}
const fmtS = v => { const n = +v; return isNaN(n) ? '—' : (n >= 0 ? '+ ' : '- ') + fmt(Math.abs(n)) }
const cc   = v => v > 0 ? 'cg' : v < 0 ? 'cr' : 'c2'

export default function SummaryTable({ pairList, excluded }) {
  return (
    <div className="tbl-wrap">
      <table>
        <thead>
          <tr>
            <th>Paire</th>
            <th>Investi (USDT)</th>
            <th>Vol. Acheté</th>
            <th>Vol. Vendu</th>
            <th>Position</th>
            <th>Prix Moy. Achat</th>
            <th>Dernier Prix Achat</th>
            <th>PnL Réalisé</th>
            <th>PnL Latent</th>
            <th>PnL Total</th>
            <th>Trades</th>
            <th>Exec.</th>
            <th>Annulés</th>
          </tr>
        </thead>
        <tbody>
          {pairList.map(p => {
            const isExcl = excluded.has(p.name)
            return (
              <tr key={p.name} id={`tr-${p.name.replace(/\//g,'_')}`} className={isExcl ? 'excluded-row' : ''}>
                <td>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {p.name}
                    {isExcl && <span style={{ fontSize: '.65rem' }}>🚩</span>}
                    {p.is_depot && (
                      <span style={{ fontSize: '.55rem', background: 'rgba(232,184,75,.15)', color: 'var(--gold)', padding: '1px 5px', borderRadius: 3, letterSpacing: '.06em' }}>
                        DÉPÔT
                      </span>
                    )}
                  </span>
                </td>
                <td className="co bold">{fmt(p.usdt_investi)}</td>
                <td className="cb">{fmtV(p.vol_achete)}</td>
                <td className="c2">{fmtV(p.vol_vendu)}</td>
                <td className={p.position > 0 ? 'cg' : p.position < 0 ? 'cr' : 'c2'}>{fmtV(p.position)}</td>
                <td className="c2">{p.prix_moy > 0 ? fmt(p.prix_moy) : '—'}</td>
                <td className="c2">{p.last_prix_achat > 0 ? fmt(p.last_prix_achat) : '—'}</td>
                <td className={`${cc(p.pnl_realise)} bold`}>{fmtS(p.pnl_realise)}</td>
                <td className={cc(p.pnl_latent)}>{fmtS(p.pnl_latent)}</td>
                <td className={`${cc(p.pnl_total)} bold`}>{fmtS(p.pnl_total)}</td>
                <td>{p.nb_total}</td>
                <td className="cg">{p.nb_exec}</td>
                <td className="c2">{p.nb_annule}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
