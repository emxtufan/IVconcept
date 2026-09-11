# IV Concept / Portfolio Website

Website-ul foloseste:
- `Vite + React` pentru frontend
- `Express` pentru API
- `Supabase` pentru continut si date administrative
- `Cloudflare R2` pentru imagini si video
- `Vercel` pentru hosting

Scopul acestui README este sa ramana documentul de operare al proiectului: setup local, deploy, upload-uri, baze de date, mentenanta si troubleshooting.

## 1. Arhitectura

Datele text si datele administrative merg in `Supabase`:
- content site
- galerii
- itemi galerii
- subscriberi newsletter
- inquiries / cereri de contact

Fisierele media merg in `Cloudflare R2`:
- imagini
- video
- assets din admin

Deploy-ul public merge in `Vercel`:
- frontend-ul este build-uit din `dist`
- `/api/*` si `/uploads/*` sunt servite prin Express

## 2. Structura importanta

```txt
src/                frontend + admin UI
server/             API Express
api/index.ts        entrypoint pentru Vercel
supabase/schema.sql schema bazei de date Supabase
supabase/siteContent.seed.json content seed pentru site
scripts/            scripturi de seed
vercel.json         routing si config pentru Vercel
```

Fisiere importante:
- `server/index.ts` - API principal
- `server/supabase.ts` - client Supabase
- `server/supabaseStore.ts` - operatii DB
- `server/r2Storage.ts` - operatii R2
- `src/admin/` - panoul de administrare

## 3. Variabile de mediu

Creeaza local un fisier `.env` pornind de la `.env.example`.

Variabile obligatorii:

```env
ADMIN_PASSWORD=replace-with-a-strong-password
ADMIN_SESSION_SECRET=replace-with-a-long-random-secret

NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=your-r2-bucket-name
R2_PRIVATE_BUCKET_NAME=your-private-inquiry-bucket
R2_PUBLIC_BASE_URL=https://assets.example.com
```

Explicatii:
- `NEXT_PUBLIC_SUPABASE_URL` - URL-ul proiectului Supabase
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` - cheie publica pentru citire/public client
- `SUPABASE_SERVICE_ROLE_KEY` - cheie privata folosita doar pe server pentru write/admin
- `R2_PUBLIC_BASE_URL` - domain-ul public al bucket-ului R2, recomandat pe custom domain
- `R2_PRIVATE_BUCKET_NAME` - bucket separat pentru fotografiile din cereri; fără domeniu public și fără acces `r2.dev`
- `ADMIN_PASSWORD` - parola pentru `/admin`
- `ADMIN_SESSION_SECRET` - secretul cookie-ului de sesiune admin

## 4. Setup Initial

### 4.1. Instalare

```bash
npm install
```

### 4.2. Configureaza Supabase

1. Creeaza proiectul in Supabase.
2. Deschide `SQL Editor`.
3. Ruleaza continutul din `supabase/schema.sql`.
4. Verifica daca tabelele au fost create:
   - `site_content`
   - `galleries`
   - `gallery_items`
   - `newsletter_subscribers`
   - `inquiries`

### 4.3. Seed pentru continut

Pentru a popula `site_content.main` cu continutul de baza:

```bash
npm run db:seed
```

### 4.4. Configureaza Cloudflare R2

1. Creeaza bucket-ul in R2.
2. Creeaza cheile S3 API pentru bucket.
3. Leaga bucket-ul la un custom domain.
4. Pune acel domain in `R2_PUBLIC_BASE_URL`.

Exemplu:

```env
R2_PUBLIC_BASE_URL=https://assets.domeniul-tau.com
```

### 4.5. Configureaza CORS in R2

Upload-ul din admin merge direct din browser in R2 cu presigned URL, deci CORS este obligatoriu.

Exemplu de CORS:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://proiectul-tau.vercel.app",
      "https://domeniul-tau.com"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["Content-Type", "Cache-Control"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

## 5. Rulare Locala

Porneste frontend + API:

```bash
npm run dev
```

Adrese utile:
- site: `http://localhost:3000`
- API: `http://localhost:3001`
- admin: `http://localhost:3000/admin`

## 6. Scripturi utile

```bash
npm run dev
npm run build
npm run preview
npm run lint
npm run db:seed
npm run db:push
npm run db:studio
```

Explicatii:
- `dev` - porneste Vite + Express
- `build` - build frontend pentru productie
- `preview` - build + porneste serverul
- `lint` - ruleaza TypeScript check
- `db:seed` - scrie contentul seed in Supabase
- `db:push` - doar afiseaza reminder ca schema se aplica din `supabase/schema.sql`
- `db:studio` - reminder ca datele se vad din dashboard-ul Supabase

## 7. Cum functioneaza upload-ul

Fluxul nou este:

