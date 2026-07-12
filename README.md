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
R2_PUBLIC_BASE_URL=https://assets.example.com
```

Explicatii:
- `NEXT_PUBLIC_SUPABASE_URL` - URL-ul proiectului Supabase
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` - cheie publica pentru citire/public client
- `SUPABASE_SERVICE_ROLE_KEY` - cheie privata folosita doar pe server pentru write/admin
- `R2_PUBLIC_BASE_URL` - domain-ul public al bucket-ului R2, recomandat pe custom domain
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
