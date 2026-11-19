# TokoKu — Kasir, stok & laporan (Netlify + Google Sheets)

Peran: **user** (kasir), **admin** (pemilik toko), **superadmin** (kelola semua toko & pengguna).

## Setup (±15 menit)
1. Buat Google Sheet kosong. Salin ID dari URL (`.../d/ID/edit`).
2. console.cloud.google.com → project baru → aktifkan **Google Sheets API** → IAM → Service Accounts → buat → tab Keys → Add key → JSON.
3. Di Google Sheet klik Share → masukkan `client_email` dari file JSON → peran Editor.
4. Upload folder ini ke GitHub → Netlify: Add new site → Import from Git (atau `netlify deploy --prod` via CLI).
5. Netlify → Site configuration → Environment variables:
   - `GOOGLE_EMAIL` = client_email
   - `GOOGLE_KEY` = private_key (salin persis, tanpa tanda kutip)
   - `SHEET_ID` = ID dari langkah 1
   - `JWT_SECRET` = teks acak yang panjang
   - `SETUP_KEY` = kata sandi rahasia buatanmu
   Lalu Deploys → Trigger deploy.
6. Buka situs → **Setup awal** → isi SETUP_KEY + username/password superadmin → login.
7. Setelah selesai, hapus env `SETUP_KEY` supaya setup tertutup.

Tab Stores, Users, Products, Sales dibuat otomatis.

## Catatan
- Google Sheets cukup untuk usaha kecil-menengah. Dua kasir menjual produk yang sama persis bersamaan bisa saling menimpa stok. Untuk skala besar, pindah ke database sungguhan (semua akses data ada di `netlify/functions/api.js`).
- Jangan share Sheet ke orang lain (berisi hash password).
- Belum ada: cetak struk, pembatasan percobaan login, mode offline.
