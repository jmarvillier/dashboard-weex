/**
 * XperpsView.jsx — Suivi des trades XPERP (futures perpétuels)
 * ─────────────────────────────────────────────────────────────────────────────
 * Lit la collection Firestore `users/{uid}/xperps` (documents figés par le skill,
 * R EXACT via le stop). Composant « fin » : aucune logique de calcul ici — tout
 * vient de useXperps → aggregateXperps. Charte v5 bleu nuit crépusculaire.
 */

import { useState } from 'react'
import { useXperps } from '../../hooks/useXperps.js'
import '../../styles/xperps.css'

/* ── Formatage ─────────────────────────────────────────────────────────────── */
const money = (v, dec = 0) =>
  (v == null || isNaN(v)) ? '—'
    : (v < 0 ? '−' : '') + '$' + Math.abs(v).toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
const rfmt  = (v, dec = 1) => (v == null || isNaN(v)) ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(dec) + 'R'
const pctf  = (v, dec = 2) => (v == null || isNaN(v)) ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(dec) + '%'
const sgn   = v => (v > 0 ? 'xp-pos' : v < 0 ? 'xp-neg' : 'xp-zer')
const shortPair = p => String(p || '').replace(/\/?USDC$|\/?USDT$/i, '')

const PERIODS = [
  { id: 'jour',    label: 'Jour'    },
  { id: 'semaine', label: 'Semaine' },
  { id: 'mois',    label: 'Mois'    },
  { id: 'tout',    label: 'Tout'    },
]

/* ── Courbe d'équité (SVG) ─────────────────────────────────────────────────── */
function EquityChart({ equity, useR }) {
  const W = 560, H = 150, pad = 8
  if (!equity || equity.length === 0) {
    return <div className="xp-empty-inline">Aucune donnée sur la période.</div>
  }
  const vals = equity.map(e => (useR ? e.cumR : e.cum))
  const series = [0, ...vals]
  const mn = Math.min(...series, 0)
  const mx = Math.max(...series, 0)
  const rng = (mx - mn) || 1
  const x = i => pad + (series.length === 1 ? 0 : i * (W - 2 * pad) / (series.length - 1))
  const y = v => H - pad - ((v - mn) / rng) * (H - 2 * pad)
  const pts = series.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const zeroY = y(0).toFixed(1)
  const last = series[series.length - 1]
  const stroke = last >= 0 ? '#3dbf90' : '#d45a50'
  const fill = last >= 0 ? 'rgba(61,191,144,.10)' : 'rgba(212,90,80,.10)'
  const area = `${x(0).toFixed(1)},${zeroY} ${pts} ${x(series.length - 1).toFixed(1)},${zeroY}`

  return (
    <svg className="xp-equity" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img"
         aria-label={`Courbe d'équité cumulée en ${useR ? 'R' : 'USDC'}`}>
      <line x1={pad} y1={zeroY} x2={W - pad} y2={zeroY} stroke="#1a3050" strokeWidth="1" strokeDasharray="3 3" />
      <polygon points={area} fill={fill} />
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(series.length - 1).toFixed(1)} cy={y(last).toFixed(1)} r="3.5" fill={stroke} />
    </svg>
  )
}

/* ── Donut répartition ─────────────────────────────────────────────────────── */
function Donut({ wins, losses, be }) {
  const tot = wins + losses + be
  if (tot === 0) return <div className="xp-empty-inline">—</div>
  const C = 2 * Math.PI * 42
  const seg = (n, col, off) => (
    <circle cx="60" cy="60" r="42" fill="none" stroke={col} strokeWidth="14"
      strokeDasharray={`${(n / tot * C).toFixed(1)} ${C}`}
      strokeDashoffset={`${(-off / tot * C).toFixed(1)}`}
      transform="rotate(-90 60 60)" />
  )
  const wr = (wins + losses) > 0 ? Math.round(wins / (wins + losses) * 100) : 0
  return (
    <svg viewBox="0 0 120 120" width="118" height="118" role="img" aria-label={`Répartition : ${wins} gagnés, ${losses} perdus, ${be} breakeven`}>
      {seg(wins, '#3dbf90', 0)}
      {seg(losses, '#d45a50', wins)}
      {seg(be, '#6e98b6', wins + losses)}
      <text x="60" y="57" textAnchor="middle" fill="#d2e4f0" fontSize="21" fontWeight="700" fontFamily="'Space Mono',monospace">{wr}%</text>
      <text x="60" y="73" textAnchor="middle" fill="#6e98b6" fontSize="8" fontFamily="'Space Mono',monospace">WIN RATE</text>
    </svg>
  )
}

