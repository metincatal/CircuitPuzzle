# Düello Modu - Radikal Yeniden Tasarım Planı

## Sorunlar
1. **Multi-touch çalışmıyor**: İki oyuncu aynı anda dokunduğunda sadece biri algılanıyor.
   - Sebep: Her oyuncu alanı ayrı `View` üzerinde `onTouchEnd` kullanıyor. React Native'in responder sistemi aynı anda sadece bir view'e touch event iletebiliyor.
   - P2 alanı 180° döndürülmüş olması koordinat hesaplamalarını da karmaşıklaştırıyor.

2. **Sabotaj mekanikleri yok**: Düello sadece "kim daha hızlı çözer" yarışı, stratejik derinlik yok.

---

## Adım 1: Multi-Touch Düzeltmesi

**Yaklaşım:** İki ayrı View yerine, tüm oyun ekranını kapsayan **tek bir root-level touch handler** kullanacağız.

**Detay:**
- Ana container View'e `onTouchEnd` (veya `onStartShouldSetResponderCapture`) ekle
- `e.nativeEvent.changedTouches` dizisindeki TÜM touch'ları işle
- Her touch'ın `pageY` koordinatına bakarak hangi oyuncu alanında olduğunu belirle:
  - `pageY < dividerY` → Oyuncu 1
  - `pageY > dividerY` → Oyuncu 2
- P2 alanı 180° döndürülmüş olduğu için P2 touch koordinatlarını ters çevir
- Her iki canvas'ın layout bilgisini `onLayout` ile sakla, `pageX`/`pageY`'den grid pozisyonunu hesapla

**Dosya:** `DuelGameScreen.tsx`
- `onTouchEnd` handler'ları ayrı View'lerden kaldır
- Yeni tek root handler ekle
- P2 koordinat dönüştürme mantığı ekle

---

## Adım 2: Sabotaj (Manipülasyon) Sistemi

### 2a. Enerji Mekanizması
- Her oyuncunun bir **enerji barı** olacak (0-5 arası)
- Round başında: 0 enerji
- Enerji kazanım koşulları:
  - Round'u kazandığında: +2 enerji (sonraki round'a taşınır)
  - Her 5 doğru hamle (tile doğru pozisyona geldiğinde): +1 enerji
- Enerji barı, oyuncu header'ında gösterilecek (küçük yıldırım ikonları)

### 2b. Sabotaj Türleri (3 tane - basit ama etkili)

| Sabotaj | Efekt | Maliyet | Süre |
|---------|-------|---------|------|
| **Karıştır (Shuffle)** | Rakibin 3 rastgele çözülmemiş tile'ını döndürür | 2 enerji | Anlık |
| **Karartma (Blackout)** | Rakibin kablolarını 4sn gizler (sadece node'lar görünür) | 3 enerji | 4 saniye |
| **Dondurma (Freeze)** | Rakibin touch girişini 3sn devre dışı bırakır | 3 enerji | 3 saniye |

### 2c. Sabotaj UI
- VS divider bandı genişletilecek (44px → 70px)
- Her oyuncunun kendi tarafında sabotaj butonları:
  - P1'in butonları divider'ın üst kısmında (P1 tarafından erişilebilir)
  - P2'nin butonları divider'ın alt kısmında (P2 tarafından erişilebilir, 180° döndürülmüş)
- Butonlar: küçük ikonlar (shuffle, eye-off, snowflake)
- Enerji yetmezse butonlar soluk/disabled
- Sabotaj kullanıldığında:
  - Kullanan tarafta kısa "kullandın" animasyonu
  - Rakip tarafta büyük uyarı overlay: "SABOTAJ!" + efekt adı (1.5sn)
  - Haptic feedback (heavy tap)

### 2d. Sabotaj Efekt Uygulamaları

**Shuffle:**
- `shuffleSabotage(targetLevel)`: Çözülmemiş ve fixed olmayan tile'lardan rastgele 3 tanesini seç
- Her seçilen tile'ı rastgele 1-3 rotasyon döndür
- `calculatePowerFlow()` tekrar çalıştır
- Kısa "shake" animasyonu target canvas'ta

**Blackout:**
- `blackoutActive` state (boolean + timer)
- CircuitCanvas'a `blackout` prop'u ekle
- Blackout aktifken: kablo path'leri gizlenir, sadece node noktaları ve tile arka planı görünür
- 4 saniye sonra otomatik kalkar
- Geri sayım göstergesi (overlay üzerinde "3... 2... 1...")

**Freeze:**
- `freezeActive` state (boolean + timer)
- Freeze aktifken: `processTilePress` fonksiyonu o oyuncu için return eder
- Buz efekti overlay (mavi yarı-saydam katman + snowflake ikon)
- 3 saniye sonra otomatik kalkar
- Geri sayım göstergesi

---

## Adım 3: Best-of-5 Seçeneği

- Setup ekranında zorluk seçimi altına round sayısı seçimi ekle:
  - Best of 3 (varsayılan)
  - Best of 5
- `TOTAL_ROUNDS` sabit yerine state'e çevir

---

## Adım 4: Duel İstatistik Güncellemesi

- `StorageManager` → `DuelStats`'a yeni alanlar:
  - `totalSabotagesUsed: number`
  - `totalSabotagesReceived: number`
- Game Over modal'da ek bilgi: toplam sabotaj sayıları

---

## Dosya Değişiklikleri

| Dosya | Değişiklik |
|-------|-----------|
| `DuelGameScreen.tsx` | Multi-touch fix, sabotaj sistemi, best-of-5, tüm UI |
| `CircuitCanvas.tsx` | `blackout` prop'u ekle (kablo gizleme) |
| `StorageManager.ts` | DuelStats genişletme |
| `HomeScreen.tsx` | Düello kartı açıklamasını güncelle |

---

## Uygulama Sırası
1. Multi-touch fix (temel sorun)
2. Enerji sistemi + UI
3. Sabotaj butonları + UI
4. Shuffle sabotajı
5. Blackout sabotajı (CircuitCanvas prop dahil)
6. Freeze sabotajı
7. Best-of-5 seçeneği
8. StorageManager güncelleme
9. HomeScreen açıklama güncelleme
10. Test & polish
