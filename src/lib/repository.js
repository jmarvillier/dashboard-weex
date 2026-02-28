/**
 * repository.js
 * Couche de persistance basée sur Firebase Firestore.
 * API publique identique à l'ancienne version IndexedDB.
 *
 * Structure Firestore :
 *   collection "snapshots"
 *     └── document "latest"
 *           { rows: Array, source: string, loadedAt: string, version: number }
 */

import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from './firebase.js'

const SNAPSHOT_REF = doc(db, 'snapshots', 'latest')

export async function saveSnapshot(rows, source) {
  await setDoc(SNAPSHOT_REF, {
    rows,
    source,
    loadedAt : new Date().toISOString(),
    version  : 1,
  })
}

export async function loadSnapshot() {
  const snap = await getDoc(SNAPSHOT_REF)
  if (!snap.exists()) return null
  return snap.data()
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

export async function listEntries() {
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
  const snapshot = await loadSnapshot()
  if (!snapshot || !Array.isArray(snapshot.rows)) throw new Error('Aucune donnée dans le repository.')

  const rows = [...snapshot.rows]
  if (rowIndex < 0 || rowIndex >= rows.length) throw new Error(`Index invalide : ${rowIndex}`)

  rows[rowIndex] = newData
  await saveSnapshot(rows, snapshot.source)
}

export async function deleteRow(rowIndex) {
  const snapshot = await loadSnapshot()
  if (!snapshot || !Array.isArray(snapshot.rows)) throw new Error('Aucune donnée dans le repository.')

  await saveSnapshot(snapshot.rows.filter((_, i) => i !== rowIndex), snapshot.source)
}

export async function clearSnapshot() {
  await deleteDoc(SNAPSHOT_REF)
}
