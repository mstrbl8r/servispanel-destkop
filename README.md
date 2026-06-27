# ServisPanel Masaüstü Uygulaması (Windows .exe)

## 🎯 Ne işe yarar?
teknikcepte.com'a bağlanan, çift tıkla açılan bir Windows masaüstü uygulaması.

**Özellikler:**
- 🌀 **Açılış ekranı** — logo + yükleniyor animasyonu (1.2 sn)
- 🗂️ **Sistem tepsisi (tray)** — pencereyi kapatınca arka planda çalışır, tray'den tekrar açılır
- 🔔 **Masaüstü bildirimleri** — yeni servis geldiğinde Windows bildirimi gösterir
- ⬇️ **Otomatik güncelleme** — yeni sürüm yayınlandığında kullanıcıya sorar, indirir, kurar
- 📡 **Çevrimdışı algılama** — internet/sunucu erişilemezse "Bağlantı Yok" ekranı, otomatik tekrar dener

## 📋 Gereksinimler
- [Node.js](https://nodejs.org) (LTS sürüm)

## 🔧 Kurulum ve Derleme (Windows'ta)

1. Bu klasörü Windows bilgisayarınıza kopyalayın
2. `main.js` içindeki `APP_URL` değerini kontrol edin (şu an: `https://teknikcepte.com`)
3. `build/icon.ico` ve `build/tray-icon.png` dosyalarını kendi logonuzla değiştirebilirsiniz (256×256 ICO ve 64×64 PNG)
4. Komut satırını (cmd/PowerShell) bu klasörde **yönetici olarak** açın:

```bash
npm install
npm run build-win
```

5. `dist/` klasöründe **ServisPanel Setup x.x.x.exe** dosyasını bulacaksınız

## 🔔 Bildirimler için panel tarafı kurulumu (opsiyonel)

Yeni servis bildirimlerinin çalışması için web panelinizde küçük bir uç nokta gerekir:

1. `panel-addon/notify_check.php` dosyasını web sunucunuzdaki panelin
   `/api/notify_check.php` yoluna yükleyin
2. Dosyanın en üstündeki `require_once` satırını kendi `config.php`
   yolunuza göre düzenleyin (zaten örnek path standart kurulumla uyumlu)
3. Bu dosya yoksa uygulama sorunsuz çalışır, sadece bildirim göndermez
   (sessizce atlar, hata vermez)

## ⬆️ Otomatik güncelleme kurulumu (GitHub Releases üzerinden)

Otomatik güncelleme şu repo'ya bağlı şekilde yapılandırıldı:
**https://github.com/mstrbl8r/servispanel-destkop**

### Tek seferlik kurulum

1. GitHub'da bu repoyu oluşturun (henüz yoksa):
   `https://github.com/new` → Repository name: `servispanel-destkop`
   (Private de seçebilirsiniz, otomatik güncelleme private repo'da da çalışır)

2. Bu klasördeki kodu o repo'ya push edin:
   ```bash
   git init
   git add .
   git commit -m "İlk sürüm"
   git branch -M main
   git remote add origin https://github.com/mstrbl8r/servispanel-destkop.git
   git push -u origin main
   ```

3. GitHub'da bir **Personal Access Token** oluşturun (güncelleme yayınlamak için gerekir):
   `GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)`
   → **repo** yetkisiyle bir token oluşturun, kopyalayın (bir daha gösterilmez, not edin)

4. Windows'ta ortam değişkeni olarak tanımlayın (PowerShell):
   ```powershell
   setx GH_TOKEN "buraya_kopyaladığınız_token"
   ```
   (Tanımladıktan sonra terminali kapatıp yeniden açın ki değişiklik etkili olsun)

### Yeni sürüm yayınlama (her güncellemede tekrarlanır)

```bash
npm version patch
npm run build-win -- --publish always
```

Bu komut hem `.exe`'yi derler hem de GitHub Releases'e otomatik yükler.
Kullanıcılardaki uygulamalar bir sonraki açılışta (veya menüden
"Güncellemeleri Kontrol Et" dediklerinde) bu sürümü görüp indirir.

### Otomatik güncellemeyi kullanmıyorsanız

Hiçbir şey yapmanıza gerek yok — `npm run build-win` (publish olmadan)
çalıştırdığınızda uygulama yine normal şekilde derlenir. Sadece kullanıcı
"Güncellemeleri Kontrol Et" derse veya açılışta otomatik kontrol
tetiklenirse GitHub'a sessizce bir istek gider; repo henüz boşsa veya
hiç sürüm yayınlanmamışsa **"Güncelleme Yok"** mesajı görünür (hataya
benzer bir 404 değil — bu repo'yu push ettiğiniz an düzelir).

## 🧪 Geliştirme modunda test (build almadan)

```bash
npm install
npm start
```

## 📦 Dağıtım
`dist/ServisPanel Setup x.x.x.exe` dosyasını müşterilerinize/çalışanlarınıza
gönderebilirsiniz.

## ⚙️ Özelleştirme
- **Pencere boyutu**: `main.js` → `width`/`height`
- **Uygulama adı**: `package.json` → `productName`
- **İkon**: `build/icon.ico` (256×256) ve `build/tray-icon.png` (64×64)
- **Bağlantı adresi**: `main.js` → `APP_URL`
- **Bildirim kontrol aralığı**: `main.js` → `NOTIFY_CHECK_INTERVAL` (ms)
- **Splash ekranı**: `splash.html` (HTML/CSS olarak tamamen düzenlenebilir)

