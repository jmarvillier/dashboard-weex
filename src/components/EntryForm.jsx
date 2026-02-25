/**
 * EntryForm.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Formulaire de saisie d'une nouvelle ligne de trading.
 *
 * Structure des colonnes (identique au journal Excel) :
 *   [0]  Date
 *   [1]  Paire
 *   [2]  Sens         (Achat | Vente | Dépôt)
 *   [3]  Statut       (Exécuté | Annulé | En attente)
 *   [4]  Prix de saisie
 *   [5]  Montant USDT
 *   [6]  Montant USDC
 *   [7]  Montant EUR
 *   [8]  (réservé)
 *   [9]  (réservé)
 *   [10] Volume
 *   [11] Notes
 *   [12] Dashboard    (true | false)
 */

import { useState } from 'react'
import { appendRow } from '../lib/repository.js'

// ── Valeurs par défaut ────────────────────────────────────────────────────────

const today = () => new Date().toISOString().slice(0, 10)

const INITIAL = {
  date      : today(),
  paire     : '',
  sens      : 'Achat',
  statut    : 'Exécuté',
  prix      : '',
  usdt      : '',
  usdc      : '',
  eur       : '',
  volume    : '',
  notes     : '',
  dashboard : true,
}

const SENS_OPTIONS   = ['Achat', 'Vente', 'Dépôt']
const STATUT_OPTIONS = ['Exécuté', 'Annulé', 'En attente']

// Paires courantes pour l'autocomplete
const PAIRS_SUGGESTIONS = [
  'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT',
  'ADA/USDT', 'AVAX/USDT', 'DOT/USDT', 'MATIC/USDT', 'LINK/USDT',
  'XAG/USDT', 'USDT/EUR', 'USDC/EUR',
]

// ── Composant ─────────────────────────────────────────────────────────────────