1. Adminul cere un presigned URL de la API.
2. Browser-ul urca fisierul direct in R2.
3. API-ul primeste doar metadata si salveaza URL-ul in Supabase.

Avantaj:
- nu mai lovesti limita de body size din Vercel Functions
- upload-urile mari nu trec prin serverul Vercel
- adminul pastreaza progress bar-ul

## 8. Deploy pe Vercel

### 8.1. Inainte de primul deploy

Trebuie sa fie gata:
- proiectul Supabase
- schema din `supabase/schema.sql`
- seed-ul rulat cel putin o data
- bucket-ul R2
- custom domain-ul R2
- CORS configurat in R2

### 8.2. Import repo in Vercel

1. Push pe GitHub.
2. In Vercel: `Add New Project`.
3. Importa repo-ul.
4. Lasa root-ul proiectului pe radacina repo-ului.

Configul este deja pregatit in `vercel.json`.

### 8.3. Environment Variables in Vercel

Adauga toate variabilele din `.env.example`:

```env
ADMIN_PASSWORD
ADMIN_SESSION_SECRET
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_PRIVATE_BUCKET_NAME
R2_PUBLIC_BASE_URL
```

### 8.4. Deploy

Dupa ce toate variabilele sunt setate:

1. Fa primul deploy.
2. Deschide site-ul.
3. Testeaza `/admin`.
4. Testeaza salvarea de text.
5. Testeaza upload-ul unei imagini.

## 9. Checklist dupa deploy

Testeaza:

1. Homepage-ul se incarca normal.
2. `/admin` cere parola.
3. Login-ul in admin merge.
4. Editarea unui text se salveaza.
5. Newsletter subscribe scrie in Supabase.
6. Inquiry form scrie in Supabase.
7. Upload-ul din admin merge.
8. Galeriile separate se incarca corect.
9. URL-urile media se servesc de pe `R2_PUBLIC_BASE_URL`.

## 10. Daca modifici continutul pe viitor

### Pentru texte

Nu schimba hardcoded in componente daca deja exista in admin.

Regula:
- daca textul exista in `site_content`, se modifica din admin
- doar daca introduci o sectiune complet noua trebuie extins tipul de content + admin + seed

### Pentru imagini/video

Regula:
- upload-urile merg prin admin in R2
- nu urca assets noi direct in repo daca trebuie sa fie editabile

## 11. Daca adaugi o sectiune noua

Ordinea corecta:

1. Adaugi tipul in `src/types/siteContent.ts`
2. Adaugi valorile in `supabase/siteContent.seed.json`
3. Extinzi normalizarea in `normalizeSiteContent`
4. Afisezi sectiunea in frontend
5. O faci editabila in admin
6. Daca seed-ul trebuie actualizat in DB, rulezi:

```bash
npm run db:seed
```

Nota:
- `db:seed` rescrie contentul principal din seed
- daca ai continut deja personalizat in productie, foloseste adminul pentru schimbari punctuale

## 12. Troubleshooting

### Adminul nu poate salva

Cauze probabile:
- lipseste `SUPABASE_SERVICE_ROLE_KEY`
- cheia este gresita
- schema Supabase nu este aplicata

### Upload-ul da eroare

Cauze probabile:
- CORS gresit in R2
- `R2_PUBLIC_BASE_URL` gresit
- bucket-ul nu e public pe custom domain
- cheile R2 sunt gresite

### Imaginile nu se vad in site

Verifica:
- obiectul exista in R2
- URL-ul din Supabase este corect
- `R2_PUBLIC_BASE_URL` este accesibil public

### `/admin` nu functioneaza in productie

Verifica:
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`
- cookie-urile
- ca deploy-ul are toate env vars in Vercel

### Site-ul merge local, dar nu in Vercel

Verifica:
- env vars in Vercel
- `vercel.json`
- CORS in R2
- ca schema Supabase a fost aplicata

## 13. Recomandari importante

- Nu urca niciodata `.env` pe GitHub.
- Nu urca chei reale in `.env.example`.
- Foloseste custom domain pentru R2, nu `r2.dev`, pentru productie.
- Testeaza mereu un upload dupa orice schimbare la CORS sau R2.
- Pastreaza contentul editabil in Supabase, nu in cod, daca vrei sa-l gestionezi din admin.

## 14. Comenzi rapide

```bash
# instalare
npm install

# dev
npm run dev

# type-check
npm run lint

# build productie
npm run build

