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
- `src/routes.ts` - adresele paginii cursului, folosite si in browser, si pe server

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

Oferta de curs apare automat la fiecare incarcare a unei pagini publice. Acelasi modal se deschide din butonul sectiunii de curs; in `/admin` nu apare automat. Sub formular exista si butonul care duce la pagina cursului, descrisa in sectiunea 17. In editorul de continut poti modifica titlul, descrierea, fotografia, textul butonului de inscriere, textul butonului spre pagina cursului, mesajul de succes si afisarea automata. Formularul cere nume, numar de telefon, email si acord pentru prelucrarea datelor, apoi salveaza inscrierea in `course_subscribers`, vizibila in **Abonati cursuri**. Numele complet este pastrat in campul existent `first_name`; aceste campuri de contact nu necesita o migrare noua. Nu trimite automat emailuri.

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
- `npm test` foloseste servicii simulate si PostgreSQL in memorie prin PGlite. Nu citeste si nu modifica baza de date ori fisierele din productie. Acopera salvarea in admin, securitatea uploadurilor, rutele HTTP, migrarea SQL, oferta de curs, pagina cursului pe subdomeniu si metadatele paginilor.
- Metadatele paginilor de produse, galerie si admin sunt livrate si in HTML-ul initial prin `api/page.ts`. Configuratia Vercel include explicit fisierele necesare functiei, conform [documentatiei Vercel](https://vercel.com/kb/guide/how-can-i-use-files-in-serverless-functions).

## 17. Pagina cursului pe course.ivconcept.ro

Pagina de prezentare a cursului face parte din aceeasi aplicatie, cu acelasi backend, acelasi proiect Supabase si acelasi panou de administrare. Nu exista un proiect separat si nu este nevoie de o migrare SQL noua: inscrierile ajung in tabelul existent `course_subscribers`, vizibil in **Abonati cursuri**, cu sursa `course-page`.

### 17.1. Cum raspunde pagina

Pagina raspunde la doua adrese:

- `https://course.ivconcept.ro/` - adresa publica, folosita in butoane si in linkurile trimise mai departe
- `/curs` - aceeasi pagina pe domeniul principal, folosita in dezvoltare locala si in deploy-urile de preview

In productie, `https://www.ivconcept.ro/curs` si `https://ivconcept.ro/curs` redirectioneaza permanent (308) catre subdomeniu, iar canonical-ul paginii este mereu `https://course.ivconcept.ro`. Asa exista o singura adresa indexata, fara continut duplicat. Pe `localhost` si pe `*.vercel.app` butoanele duc la `/curs`, pentru ca subdomeniul nu exista acolo.

Logica este intr-un singur loc, in `src/routes.ts`, folosita de bundle-ul din browser, de Express si de functia `api/page.ts`. Daca schimbi subdomeniul, il schimbi acolo si in `vercel.json`.

### 17.2. Adaugarea domeniului in Vercel

1. In proiectul din Vercel: `Settings` > `Domains` > `Add Domain`.
2. Adauga `course.ivconcept.ro`.
3. Vercel afiseaza inregistrarea `CNAME` de creat. Valoarea este unica pentru fiecare proiect, de forma `xxxxxxxx.vercel-dns-017.com`; foloseste exact valoarea afisata pentru acest proiect, nu una copiata din alta parte.
4. La registrarul sau in DNS-ul domeniului `ivconcept.ro`, creeaza inregistrarea:

```txt
Tip:    CNAME
Nume:   course
Valoare: <valoarea afisata de Vercel>
TTL:    automat / implicit
```

5. Asteapta propagarea si verifica in `Settings` > `Domains` ca domeniul apare configurat corect, cu certificat emis.

Nu sunt necesare variabile de mediu noi si nu se schimba nimic la R2. Daca ai CORS configurat pe origini explicite in R2 (sectiunea 4.5), adauga si `https://course.ivconcept.ro` in `AllowedOrigins`, altfel imaginile incarcate din admin raman accesibile, dar uploadul testat de pe subdomeniu poate esua.

### 17.3. Ce editezi din admin

Pagina contine doar descrierea si formularul. In `/admin`, sectiunea **Pagina cursului** are trei campuri: titlul, descrierea si titlul de deasupra formularului. Descrierea pastreaza randurile goale, deci poti scrie mai multe paragrafe.

Textul butonului de inscriere si mesajul afisat dupa trimitere vin din **Oferta cursului**, ca sa fie identice in modal si pe pagina.

Formularul cere nume, telefon, email si acord GDPR, exact ca modalul, si salveaza in aceeasi lista. In **Abonati cursuri** fiecare inscriere arata de unde a venit: din oferta afisata pe site sau de pe pagina cursului.

### 17.4. Activare pe un site existent

Continutul existent primeste implicit pagina cursului la prima incarcare, fara reinitializarea bazei de date. **Nu rula `npm run db:seed` pe un site existent:** comanda inlocuieste continutul editat. Prima salvare din admin scrie noile campuri in `site_content`.

## 18. Confidentialitate, GDPR si cookies

Site-ul colecteaza date personale prin trei formulare: contact/oferta, newsletter si inscriere la curs. Fiecare cere bifa de acord, iar acordul se salveaza cu data si ora in Supabase.

### 18.1. Politica de confidentialitate si termenii

Textul este intr-un singur loc, `src/components/legalContent.tsx`, si este afisat in doua feluri:

- ca modal, din footer-ul site-ului, ca inainte
- ca pagini de sine statatoare: `/confidentialitate` si `/termeni`

Paginile exista pentru ca au o adresa stabila, care poate fi trimisa mai departe si care functioneaza si de pe subdomeniul cursului. Canonical-ul lor ramane pe domeniul principal, indiferent de host.

Sub bifa de acord din formularul de contact si din cel de inscriere la curs apare linkul catre politica, deschis intr-o fila noua ca sa nu piarda datele completate. Pe subdomeniul cursului linkul este absolut, catre `https://www.ivconcept.ro/confidentialitate`.

### 18.2. Datele operatorului

In `/admin`, sectiunea **Date legale & cookies** contine campurile care apar in politica: denumirea juridica, CUI, sediul, emailul de contact, perioada de pastrare a datelor si data ultimei actualizari. Cat timp sunt goale, politica foloseste numele de brand si adresa din footer.

Completeaza-le: GDPR cere ca operatorul sa fie identificabil, iar o denumire de brand fara CUI si sediu nu este suficienta.

### 18.3. Cookie-uri si tracking

Site-ul nu are banner de cookie-uri. Instrumentele de masurare pornesc direct, la incarcarea fiecarei pagini publice, asa cum a fost cerut.

Cookie-urile folosite:

- `iv_admin_session` - strict necesar, pentru autentificarea in `/admin`
- cookie-urile Meta Pixel (`_fbp`, `_fbc`) - plasate de pixel, daca **Meta Pixel Id** este configurat
- cookie-urile Google Analytics - doar daca este completat codul GA

Tracking-ul se opreste golind campurile din `/admin` > **Date legale & cookies** si, pentru pixel, variabila `VITE_META_PIXEL_ID`. Fara ele nu se incarca niciun script extern.

Textul politicii de confidentialitate se adapteaza singur: cand un ID de tracking este configurat, sectiunea despre cookie-uri spune ca sunt folosite cookie-uri de masurare, ca o forma criptata a emailului si a telefonului ajunge la Meta si cum pot fi blocate din browser. Daca golesti campurile, textul revine la varianta „doar cookie-uri strict necesare”. **Nu modifica manual acest text ca sa spuna altceva decat se intampla** - o politica de confidentialitate care nu corespunde realitatii este mai rea decat lipsa ei.

De stiut: in Uniunea Europeana, cookie-urile de masurare si de publicitate cer in mod normal consimtamant prealabil, iar termenii Meta cer acelasi lucru pentru traficul european. Configuratia actuala este o decizie asumata a proprietarului site-ului. Daca vrei sa revii la varianta cu acord, istoricul git contine implementarea completa a bannerului.

### 18.4. De retinut

Aceste texte sunt un punct de plecare scris cu bun-simt, nu consultanta juridica. Inainte de a te baza pe ele, pune-le in fata unui avocat sau a unui consultant GDPR, mai ales partea de perioada de pastrare si de temei legal. Daca adaugi alte servicii externe - un chat, un pixel de publicitate, un formular gazduit in alta parte - politica si bannerul trebuie actualizate.

## 19. Meta Pixel si Conversions API pentru evenimentul Lead

O inscriere la curs salvata cu succes este raportata catre Meta de doua ori, din browser prin Pixel si de pe server prin Conversions API, cu acelasi `event_id`, ca Meta sa deduplice perechea si sa numere un singur lead.

### 19.1. Ce declanseaza evenimentul

Doar o inscriere confirmata de backend. Nu se trimite nimic la click pe buton, la formular deschis, la validare picata, la request esuat sau daca randul nu a ajuns in `course_subscribers`.

Fluxul complet:

```txt
Vizitatorul completeaza formularul
        v
POST /api/course-subscribers
        v
validare + insert in course_subscribers
        v
succes -> se genereaza event_id (randomUUID)
        v
server -> Meta CAPI: Lead (event_id)
raspuns 201 { success, message, eventId }
        v
browser -> fbq('track','Lead',{},{ eventID })
        v
Meta deduplica dupa event_id
```

`event_id` este generat pe server, in `server/metaConversions.ts`, si trimis inapoi in raspunsul de succes. Browserul nu inventeaza niciodata un id propriu, deci cele doua copii ale evenimentului nu pot sa nu se potriveasca.

### 19.2. Configurare

```env
META_PIXEL_ID=
META_CAPI_ACCESS_TOKEN=
META_GRAPH_VERSION=v26.0
META_TEST_EVENT_CODE=
```

Adauga si `VITE_META_PIXEL_ID`, cu acelasi ID de pixel:

```env
VITE_META_PIXEL_ID=
```

`META_CAPI_ACCESS_TOKEN` este secret si ramane doar pe server: nu ajunge niciodata in bundle-ul din browser, in URL-uri sau in loguri. Adauga variabilele local in `.env` si in Vercel, in `Settings` > `Environment Variables`.

ID-ul de pixel are trei surse, in aceasta ordine:

- browserul: `VITE_META_PIXEL_ID`, citit la build, si daca lipseste campul **Meta Pixel Id** din `/admin` > **Date legale & cookies**
- serverul: `META_PIXEL_ID`, si daca lipseste tot campul din admin

`VITE_*` este singurul prefix pe care Vite il trimite in bundle si se citeste la build, deci o schimbare a ID-ului cere un redeploy. Campul din admin se schimba fara redeploy. ID-ul de pixel este o valoare publica prin natura ei; secret este doar tokenul.

### 19.2.1. Unde ruleaza codul de baza

Codul de baza al pixelului - `init` plus `PageView` - este incarcat de componenta `CookieConsent`, prezenta pe toate paginile publice: homepage, galeria foto, paginile de produse, pagina cursului de pe subdomeniu si paginile legale. Nu ruleaza in `/admin`, unde nu are ce cauta.

Nu este pus ca script in `index.html`, pentru ca acolo ar porni inaintea raspunsului la bannerul de cookies si ar scrie `_fbp` fara acord. `<noscript>`-ul din snippetul standard lipseste din acelasi motiv: nu poate fi conditionat de consimtamant, iar site-ul oricum nu functioneaza fara JavaScript.

`META_TEST_EVENT_CODE` se foloseste numai cat verifici in `Events Manager`; lasa-l gol in productie.

### 19.3. Datele trimise si hashuirea

Evenimentul server-side contine `event_name: "Lead"`, `event_time`, `event_id`, `action_source: "website"`, `event_source_url` si `user_data`.

In `user_data` ajung, cand exista:

- `em` - emailul, trimmed, lowercase, apoi SHA-256
- `ph` - telefonul redus la cifre, apoi SHA-256
- `client_ip_address` - IP-ul real al vizitatorului, luat din `request.ip`, care respecta configurarea `trust proxy` existenta
- `client_user_agent`, `fbp`, `fbc` - trimise ca atare

IP-ul, User-Agent-ul, `_fbp` si `_fbc` nu se hashuiesc. `_fbp` si `_fbc` sunt citite din cookie-urile setate de Pixel si trimise catre backend impreuna cu formularul; daca lipsesc, campurile sunt omise si nu se inventeaza nimic.

Endpoint: `https://graph.facebook.com/<versiune>/<pixel_id>/events`, cu tokenul in corpul cererii, nu in URL.

### 19.4. Cand porneste

Pixelul porneste la incarcarea fiecarei pagini publice, fara banner si fara acord prealabil - vezi sectiunea 18.3. Evenimentul `Lead` ramane legat strict de o inscriere salvata, iar evenimentul server-side se trimite pentru fiecare inscriere reusita, cat timp tokenul este configurat.

### 19.5. Erori

Tracking-ul este secundar inscrierii. Daca Meta raspunde cu eroare sau nu raspunde deloc, cererea are timeout de 3 secunde, eroarea este logata pe server fara date personale, inscrierea ramane salvata si vizitatorul primeste acelasi mesaj de succes. Fara token configurat nu se incearca niciun apel.

### 19.6. Testare in Meta Events Manager

1. Completeaza `META_PIXEL_ID` si `META_CAPI_ACCESS_TOKEN`, si ID-ul de pixel in `/admin`.
2. In `Events Manager` > `Test Events` copiaza codul afisat si pune-l in `META_TEST_EVENT_CODE`, apoi redeployeaza.
3. Deschide `https://course.ivconcept.ro/`, accepta bannerul de cookie-uri si trimite o inscriere de test.
4. In `Test Events` trebuie sa apara doua intrari `Lead`, una `Browser` si una `Server`, marcate ca deduplicate dupa acelasi `event_id`.
5. Sterge inscrierea de test din `/admin` > **Abonati cursuri** si goleste `META_TEST_EVENT_CODE` cand ai terminat.

Verificari locale:

```bash
npm run lint
npm test
npm run build
```
