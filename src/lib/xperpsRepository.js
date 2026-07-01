/**
 * xperpsRepository.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Accès en lecture à la collection Firestore `users/{uid}/xperps`, peuplée par le
 * skill ydash-regul-okx (un document par position perp clôturée, schéma v1).
 *
 * Contrainte Safari iPad : `auth.currentUser` peut être null pendant la ré-init
 * Firebase → on attend l'auth via `waitForAuth()` (même pattern que repository.js).
 */

import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { db, auth } from './firebase.js'

/* Attend que Firebase Auth soit prêt (max 5 s) */
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

function xperpsCol(uid) {
  return collection(db, 'users', uid, 'xperps')
}

/**
 * Retourne tous les documents xperps de l'utilisateur, triés par date de clôture.
 * Chaque élément = { id, ...doc } (tous les champs figés du schéma v1).
 */
export async function listXperps() {
  const user = await waitForAuth()
  let snap
  try {
    // tri serveur si possible (pas d'index composite requis pour un seul champ)
    snap = await getDocs(query(xperpsCol(user.uid), orderBy('closeTimeMs', 'asc')))
  } catch {
    // repli sans orderBy (collection sans le champ, ou règle d'index) → tri client
    snap = await getDocs(xperpsCol(user.uid))
  }
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}
