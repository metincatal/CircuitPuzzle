/**
 * Firebase yapılandırması
 *
 * Kurulum (bir kerelik, 5 dakika):
 * 1. console.firebase.google.com → Yeni proje oluştur
 * 2. Build → Realtime Database → Veritabanı oluştur (test modu)
 * 3. Proje Ayarları → Genel → Web uygulaması ekle → config'i aşağıya yapıştır
 *
 * Database Rules (Realtime Database → Kurallar):
 * {
 *   "rules": {
 *     "presence": {
 *       ".read": true,
 *       ".write": true
 *     }
 *   }
 * }
 */
export const FIREBASE_CONFIG = {
  apiKey:            'YOUR_API_KEY',
  authDomain:        'YOUR_PROJECT.firebaseapp.com',
  databaseURL:       'https://YOUR_PROJECT-default-rtdb.firebaseio.com',
  projectId:         'YOUR_PROJECT',
  storageBucket:     'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId:             'YOUR_APP_ID',
};

// Config doldurmadan önce özelliği devre dışı bırakmak için true yapın
export const PRESENCE_ENABLED =
  FIREBASE_CONFIG.apiKey !== 'YOUR_API_KEY';
