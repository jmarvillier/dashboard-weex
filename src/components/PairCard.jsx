const fmt  = (v, d = 2) => isNaN(+v) ? '—' : (+v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })
const fmtV = v => {
  if (isNaN(+v)) return '—'
  const n = +v; if (n === 0) return '0'
  const dec = n >= 1 ? 4 : n >= 0.01 ? 6 : 8
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: dec })
}
const fmtS = v => { const n = +v; return isNaN(n) ? '—' : (n >= 0 ? '+ ' : '- ') + fmt(Math.abs(n)) }
const cc   = v => v > 0 ? 'g' : v < 0 ? 'r' : 'n'

export default function PairCard({ p, excluded, onToggle, index }) {
  const isExcl  = excluded.has(p.name)
  const bc      = p.is_depot ? 'n' : cc(p.pnl_total)
  const sym     = p.name.split('/')[0]

  return (
    <div
      className={`pc${isExcl ? ' excluded' : ''}`}
      id={`pc-${p.name.replace(/\//g,'_')}`}
      style={{ animationDelay: `${index * .08}s` }}
    >
      {/* ── Header ── */}
      <div className="pc-head">
        <div>
          <div className="pc-name">{p.name}</div>
          <div className="pc-sub">
            {p.is_depot
              ? `${p.nb_depot} dépôt${p.nb_depot > 1 ? 's' : ''} · ${fmt(p.capital_depose)} USDT`
              : `${p.nb_exec} exécutés · ${p.nb_annule} annulés · ${p.nb_achat} achats · ${p.nb_vente} ventes`
            }
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {p.is_depot
            ? <div className="badge n">💰 {fmt(p.capital_depose)} USDT déposés</div>
            : <div className={`badge ${bc}`}>{fmtS(p.pnl_total)} USDT</div>
          }
          <button
            className={`flag-btn${isExcl ? ' flagged' : ''}`}
            onClick={() => onToggle(p.name)}
          >
            {isExcl ? '🚩 Exclue' : '🏳 Exclure'}
          </button>
        </div>
      </div>

      <div className="excluded-banner">🚩 Paire exclue des calculs globaux</div>

      {/* ── Body ── */}
      <div className="pc-body">
        {p.is_depot ? (
          <>
            <div className="metrics-main">
              <div className="m-cell">
                <div className="ml">Total Déposé</div>
                <div className="mv o">{fmt(p.capital_depose)}</div>
                <div className="mv-sub">USDT</div>
              </div>
              <div className="m-cell">
                <div className="ml">Nb Dépôts</div>
                <div className="mv b">{p.nb_depot}</div>
                <div className="mv-sub">opération{p.nb_depot > 1 ? 's' : ''}</div>
              </div>
              <div className="m-cell">
                <div className="ml">Devise</div>
                <div className="mv">{p.name}</div>
                <div className="mv-sub">stablecoin</div>
              </div>
            </div>
            <div style={{ padding: '8px 0', fontSize: '.6rem', color: 'var(--text2)', textAlign: 'center', letterSpacing: '.06em' }}>
              Apport de capital — exclu des calculs PnL par défaut
            </div>
          </>
        ) : (
          <>
            {/* Métriques */}
            <div className="metrics-main">
              <div className="m-cell">
                <div className="ml">Investi</div>
                <div className="mv o">
                  {fmt(p.investi_en_cours)}{' '}
                  <span style={{ fontSize: '.65rem', color: 'var(--text2)', fontWeight: 400 }}>/ {fmt(p.usdt_investi)}</span>
                </div>
                <div className="mv-sub">en cours / total USDT</div>
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

              {(p.position !== 0 || p.prix_moy > 0) && (<>
                <div className="m-cell">
                  <div className="ml">Position</div>
                  <div className={`mv ${p.position > 0 ? 'g' : p.position < 0 ? 'r' : ''}`}>{fmtV(p.position)}</div>
                  <div className="mv-sub">{sym}</div>
                </div>
                <div className="m-cell">
                  <div className="ml">Prix Moy. Achat</div>
                  <div className="mv">{p.prix_moy > 0 ? fmt(p.prix_moy) : '—'}</div>
                  <div className="mv-sub">USDT</div>
                </div>
                <div className="m-cell">
                  <div className="ml">Dernier Prix Achat</div>
                  <div className="mv">{p.last_prix_achat > 0 ? fmt(p.last_prix_achat) : '—'}</div>
                  <div className="mv-sub">USDT</div>
                </div>

                {p.vol_vendu > 0 && (<>
                  <div className="m-cell">
                    <div className="ml">Prix Moy. Vente</div>
                    <div className={`mv ${p.prix_moy_vente > p.prix_moy ? 'g' : p.prix_moy_vente < p.prix_moy && p.prix_moy > 0 ? 'r' : ''}`}>
                      {p.prix_moy_vente > 0 ? fmt(p.prix_moy_vente) : '—'}
                    </div>
                    <div className="mv-sub">USDT</div>
                  </div>
                  <div className="m-cell">
                    <div className="ml">Dernier Prix Vente</div>
                    <div className={`mv ${p.last_prix_vente > p.prix_moy ? 'g' : p.last_prix_vente < p.prix_moy && p.prix_moy > 0 ? 'r' : ''}`}>
                      {p.last_prix_vente > 0 ? fmt(p.last_prix_vente) : '—'}
                    </div>
                    <div className="mv-sub">USDT</div>
                  </div>
                </>)}
              </>)}
            </div>

            {/* PnL */}
            <div className="pnl-row">
              {[
                { l: 'PnL Réalisé', v: p.pnl_realise },
                { l: 'PnL Latent',  v: p.pnl_latent },
                { l: 'PnL Total',   v: p.pnl_total, big: true },
              ].map(({ l, v, big }) => (
                <div key={l} className={`pnl-box ${cc(v)}`}>
                  <div className="pnl-label">{l}</div>
                  <div className={`pnl-val ${cc(v)}`} style={big ? { fontSize: '.95rem' } : {}}>{fmtS(v)} USDT</div>
                </div>
              ))}
            </div>

            {/* Stats trades */}
            <div className="tbar">
              {[
                { cls: 'tot', v: p.nb_total,  l: 'Total' },
                { cls: 'exc', v: p.nb_exec,   l: 'Exec.' },
                { cls: 'can', v: p.nb_annule, l: 'Annulés' },
                { cls: 'buy', v: p.nb_achat,  l: 'Achats' },
                { cls: 'sel', v: p.nb_vente,  l: 'Ventes' },
              ].map(({ cls, v, l }) => (
                <div key={l} className={`tc ${cls}`}>
                  <span className="tn">{v}</span>
                  <span className="tl">{l}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