export default function EntryForm({ onClose, onSaved }) {
  const [form, setForm]     = useState(INITIAL)
  const [busy, setBusy]     = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError]   = useState(null)

  // ── Helpers ────────────────────────────────────────────────────────────────

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
    setError(null)
  }

  function validate() {
    if (!form.date)  return 'La date est obligatoire.'
    if (!form.paire.trim()) return 'La paire est obligatoire.'
    if (!form.sens)  return 'Le sens est obligatoire.'
    if (!form.statut) return 'Le statut est obligatoire.'
    return null
  }

  // Convertit le formulaire en tableau de colonnes (format journal)
  function toRow() {
    return [
      form.date,           // [0]  Date
      form.paire.trim(),   // [1]  Paire
      form.sens,           // [2]  Sens
      form.statut,         // [3]  Statut
      form.prix    || '',  // [4]  Prix de saisie
      form.usdt    || '',  // [5]  Montant USDT
      form.usdc    || '',  // [6]  Montant USDC
      form.eur     || '',  // [7]  Montant EUR
      '',                  // [8]  réservé
      '',                  // [9]  réservé
      form.volume  || '',  // [10] Volume
      form.notes   || '',  // [11] Notes
      form.dashboard ? 'true' : 'false', // [12] Dashboard
    ]
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    const err = validate()
    if (err) { setError(err); return }

    setBusy(true)
    try {
      await appendRow(toRow())
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        setForm({ ...INITIAL, date: today() })
        onSaved?.()
      }, 1400)
    } catch (e) {
      setError('Erreur lors de la sauvegarde : ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="ef-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ef-modal">

        {/* Header */}
        <div className="ef-header">
          <div className="ef-title">✏️ Nouvelle entrée</div>
          <button className="ef-close" onClick={onClose}>✕</button>
        </div>

        {/* Succès */}
        {success && (
          <div className="ef-success">✅ Entrée sauvegardée dans le repository !</div>
        )}

        {/* Erreur */}
        {error && (
          <div className="ef-error">❌ {error}</div>
        )}

        <div className="ef-body">

          {/* Ligne 1 — Date + Paire */}
          <div className="ef-row">
            <div className="ef-field">
              <label className="ef-label">Date *</label>
              <input
                type="date"
                className="ef-input"
                value={form.date}
                onChange={e => set('date', e.target.value)}
              />
            </div>
            <div className="ef-field ef-field-wide">
              <label className="ef-label">Paire *</label>
              <input
                type="text"
                className="ef-input"
                placeholder="ex: BTC/USDT"
                value={form.paire}
                onChange={e => set('paire', e.target.value.toUpperCase())}
                list="pairs-list"
                autoCapitalize="characters"
              />
              <datalist id="pairs-list">
                {PAIRS_SUGGESTIONS.map(p => <option key={p} value={p} />)}
              </datalist>
            </div>
          </div>

          {/* Ligne 2 — Sens + Statut */}
          <div className="ef-row">
            <div className="ef-field">
              <label className="ef-label">Sens *</label>
              <div className="ef-seg">
                {SENS_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    className={`ef-seg-btn${form.sens === opt ? ' active' : ''} sens-${opt.toLowerCase()}`}
                    onClick={() => set('sens', opt)}
                    type="button"
                  >
                    {opt === 'Achat' ? '↑' : opt === 'Vente' ? '↓' : '⊕'} {opt}
                  </button>
                ))}
              </div>
            </div>
            <div className="ef-field">
              <label className="ef-label">Statut *</label>
              <div className="ef-seg">
                {STATUT_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    className={`ef-seg-btn${form.statut === opt ? ' active' : ''}`}
                    onClick={() => set('statut', opt)}
                    type="button"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Ligne 3 — Prix + Volume */}
          <div className="ef-row">
            <div className="ef-field">
              <label className="ef-label">Prix de saisie</label>
              <div className="ef-input-wrap">
                <input
                  type="number"
                  className="ef-input"
                  placeholder="0.00"
                  min="0"
                  step="any"
                  value={form.prix}
                  onChange={e => set('prix', e.target.value)}
                />
                <span className="ef-unit">USDT</span>
              </div>
            </div>
            <div className="ef-field">
              <label className="ef-label">Volume</label>
              <input
                type="number"
                className="ef-input"
                placeholder="0.00000"
                min="0"
                step="any"
                value={form.volume}
                onChange={e => set('volume', e.target.value)}
              />
            </div>
          </div>

          {/* Ligne 4 — Montants */}
          <div className="ef-section-title">Montant investi</div>
          <div className="ef-row ef-row-3">
            <div className="ef-field">
              <label className="ef-label">USDT</label>
              <div className="ef-input-wrap">
                <input
                  type="number"
                  className="ef-input"
                  placeholder="0.00"
                  min="0"
                  step="any"
                  value={form.usdt}
                  onChange={e => set('usdt', e.target.value)}
                />
                <span className="ef-unit">$</span>
              </div>
            </div>
            <div className="ef-field">
              <label className="ef-label">USDC</label>
              <div className="ef-input-wrap">
                <input
                  type="number"
                  className="ef-input"
                  placeholder="0.00"
                  min="0"
                  step="any"
                  value={form.usdc}
                  onChange={e => set('usdc', e.target.value)}
                />
                <span className="ef-unit">$</span>
              </div>
            </div>
            <div className="ef-field">
              <label className="ef-label">EUR</label>
              <div className="ef-input-wrap">
                <input
                  type="number"
                  className="ef-input"
                  placeholder="0.00"
                  min="0"
                  step="any"
                  value={form.eur}
                  onChange={e => set('eur', e.target.value)}
                />
                <span className="ef-unit">€</span>
              </div>
            </div>
          </div>

          {/* Ligne 5 — Notes */}
          <div className="ef-field">
            <label className="ef-label">Notes</label>
            <textarea
              className="ef-textarea"
              placeholder="Commentaire libre…"
              rows={2}
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </div>

          {/* Ligne 6 — Dashboard toggle */}
          <div className="ef-toggle-row">
            <label className="ef-toggle-label">
              <div className={`ef-toggle${form.dashboard ? ' on' : ''}`}
                onClick={() => set('dashboard', !form.dashboard)}
              >
                <div className="ef-toggle-thumb" />
              </div>
              Inclure dans le Dashboard
            </label>
            <span className="ef-toggle-hint">
              {form.dashboard ? '✅ Visible dans les calculs' : '⛔ Exclu des calculs'}
            </span>
          </div>

        </div>

        {/* Footer */}
        <div className="ef-footer">
          <button className="ef-btn-cancel" onClick={onClose} disabled={busy}>
            Annuler
          </button>
          <button className="ef-btn-save" onClick={handleSubmit} disabled={busy || success}>
            {busy ? <><span className="spin" /> Sauvegarde…</> : '💾 Sauvegarder'}
          </button>
        </div>

      </div>
    </div>
  )
}
