/**
 * Firebase yapılandırması — değerler .env dosyasından okunur (.gitignore'da).
 * Yeni ortamda çalıştırmak için: .env dosyası oluştur, aşağıdaki değişkenleri doldur.
 */
export const FIREBASE_CONFIG = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY            ?? '',
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN        ?? '',
  databaseURL:       process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL       ?? '',
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID         ?? '',
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET     ?? '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID             ?? '',
};

// .env dolu olduğunda otomatik aktif olur
export const PRESENCE_ENABLED = !!FIREBASE_CONFIG.apiKey;