/* ── Vue principale ────────────────────────────────────────────────────────── */
export default function XperpsView() {
  const { period, setPeriod, stats, loading, error, reload, hasData, allCount } = useXperps()
  const [eqUnit, setEqUnit] = useState('usd') // 'usd' | 'r'

  const s = stats
  const pf = s.profitFactor === Infinity ? '∞' : s.profitFactor.toFixed(2)

  const maxHour = Math.max(...s.hours.map(h => Math.abs(h.pnl)), 1)
  const maxDist = Math.max(...s.dist, 1)
  const distLbl = ['>+2R', '+1→2R', '0→1R', '−1→0R', '−2→−1R', '<−2R']
  const distCol = ['#3dbf90', '#3dbf90', '#3dbf90', '#d45a50', '#d45a50', '#d45a50']

  const b = s.best
  const lg = s.longs, sh = s.shorts
  const lgWr = (lg.wins + lg.losses) > 0 ? Math.round(lg.wins / (lg.wins + lg.losses) * 100) : null
  const shWr = (sh.wins + sh.losses) > 0 ? Math.round(sh.wins / (sh.wins + sh.losses) * 100) : null

  return (
    <div className="page-content xp-root">

      {/* En-tête : période + qualité du R + actualiser */}
      <div className="xp-head">
        <div className="period-tabs">
          {PERIODS.map(p => (
            <button key={p.id} className={`ptab${period === p.id ? ' active' : ''}`} onClick={() => setPeriod(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="xp-head-right">
          {hasData && (
            <span className="xp-rquality">
              R exact&nbsp;<b className="xp-pos">{s.exactCount}</b>
              {s.fixedCount > 0 && <> · approx&nbsp;<b className="xp-zer">{s.fixedCount}</b></>}
            </span>
          )}
          <button className="xp-reload" onClick={reload} disabled={loading} aria-label="Actualiser">
            {loading ? '…' : '↻'}
          </button>
        </div>
      </div>

      {loading && !hasData ? (
        <div className="xp-empty"><div className="xp-empty-icon">↻</div><div className="xp-empty-title">Chargement des trades XPERP…</div></div>
      ) : error ? (
        <div className="xp-empty">
          <div className="xp-empty-icon">⚠️</div>
          <div className="xp-empty-title">Impossible de charger la collection</div>
          <div className="xp-empty-sub">{error}</div>
          <button className="xp-retry" onClick={reload}>Réessayer</button>
        </div>
      ) : !hasData ? (
        <div className="xp-empty">
          <div className="xp-empty-icon">🎯</div>
          <div className="xp-empty-title">Aucun trade XPERP en base</div>
          <div className="xp-empty-sub">
            Lance la régularisation OKX (<code>/ydash-regul-okx</code>) pour peupler la collection
            <code>xperps</code>. Chaque position clôturée apparaîtra ici automatiquement.
          </div>
          <button className="xp-retry" onClick={reload}>Actualiser</button>
        </div>
      ) : (
        <>
          {/* ── KPIs ── */}
          <div className="xp-kpis">
            <div className="xp-k">
              <div className={`xp-kv ${sgn(s.pnlNet)}`}>{money(s.pnlNet)}</div>
              <div className="xp-kl">PnL net réalisé</div>
              <div className="xp-ks"><span className={sgn(s.rNet)}>{rfmt(s.rNet)}</span> · {pctf(s.avgRetPct)} moy.</div>
            </div>
            <div className="xp-k">
              <div className="xp-kv">{Math.round(s.winRate)}%</div>
              <div className="xp-kl">Win rate</div>
              <div className="xp-ks"><span className="xp-pos">{s.wins}G</span> · <span className="xp-neg">{s.losses}P</span> · <span className="xp-zer">{s.be}BE</span></div>
            </div>
            <div className="xp-k">
              <div className={`xp-kv ${sgn(s.rNet)}`}>{rfmt(s.rNet)}</div>
              <div className="xp-kl">R net (exact)</div>
              <div className="xp-ks"><span className="xp-pos">+{s.rWon.toFixed(1)}R</span> · <span className="xp-neg">−{s.rLost.toFixed(1)}R</span></div>
            </div>
            <div className="xp-k">
              <div className={`xp-kv ${s.profitFactor >= 1 ? 'xp-pos' : 'xp-neg'}`}>{pf}</div>
              <div className="xp-kl">Profit factor</div>
              <div className="xp-ks">expectancy {rfmt(s.expectancyR, 2)}/trade</div>
            </div>
            <div className="xp-k">
              <div className="xp-kv">{s.total}</div>
              <div className="xp-kl">Trades</div>
              <div className="xp-ks">gain moy {money(s.avgWin)} · perte {money(-s.avgLoss)}</div>
            </div>
          </div>

          {/* ── Équité + répartition ── */}
          <div className="xp-g2">
            <div className="xp-card">
              <div className="xp-card-head">
                <span className="v5-section-title" style={{ margin: 0 }}>Courbe d'équité cumulée</span>
                <div className="xp-toggle">
                  <button className={eqUnit === 'usd' ? 'on' : ''} onClick={() => setEqUnit('usd')}>USDC</button>
                  <button className={eqUnit === 'r' ? 'on' : ''} onClick={() => setEqUnit('r')}>R</button>
                </div>
              </div>
              <EquityChart equity={s.equity} useR={eqUnit === 'r'} />
            </div>

            <div className="xp-card xp-card--center">
              <span className="v5-section-title" style={{ margin: 0, alignSelf: 'flex-start' }}>Répartition</span>
              <Donut wins={s.wins} losses={s.losses} be={s.be} />
              <div className="xp-legend">
                <span><i style={{ background: '#3dbf90' }} />{s.wins} G</span>
                <span><i style={{ background: '#d45a50' }} />{s.losses} P</span>
                <span><i style={{ background: '#6e98b6' }} />{s.be} BE</span>
              </div>
            </div>
          </div>

          {/* ── Long / Short ── */}
          <div className="v5-section-title">Long vs Short</div>
          <div className="xp-ls">
            <div className="xp-lscard">
              <div className="xp-ls-top"><span className="xp-ls-tag xp-ls-long">LONG</span><span className={`xp-ls-pnl ${sgn(lg.pnl)}`}>{money(lg.pnl)}</span></div>
              <div className="xp-ls-meta">{lg.n} trades · {lgWr != null ? lgWr + '% WR' : '—'} · <span className="xp-pos">{lg.wins}G</span>/<span className="xp-neg">{lg.losses}P</span> · {rfmt(lg.rNet)}</div>
            </div>
            <div className="xp-lscard">
              <div className="xp-ls-top"><span className="xp-ls-tag xp-ls-short">SHORT</span><span className={`xp-ls-pnl ${sgn(sh.pnl)}`}>{money(sh.pnl)}</span></div>
              <div className="xp-ls-meta">{sh.n} trades · {shWr != null ? shWr + '% WR' : '—'} · <span className="xp-pos">{sh.wins}G</span>/<span className="xp-neg">{sh.losses}P</span> · {rfmt(sh.rNet)}</div>
            </div>
          </div>

          {/* ── Performance par paire ── */}
          <div className="v5-section-title">Performance par paire</div>
          <div className="xp-card xp-tablewrap">
            <table className="xp-table">
              <thead>
                <tr>
                  <th>Paire</th>
                  <th className="xp-r">Trades</th>
                  <th className="xp-r">Win %</th>
                  <th className="xp-r">PnL</th>
                  <th className="xp-r">R net</th>
                  <th className="xp-r">Ret. moy</th>
                </tr>
              </thead>
              <tbody>
                {s.pairs.map(p => (
                  <tr key={p.pair}>
                    <td className="xp-pn">{shortPair(p.pair)}</td>
                    <td className="xp-r">{p.n}</td>
                    <td className="xp-r">{p.winRate != null ? Math.round(p.winRate) + '%' : '—'}</td>
                    <td className={`xp-r ${sgn(p.pnl)}`}>{money(p.pnl)}</td>
                    <td className={`xp-r ${sgn(p.rNet)}`}>{rfmt(p.rNet)}</td>
                    <td className={`xp-r ${p.avgRetPct == null ? 'xp-zer' : sgn(p.avgRetPct)}`}>{pctf(p.avgRetPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Heatmap par heure + insights ── */}
          <div className="xp-g2b">
            <div className="xp-card">
              <span className="v5-section-title" style={{ margin: '0 0 10px' }}>Quand je performe · par heure (PnL net)</span>
              <div className="xp-hours">
                {s.hours.map(h => {
                  const a = h.n === 0 ? 0 : Math.min(0.82, Math.abs(h.pnl) / maxHour * 0.7 + 0.12)
                  const bg = h.n === 0 ? 'var(--bg3)'
                    : h.pnl > 0 ? `rgba(61,191,144,${a})`
                    : h.pnl < 0 ? `rgba(212,90,80,${a})` : 'var(--bg3)'
                  const strong = h.n > 0 && Math.abs(h.pnl) / maxHour > 0.5
                  return (
                    <div key={h.hour} className="xp-hcell" style={{ background: bg, color: strong ? '#06101c' : 'var(--text2)' }}
                         title={`${h.hour}h — ${h.n} trade(s) — ${money(h.pnl)}`}>
                      <span className="xp-hh">{h.hour}h</span>
                      <span className="xp-hn">{h.n || ''}</span>
                    </div>
                  )
                })}
              </div>
              <div className="xp-hours-legend">chiffre = nb de trades · couleur = PnL net du créneau (heure locale)</div>
            </div>

            <div className="xp-chips">
              <div className="xp-chip">
                <div className="xp-chip-l">Meilleure heure</div>
                <div className="xp-chip-v xp-pos">{b.hour ? `${b.hour.hour}h` : '—'}</div>
                <div className="xp-chip-s">{b.hour ? `${money(b.hour.pnl)} · ${b.hour.n} trades` : ''}</div>
              </div>
              <div className="xp-chip">
                <div className="xp-chip-l">Meilleur jour</div>
                <div className="xp-chip-v xp-pos">{b.dow ? b.dow.label : '—'}</div>
                <div className="xp-chip-s">{b.dow ? `${money(b.dow.pnl)} · ${b.dow.n} trades` : ''}</div>
              </div>
              <div className="xp-chip">
                <div className="xp-chip-l">Top paire</div>
                <div className="xp-chip-v xp-pos">{b.pair ? shortPair(b.pair.pair) : '—'}</div>
                <div className="xp-chip-s">{b.pair ? `${money(b.pair.pnl)} · ${rfmt(b.pair.rNet)}` : ''}</div>
              </div>
              <div className="xp-chip">
                <div className="xp-chip-l">Paire à revoir</div>
                <div className="xp-chip-v xp-neg">{b.worstPair ? shortPair(b.worstPair.pair) : '—'}</div>
                <div className="xp-chip-s">{b.worstPair ? `${money(b.worstPair.pnl)} · ${rfmt(b.worstPair.rNet)}` : ''}</div>
              </div>
            </div>
          </div>

          {/* ── Distribution en R ── */}
          <div className="v5-section-title">
            Distribution des trades (en R){s.fixedCount > 0 && <span className="xp-approx"> · {s.fixedCount} en R approx.</span>}
          </div>
          <div className="xp-card">
            <div className="xp-dist">
              {s.dist.map((n, i) => (
                <div key={i} className="xp-db">
                  <div className="xp-dbc" style={{ color: distCol[i] }}>{n}</div>
                  <div className="xp-dbar" style={{ height: `${Math.max(3, n / maxDist * 92)}px`, background: distCol[i] }} />
                  <div className="xp-dbl">{distLbl[i]}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="xp-foot">{s.total} trade(s) sur {allCount} en base · R exact via le stop, PnL net de frais + funding · heure locale Europe/Paris</div>
        </>
      )}
    </div>
  )
}