# seed content in Supabase
npm run db:seed
```

## 15. Status curent al proiectului

Acum proiectul este pregatit pentru:
- development local
- deploy pe Vercel
- continut din Supabase
- media din Cloudflare R2
- upload direct din admin in R2

Daca dupa mult timp revii pe proiect, urmeaza ordinea:

1. verifici env vars
2. verifici Supabase
3. verifici R2 + CORS
4. rulezi local `npm run dev`
5. testezi admin + upload + save

## 16. Oferta de curs si actualizarile de securitate

Oferta de curs apare automat la fiecare incarcare a unei pagini publice. Acelasi modal se deschide din butonul sectiunii de curs; in `/admin` nu apare automat. In editorul de continut poti modifica titlul, descrierea, fotografia, textul butonului, mesajul de succes si afisarea automata. Formularul cere nume, numar de telefon, email si acord pentru prelucrarea datelor, apoi salveaza inscrierea in `course_subscribers`, vizibila in **Abonati cursuri**. Numele complet este pastrat in campul existent `first_name`; aceste campuri de contact nu necesita o migrare noua. Nu trimite automat emailuri.

Continutul existent primeste implicit oferta fara reinitializarea bazei de date. **Nu rula `npm run db:seed` pe un site existent pentru aceasta actualizare:** comanda inlocuieste continutul editat.

In **Oferta cursului**, campurile **Imagine curs — desktop** si **Imagine curs — mobil** permit incarcarea unor fotografii diferite. Sub 768 px, fotografia pentru mobil se afiseaza integral, la proportiile originale, inclusiv cand este verticala. Daca imaginea pentru mobil lipseste, este folosita cea pentru desktop. Continutul existent ramane compatibil; aceasta setare nu necesita migrare SQL.

### Activare pe un site existent

1. Aplica `supabase/backend_security_migration.sql` in Supabase SQL Editor. Pentru o instalare noua, `supabase/schema.sql` include deja actualizarile. Migrarea se poate reaplica.
2. Creeaza un bucket R2 separat pentru anexele cererilor, fara acces public prin `r2.dev` sau custom domain. Un prefix intr-un bucket public nu face fisierele private.
3. Configureaza `R2_PRIVATE_BUCKET_NAME` local si in Vercel. Cheile R2 trebuie sa permita accesul la ambele bucket-uri; configureaza CORS pentru upload in ambele, conform sectiunii 4.5.
4. Pentru fotografii ale cererilor deja existente, verifica raportul scriptului de mai jos, apoi ruleaza varianta `--apply`. Aceasta copiaza si verifica fisierele in bucket-ul privat, actualizeaza referintele in baza de date si elimina originalele publice care nu mai sunt folosite. Dupa migrare, goleste cache-ul CDN pentru vechile adrese `/uploads/inquiries/*`. Scriptul identifica adresele din `R2_PUBLIC_BASE_URL` curent; adresele din domenii publice folosite anterior necesita verificare separata.
5. Ruleaza verificarile, publica aplicatia si verifica autentificarea, inscrierea la curs si uploadul pe mediul public.

```bash
# Raport: citeste datele existente, fara modificari
node --import tsx server/migrateLegacyInquiryAttachments.ts

# Migrare efectiva a anexelor vechi
node --import tsx server/migrateLegacyInquiryAttachments.ts --apply

# Verificari locale
npm run lint
npm test
npm run build
```

Migrarea SQL este necesara pentru noile functii de limitare a cererilor si pentru anexele private. Daca lipseste, rutele protejate pot raspunde cu 503. Fara bucket-ul privat configurat nu se pot incarca fotografii ale cererilor; formularele fara fotografii nu depind de acesta.

### Comportament si verificare

- Uploadurile folosesc semnaturi pentru dimensiunea exacta si MIME, verificarea obiectului stocat si tokenuri legate de fisier. Browserul seteaza automat `Content-Length`. SVG si HTML nu mai sunt acceptate; foloseste PNG sau WebP pentru logo-uri.
- Anexele cererilor se citesc prin ruta de admin cu `no-store`. Stergerea elimina fisierele inaintea inregistrarii; daca storage-ul raspunde cu eroare, inregistrarea ramane pentru o noua incercare. Uploadurile private expirate sunt curatate la cereri ulterioare.
- Redenumirea galeriilor copiaza fisierele si actualizeaza baza de date atomic inainte de eliminarea originalelor nefolosite. In caz de rezultat incert, copiile sunt pastrate pentru a evita pierderea fisierelor; orice curatare ulterioara trebuie sa verifice referintele.
- `TRUST_PROXY_HOPS` este implicit `0`; seteaza-l numai conform numarului de proxy-uri de incredere din infrastructura. Vercel este tratat separat.
- `npm test` foloseste servicii simulate si PostgreSQL in memorie prin PGlite. Nu citeste si nu modifica baza de date ori fisierele din productie. Acopera salvarea in admin, securitatea uploadurilor, rutele HTTP, migrarea SQL, oferta de curs si metadatele paginilor.
- Metadatele paginilor de produse, galerie si admin sunt livrate si in HTML-ul initial prin `api/page.ts`. Configuratia Vercel include explicit fisierele necesare functiei, conform [documentatiei Vercel](https://vercel.com/kb/guide/how-can-i-use-files-in-serverless-functions).
