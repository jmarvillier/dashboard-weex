import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore'
import { db, auth } from './firebase.js'

/* ─── Ref dynamique par utilisateur — attend que l'auth soit prête ─────── */
function getSnapshotRef() {
  const user = auth.currentUser
  if (!user) throw new Error('Utilisateur non connecté. Reconnectez-vous.')
  return doc(db, 'users', user.uid, 'snapshots', 'latest')
}

/* ─── Attend que Firebase Auth soit initialisé (max 5s) ────────────────── */
function waitForAuth() {
  return new Promise((resolve, reject) => {
    if (auth.currentUser) { resolve(auth.currentUser); return }
    const unsub = auth.onAuthStateChanged(user => {
      unsub()
      if (user) resolve(user)
      else reject(new Error('Utilisateur non connecté. Reconnectez-vous.'))
    })
    setTimeout(() => { unsub(); reject(new Error('Timeout auth. Reconnectez-vous.')) }, 5000)
  })
}

/* ─── Sérialisation (contournement nested arrays Firestore) ─────────────── */
function serialize(rows) {
  return rows.map((row, i) => ({ i, r: JSON.stringify(row) }))
}

function deserialize(rowObjects) {
  return rowObjects
    .slice()
    .sort((a, b) => a.i - b.i)
    .map(obj => {
      try { return JSON.parse(obj.r) } catch { return [] }
    })
}

/* ─── API publique ──────────────────────────────────────────────────────── */

export async function saveSnapshot(rows, source) {
  await waitForAuth()
  await setDoc(getSnapshotRef(), {
    rows     : serialize(rows),
    source,
    loadedAt : new Date().toISOString(),
    version  : 3,
  })
}

export async function loadSnapshot() {
  await waitForAuth()
  const snap = await getDoc(getSnapshotRef())
  if (!snap.exists()) return null
  const data = snap.data()
  return { ...data, rows: deserialize(data.rows) }
}

export async function hasSnapshot() {
  try {
    const snapshot = await loadSnapshot()
    return snapshot !== null && Array.isArray(snapshot.rows) && snapshot.rows.length > 1
  } catch {
    return false
  }
}

export async function appendRow(row) {
  await waitForAuth()
  const snapshot = await loadSnapshot()
  let rows, source

  if (snapshot && Array.isArray(snapshot.rows) && snapshot.rows.length > 0) {
    rows   = [...snapshot.rows, row]
    source = snapshot.source
  } else {
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

export async function appendRows(newRows, source = 'Régularisation') {
  await waitForAuth()
  if (!Array.isArray(newRows) || newRows.length === 0) {
    throw new Error('Fichier vide ou format non reconnu.')
  }

  // Détecte une éventuelle ligne d'en-tête dans le fichier importé et l'ignore
  const hasHeader = newRows[0]?.some(c => /PAIRE|DATE/i.test(String(c)))
  const dataRows  = hasHeader ? newRows.slice(1) : newRows
  if (dataRows.length === 0) throw new Error('Aucune ligne de données à ajouter.')

  const snapshot    = await loadSnapshot()
  const hasExisting = snapshot && Array.isArray(snapshot.rows) && snapshot.rows.length > 0

  // Ajoute aux lignes existantes — n'écrase rien.
  // Repo vide : on garde le fichier tel quel (en-tête compris).
  const merged = hasExisting ? [...snapshot.rows, ...dataRows] : newRows

  await saveSnapshot(merged, hasExisting ? snapshot.source : source)

  return { rows: merged, added: dataRows.length }
}

export async function listEntries() {
  await waitForAuth()
  const snapshot = await loadSnapshot()
  if (!snapshot || !Array.isArray(snapshot.rows) || snapshot.rows.length < 1) return null

  const rows      = snapshot.rows
  const hasHeader = rows[0]?.some(c => String(c).toUpperCase().includes('PAIRE'))
  const header    = hasHeader ? rows[0] : []
  const entries   = rows
    .map((data, rowIndex) => ({ rowIndex, data }))
    .filter(({ rowIndex }) => hasHeader ? rowIndex !== 0 : true)

  return { header, entries, source: snapshot.source, loadedAt: snapshot.loadedAt }
}

export async function updateRow(rowIndex, newData) {
  await waitForAuth()
  const snapshot = await loadSnapshot()
  if (!snapshot || !Array.isArray(snapshot.rows)) throw new Error('Aucune donnée dans le repository.')

  const rows = [...snapshot.rows]
  if (rowIndex < 0 || rowIndex >= rows.length) throw new Error(`Index invalide : ${rowIndex}`)

  rows[rowIndex] = newData
  await saveSnapshot(rows, snapshot.source)
}

export async function deleteRow(rowIndex) {
  await waitForAuth()
  const snapshot = await loadSnapshot()
  if (!snapshot || !Array.isArray(snapshot.rows)) throw new Error('Aucune donnée dans le repository.')

  await saveSnapshot(snapshot.rows.filter((_, i) => i !== rowIndex), snapshot.source)
}

export async function clearSnapshot() {
  await waitForAuth()
  await deleteDoc(getSnapshotRef())
}
