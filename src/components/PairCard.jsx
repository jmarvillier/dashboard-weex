/**
 * PairCard.jsx
 */

const fmt  = (v, d = 2) => isNaN(+v) ? '—' : (+v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })
const fmtV = v => {
  if (isNaN(+v)) return '—'
  const n = +v
  if (n === 0) return '0'
  const dec = n >= 1 ? 4 : n >= 0.01 ? 6 : 8
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: dec })
}
const fmtS    = v => { const n = +v; return isNaN(n) ? '—' : (n >= 0 ? '+' : '−') + ' ' + fmt(Math.abs(n)) }
const cc      = v => v > 0 ? 'g' : v < 0 ? 'r' : 'n'
const pctSign = (val, ref) => {
  if (!(ref > 0)) return null
  const pp = val / ref * 100
  return (pp >= 0 ? '+' : '−') + ' ' + fmt(Math.abs(pp), 1) + ' %'
}

export default function PairCard({ p, excluded, onToggle, index }) {
  const isExcl = excluded.has(p.name)
  const sym    = p.name.split('/')[0]

  // Utilise cours_live (nouveau nom) — jamais de variable libre
  const coursLive    = p.cours_live        != null ? p.cours_live        : null
  const pnlRLive     = p.pnl_realise_live  != null ? p.pnl_realise_live  : null
  const pnlLLive     = p.pnl_latent_live   != null ? p.pnl_latent_live   : null
  const pnlTLive     = p.pnl_total_live    != null ? p.pnl_total_live    : null
  const hasLive      = pnlTLive != null

  const badgePnl   = hasLive ? pnlTLive : p.pnl_total
  const badgeRef   = p.usdt_investi
  const badgeClass = p.is_depot ? 'n' : cc(badgePnl)
  const execRate   = p.nb_total > 0 ? (p.nb_exec / p.nb_total * 100) : 0

  return (
    <div
      className={`pc${isExcl ? ' excluded' : ''}`}
      id={`pc-${p.name.replace(/\//g, '_')}`}
      style={{ animationDelay: `${index * 0.08}s` }}
    >
      {/* ── Header ── */}
      <div className="pc-head">
        <div className="pc-head-left">
          <div className="pc-name">{p.name}</div>
          <div className="pc-sub">
            {p.is_depot
              ? `${p.nb_depot} dépôt${p.nb_depot > 1 ? 's' : ''}`
              : `${p.nb_exec} exéc · ${p.nb_annule} annulés`
            }
          </div>
          {!p.is_depot && coursLive != null && (
            <div className="pc-price-live">
              <span className="live-dot live-dot-sm"></span>
              <span>{fmt(coursLive)} USDT</span>
            </div>
          )}
        </div>
        <div className="pc-head-right">
          {!p.is_depot && (
            <div className={`pc-pnl-badge ${badgeClass}`}>
              <span className="pc-pnl-usdt">{fmtS(badgePnl)} USDT</span>
              {pctSign(badgePnl, badgeRef) && (
                <span className="pc-pnl-pct">{pctSign(badgePnl, badgeRef)}</span>
              )}
              {hasLive && <span className="pc-pnl-source">live</span>}
            </div>
          )}
          {p.is_depot && (
            <div className="pc-pnl-badge n">💰 {fmt(p.capital_depose)} USDT</div>
          )}
          <button
            className={`flag-btn${isExcl ? ' flagged' : ''}`}
            onClick={() => onToggle(p.name)}
          >
            {isExcl ? '🚩' : '🏳'}
          </button>
        </div>
      </div>

      {isExcl && <div className="excluded-banner">🚩 Paire exclue des calculs globaux</div>}

      {/* ── Body ── */}
      <div className="pc-body">
        {p.is_depot ? (
          <div className="depot-body">
            <div className="depot-stat">
              <span className="depot-val o">{fmt(p.capital_depose)}</span>
              <span className="depot-unit">USDT déposés</span>
            </div>
            <div className="depot-stat">
              <span className="depot-val">{p.nb_depot}</span>
              <span className="depot-unit">opération{p.nb_depot > 1 ? 's' : ''}</span>
            </div>
            <div className="depot-note">Apport de capital — exclu des calculs PnL</div>
          </div>
        ) : (
          <>
            {/* ── Métriques ── */}
            <div className="metrics-grid">
              <div className="m-cell">
                <div className="ml">Investi</div>
                <div className="mv o">{fmt(p.investi_en_cours)}</div>
                <div className="mv-sub">
                  {p.investi_en_cours !== p.usdt_investi ? `/ ${fmt(p.usdt_investi)} total` : 'USDT'}
                </div>
              </div>
              <div className="m-cell">
                <div className="ml">Vol. Acheté</div>
                <div className="mv b">{fmtV(p.vol_achete)}</div>
                <div className="mv-sub">{sym}</div>
              </div>
              <div className="m-cell">
                <div className="ml">Vol. Vendu</div>
                <div className="mv">{fmtV(p.vol_vendu)}</div>
                <div className="mv-sub">{sym}</div>
              </div>

              {p.position !== 0 && <>
                <div className="m-cell">
                  <div className="ml">Position</div>
                  <div className={`mv ${p.position > 0 ? 'g' : 'r'}`}>{fmtV(p.position)}</div>
                  <div className="mv-sub">{sym}</div>
                </div>
                <div className="m-cell">
                  <div className="ml">Prix Moy. Achat</div>
                  <div className="mv">{p.prix_moy > 0 ? fmt(p.prix_moy) : '—'}</div>
                  <div className="mv-sub">USDT</div>
                </div>
                <div className="m-cell">
                  <div className="ml">Dernier Prix</div>
                  <div className="mv">{p.last_prix_achat > 0 ? fmt(p.last_prix_achat) : '—'}</div>
                  <div className="mv-sub">achat USDT</div>
                </div>
              </>}

              {p.vol_vendu > 0 && <>
                <div className="m-cell">
                  <div className="ml">Prix Moy. Vente</div>
                  <div className={`mv ${p.prix_moy_vente > p.prix_moy ? 'g' : p.prix_moy_vente < p.prix_moy && p.prix_moy > 0 ? 'r' : ''}`}>
                    {p.prix_moy_vente > 0 ? fmt(p.prix_moy_vente) : '—'}
                  </div>
                  <div className="mv-sub">USDT</div>
                </div>
                <div className="m-cell">
                  <div className="ml">Dernier Prix</div>
                  <div className={`mv ${p.last_prix_vente > p.prix_moy ? 'g' : p.last_prix_vente < p.prix_moy && p.prix_moy > 0 ? 'r' : ''}`}>
                    {p.last_prix_vente > 0 ? fmt(p.last_prix_vente) : '—'}
                  </div>
                  <div className="mv-sub">vente USDT</div>
                </div>
              </>}
            </div>

            {/* ── PnL Journal ── */}
            <div className="pnl-section-label">
              📒 PnL Journal <span className="pnl-section-hint">(dernier prix saisi)</span>
            </div>
            <div className="pnl-row">
              {[
                { l: 'PnL Réalisé', v: p.pnl_realise, ref: p.usdt_investi },
                { l: 'PnL Latent',  v: p.pnl_latent,  ref: p.investi_en_cours },
                { l: 'PnL Total',   v: p.pnl_total,   ref: p.usdt_investi, big: true },
              ].map(({ l, v, ref, big }) => (
                <div key={l} className={`pnl-box ${cc(v)}`}>
                  <div className="pnl-label">{l}</div>
                  <div className={`pnl-val ${cc(v)}${big ? ' pnl-val-big' : ''}`}>
                    {fmtS(v)} <span className="pnl-unit">USDT</span>
                  </div>
                  {pctSign(v, ref) && (
                    <div className={`pnl-pct ${cc(v)}`}>{pctSign(v, ref)}</div>
                  )}
                </div>
              ))}
            </div>

            {/* ── PnL Live ── */}
            <div className="pnl-section-label pnl-section-label-live">
              <span className="live-dot live-dot-sm"></span>
              PnL Live <span className="pnl-section-hint">(cours actuel)</span>
              {coursLive != null && (
                <span className="pnl-live-price">{fmt(coursLive)} USDT</span>
              )}
            </div>
            <div className="pnl-row">
              {[
                { l: 'PnL Réalisé', v: pnlRLive, ref: p.usdt_investi },
                { l: 'PnL Latent',  v: pnlLLive, ref: p.investi_en_cours },
                { l: 'PnL Total',   v: pnlTLive, ref: p.usdt_investi, big: true },
              ].map(({ l, v, ref, big }) => (
                <div key={l} className={`pnl-box pnl-box-live ${v != null ? cc(v) : 'n'}`}>
                  <div className="pnl-label">{l}</div>
                  {v != null ? (
                    <>
                      <div className={`pnl-val ${cc(v)}${big ? ' pnl-val-big' : ''}`}>
                        {fmtS(v)} <span className="pnl-unit">USDT</span>
                      </div>
                      {pctSign(v, ref) && (
                        <div className={`pnl-pct ${cc(v)}`}>{pctSign(v, ref)}</div>
                      )}
                    </>
                  ) : (
                    <div className="pnl-val pnl-val-pending">—</div>
                  )}
                </div>
              ))}
            </div>

            {/* ── Stats ── */}
            <div className="tbar">
              {[
                { cls: 'tot', v: p.nb_total,  l: 'Total'   },
                { cls: 'exc', v: p.nb_exec,   l: 'Exec.'   },
                { cls: 'can', v: p.nb_annule, l: 'Annulés' },
                { cls: 'buy', v: p.nb_achat,  l: 'Achats'  },
                { cls: 'sel', v: p.nb_vente,  l: 'Ventes'  },
              ].map(({ cls, v, l }) => (
                <div key={l} className={`tc ${cls}`}>
                  <span className="tn">{v}</span>
                  <span className="tl">{l}</span>
                </div>
              ))}
              <div className="tc rate">
                <span className="tn">{fmt(execRate, 0)}%</span>
                <span className="tl">Taux</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
