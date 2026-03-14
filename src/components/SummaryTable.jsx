/**
 * SummaryTable.jsx — Dashboard v5
 * ─────────────────────────────────────────────────────────────────────────────
 * Tableau récapitulatif par paire, filtré sur la période sélectionnée.
 * Colonnes : Paire · Investi · Valeur act. · Breakeven · PnL réalisé · PnL latent · PnL total
 *
 * Reçoit :
 *   rows      {Array}  — données pré-agrégées par usePeriodFilter
 *   pairList  {Array}  — fallback ancienne API
 *   excluded  {Set}    — fallback ancienne API
 */

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const fmtN = (v, d = 2) =>
  isNaN(+v) ? '—' : (+v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })

const fmtV = v => {
  if (isNaN(+v)) return '—'
  const n = +v
  if (n === 0) return '0'
  const dec = n >= 1 ? 4 : n >= 0.01 ? 6 : 8
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: dec })
}

const fmtS = v => {
  const n = +v
  if (isNaN(n)) return '—'
  return (n >= 0 ? '+ ' : '− ') + fmtN(Math.abs(n))
}

const fmtPct = (val, ref) => {
  if (!ref || isNaN(+val) || isNaN(+ref) || +ref === 0) return ''
  const p = ((+val) / (+ref)) * 100
  return (p >= 0 ? '+ ' : '− ') + fmtN(Math.abs(p), 1) + ' %'
}

const cc = v => (isNaN(+v) ? '' : +v > 0 ? 'v5-pos' : +v < 0 ? 'v5-neg' : 'v5-neu')

/* ── Cellule PnL avec sous-label % ──────────────────────────────────────── */
function PnlCell({ value, pct, dash = false }) {
  if (dash || value == null || isNaN(+value)) {
    return <td className="v5-td v5-td-r v5-neu">—</td>
  }
  const cls = cc(value)
  return (
    <td className={`v5-td v5-td-r ${cls}`}>
      {fmtS(value)}
      {pct !== '' && pct != null && (
        <div className={`v5-tbl-pct ${cls}`}>{pct}</div>
      )}
    </td>
  )
}

/* ── Row paire ───────────────────────────────────────────────────────────── */
function PairRow({ row, period }) {
  const { name, investi, valActuelle, breakeven, pnlRealise, pnlLatent } = row
  const pnlTotal = (pnlRealise || 0) + (pnlLatent || 0)

  // Sur période courte (1j), certaines colonnes peuvent être sans données
  const noData = period === '1j' && investi === 0

  return (
    <tr className="v5-tr">
      <td className="v5-td v5-td-pair">{name}</td>
      <td className="v5-td v5-td-r">{fmtN(investi)}</td>
      <td className="v5-td v5-td-r">{noData || !valActuelle ? '—' : fmtN(valActuelle)}</td>
      <td className="v5-td v5-td-r">{noData || !breakeven ? '—' : fmtV(breakeven)}</td>
      <PnlCell value={pnlRealise} pct={fmtPct(pnlRealise, investi)} dash={noData} />
      <PnlCell value={pnlLatent}  pct={fmtPct(pnlLatent,  investi)} dash={noData} />
      <PnlCell value={pnlTotal}   pct={fmtPct(pnlTotal,   investi)} dash={noData} />
    </tr>
  )
}

/* ── Row total ───────────────────────────────────────────────────────────── */
function TotalRow({ rows }) {
  const sInv  = rows.reduce((s, r) => s + (r.investi    || 0), 0)
  const sVal  = rows.reduce((s, r) => s + (r.valActuelle || 0), 0)
  const sReal = rows.reduce((s, r) => s + (r.pnlRealise  || 0), 0)
  const sLat  = rows.reduce((s, r) => s + (r.pnlLatent   || 0), 0)
  const sTot  = sReal + sLat

  return (
    <tr className="v5-tr v5-tr--total">
      <td className="v5-td v5-td-pair v5-td-total-lbl">Total</td>
      <td className="v5-td v5-td-r">{fmtN(sInv)}</td>
      <td className="v5-td v5-td-r">{sVal ? fmtN(sVal) : '—'}</td>
      <td className="v5-td v5-td-r v5-neu">—</td>
      <PnlCell value={sReal} pct={fmtPct(sReal, sInv)} />
      <PnlCell value={sLat}  pct={fmtPct(sLat,  sInv)} />
      <PnlCell value={sTot}  pct={fmtPct(sTot,  sInv)} />
    </tr>
  )
}

/* ── Composant principal ─────────────────────────────────────────────────── */
export default function SummaryTable({
  // Nouvelle API v5
  rows,
  period = 'tout',

  // Ancienne API (fallback)
  pairList,
  excluded,
}) {
  // Fallback : construit des rows depuis pairList
  let tableRows = rows
  if (!tableRows && pairList) {
    tableRows = pairList
      .filter(p => !p.is_depot && (!excluded || !excluded.has(p.name)))
      .map(p => ({
        name:        p.name,
        investi:     p.usdt_investi || 0,
        valActuelle: (p.usdt_investi || 0) + (p.pnl_latent_live ?? p.pnl_latent ?? 0),
        breakeven:   p.prix_moy || 0,
        pnlRealise:  p.pnl_realise_live ?? p.pnl_realise ?? 0,
        pnlLatent:   p.pnl_latent_live  ?? p.pnl_latent  ?? 0,
      }))
  }

  if (!tableRows || tableRows.length === 0) {
    return (
      <div className="v5-tbl-wrap">
        <div className="v5-tbl-empty">Aucune donnée à afficher pour cette période.</div>
      </div>
    )
  }

  return (
    <div className="v5-tbl-wrap">
      <table className="v5-tbl">
        <thead>
          <tr className="v5-thead-tr">
            <th className="v5-th v5-th-l">Paire</th>
            <th className="v5-th v5-th-r">Investi</th>
            <th className="v5-th v5-th-r">Valeur act.</th>
            <th className="v5-th v5-th-r">Breakeven</th>
            <th className="v5-th v5-th-r">PnL réalisé</th>
            <th className="v5-th v5-th-r">PnL latent</th>
            <th className="v5-th v5-th-r">PnL total</th>
          </tr>
        </thead>
        <tbody>
          {tableRows.map(row => (
            <PairRow key={row.name} row={row} period={period} />
          ))}
          {tableRows.length > 1 && <TotalRow rows={tableRows} />}
        </tbody>
      </table>
    </div>
  )
}
