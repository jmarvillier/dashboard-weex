import { initializeApp }        from 'firebase/app'
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore'

const firebaseConfig = {
  apiKey            : 'TON_API_KEY',        // ← garde tes vraies valeurs
  authDomain        : 'dashboard-weex.firebaseapp.com',
  projectId         : 'dashboard-weex',
  storageBucket     : 'dashboard-weex.firebasestorage.app',
  messagingSenderId : '167218478733',
  appId             : '1:167218478733:web:9c25811d2b7f87724facc4',
}

let app, db

try {
  app = initializeApp(firebaseConfig)
  db  = initializeFirestore(app, {
    localCache: persistentLocalCache()
  })
} catch (err) {
  // Affiche l'erreur sur la page
  document.body.innerHTML = `
    <div style="color:red;padding:20px;font-family:monospace;font-size:14px">
      <b>Erreur Firebase :</b><br>${err.message}
    </div>`
  throw err
}

export { db }
