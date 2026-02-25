/**
 * repository.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Couche de persistance basée sur IndexedDB.
 * Stocke les données du journal de trading localement dans le navigateur.
 * Totalement gratuit, sans backend, sans configuration.
 *
 * Structure :
 *   DB : "weex-trading-db"
 *   Store : "snapshots"
 *     → clé : "latest"  (un seul enregistrement actif)
 *     → valeur : { rows, source, loadedAt, version }
 */

const DB_NAME    = 'weex-trading-db'
const DB_VERSION = 1
const STORE_NAME = 'snapshots'
const RECORD_KEY = 'latest'

// ── Initialisation ───────────────────────────────────────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }

    req.onsuccess  = (event) => resolve(event.target.result)
    req.onerror    = (event) => reject(event.target.error)
  })
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Sauvegarde un snapshot des données dans IndexedDB.
 * @param {Array}  rows      - Lignes brutes parsées (tableau de tableaux)
 * @param {string} source    - Label de la source ("Mon Journal WEEX", "Google Sheet", nom de fichier…)
 * @returns {Promise<void>}
 */
export async function saveSnapshot(rows, source) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const payload = {
      rows,
      source,
      loadedAt : new Date().toISOString(),
      version  : 1,
    }
    const req = store.put(payload, RECORD_KEY)
    req.onsuccess = () => resolve()
    req.onerror   = (e) => reject(e.target.error)
  })
}

/**
 * Charge le dernier snapshot sauvegardé.
 * @returns {Promise<{ rows: Array, source: string, loadedAt: string } | null>}
 */
export async function loadSnapshot() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req   = store.get(RECORD_KEY)
    req.onsuccess = (e) => resolve(e.target.result ?? null)
    req.onerror   = (e) => reject(e.target.error)
  })
}

/**
 * Vérifie s'il existe des données sauvegardées.
 * @returns {Promise<boolean>}
 */
export async function hasSnapshot() {
  try {
    const snapshot = await loadSnapshot()
    return snapshot !== null && Array.isArray(snapshot.rows) && snapshot.rows.length > 1
  } catch {
    return false
  }
}

/**
 * Ajoute une ligne au snapshot existant.
 * Si aucun snapshot n'existe, crée un nouveau journal avec en-tête.
 * @param {Array} row - Tableau de valeurs (13 colonnes, format journal)
 * @returns {Promise<void>}
 */
export async function appendRow(row) {
  const snapshot = await loadSnapshot()

  let rows
  let source

  if (snapshot && Array.isArray(snapshot.rows) && snapshot.rows.length > 0) {
    // Ajoute au snapshot existant
    rows   = [...snapshot.rows, row]
    source = snapshot.source
  } else {
    // Crée un nouveau journal avec en-tête
    const header = [
      'Date', 'Paire', 'Sens', 'Statut', 'Prix de saisie',
      'Montant USDT', 'Montant USDC', 'Montant EUR', '', '',
      'Volume', 'Notes', 'Dashboard',
    ]
    rows   = [header, row]
    source = 'Saisie manuelle'
  }

  await saveSnapshot(rows, source)
}

/**
 * Supprime toutes les données sauvegardées.
 * @returns {Promise<void>}
 */
export async function clearSnapshot() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req   = store.delete(RECORD_KEY)
    req.onsuccess = () => resolve()
    req.onerror   = (e) => reject(e.target.error)
  })
}
