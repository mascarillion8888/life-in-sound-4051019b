# LifeInSound Kart Üretici

Google ile giriş yapan her kullanıcının kendi Gemini API çağrısını sunucu üzerinden yapabildiği,
ürettiği kartların Vercel Postgres + Vercel Blob'da kalıcı saklandığı Next.js uygulaması.

## Kurulum adımları

### 1) Google OAuth (giriş için)
1. https://console.cloud.google.com → yeni proje → "APIs & Services" → "Credentials"
2. "Create Credentials" → "OAuth client ID" → Application type: **Web application**
3. Authorized redirect URI: `https://SENIN-DOMAININ.vercel.app/api/auth/callback/google`
   (yerelde test için ayrıca `http://localhost:3000/api/auth/callback/google` ekleyin)
4. Client ID ve Client Secret'ı `.env` dosyanıza kopyalayın.

### 2) Vercel Postgres + Blob
1. Vercel projenizde "Storage" sekmesi → "Create Database" → **Postgres** seçin. `DATABASE_URL` otomatik eklenir.
2. Aynı sekmeden "Create Store" → **Blob** seçin. `BLOB_READ_WRITE_TOKEN` otomatik eklenir.

### 3) Gemini API anahtarı
https://aistudio.google.com/apikey adresinden alın, `GEMINI_API_KEY` olarak ekleyin. Bu anahtar
**sadece sunucu tarafında** (`/app/api/generate/route.js`) kullanılır, tarayıcıya asla gönderilmez.

### 4) Ortam değişkenleri
`.env.example` dosyasını `.env`'e kopyalayıp doldurun (yerel geliştirme için) ve Vercel projesinin
"Environment Variables" ayarına aynı değerleri girin (prod için).

### 5) Veritabanı şemasını uygulama
```bash
npm install
npx prisma db push
```

### 6) Çalıştırma
```bash
npm run dev        # yerel geliştirme
```
veya Vercel'e deploy edin (`vercel --prod` ya da GitHub bağlantısıyla otomatik deploy).

## Notlar / sonraki adımlar
- Günlük kullanıcı başı 20 kart üretim limiti kodlanmıştır (`app/api/generate/route.js` içindeki `DAILY_LIMIT`), ihtiyaca göre değiştirin.
- Gerçek tanınabilir kişilerin görsellerini üretmek/kullanmak hem model politikaları hem telif/kişilik hakları açısından risklidir — prompt'lar kurgusal sahneler üretecek şekilde tasarlanmıştır.
- PNG olarak indirme özelliği bu sürümde yok; istenirse `html2canvas` ile client tarafında eklenebilir.
