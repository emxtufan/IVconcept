import type { ReactNode } from 'react';
import { getSiteContent } from '../data';
import { resolveMetaPixelId } from './metaPixel';

export type LegalDocument = 'privacy' | 'terms';

export const LEGAL_TITLES: Record<LegalDocument, string> = {
  privacy: 'Politica de confidențialitate',
  terms: 'Termeni și condiții',
};

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="font-semibold text-[#2c2218]">{title}</h3>
      <p className="mt-1">{children}</p>
    </section>
  );
}

/** The operator has to be identifiable; until the real details are filled in
 *  from the admin panel, the brand name and the footer address are used. */
function useOperator() {
  const legal = getSiteContent().legal;
  const footer = getSiteContent().footer;

  return {
    name: legal.legalEntityName || footer.brandName || 'IV Concept',
    registrationNumber: legal.registrationNumber,
    address: legal.address || footer.address,
    email: legal.contactEmail || footer.email,
    retentionPeriod: legal.retentionPeriod,
    trackingEnabled: Boolean(legal.googleAnalyticsId || resolveMetaPixelId(legal.metaPixelId)),
  };
}

export function LegalLastUpdated() {
  const legal = getSiteContent().legal;
  if (!legal.lastUpdated) return null;
  return <p className="mt-3 text-xs text-[#2c2218]/45">Ultima actualizare: {legal.lastUpdated}</p>;
}

function PrivacySections() {
  const operator = useOperator();

  return (
    <>
      <LegalSection title="1. Cine prelucrează datele">
        Operatorul datelor este {operator.name}
        {operator.registrationNumber ? `, ${operator.registrationNumber}` : ''}
        {operator.address ? `, cu sediul în ${operator.address}` : ''}
        {operator.email ? `. Ne poți scrie la ${operator.email}` : ''}.
      </LegalSection>
      <LegalSection title="2. Datele pe care le colectăm">
        Colectăm datele transmise voluntar prin formularele site-ului: nume, prenume, adresă de email, număr de telefon,
        detalii despre proiect, fotografii încărcate, înscrieri la cursuri și abonări la newsletter. Nu îți cerem date
        pe care nu le folosim și nu colectăm categorii speciale de date.
      </LegalSection>
      <LegalSection title="3. Scopul și temeiul prelucrării">
        Folosim datele pentru a răspunde solicitărilor de ofertă, a analiza proiectele, a contacta persoanele înscrise la
        cursuri și a transmite comunicările pe care le-ai cerut. Temeiul este consimțământul tău, exprimat prin bifa de pe
        formular (art. 6 alin. 1 lit. a GDPR). Îl poți retrage oricând, iar retragerea nu afectează prelucrarea de dinainte.
      </LegalSection>
      <LegalSection title="4. Fotografii și fișiere">
        Fotografiile încărcate sunt utilizate exclusiv pentru evaluarea solicitării și pregătirea unei propuneri. Sunt
        stocate separat, fără acces public, și nu le publicăm în portofoliu fără un acord separat.
      </LegalSection>
      <LegalSection title="5. Cât timp păstrăm datele">
        {operator.retentionPeriod}
      </LegalSection>
      <LegalSection title="6. Cine mai are acces">
        Datele sunt găzduite la furnizorii tehnici ai site-ului: Supabase (baza de date), Cloudflare R2 (fișiere) și Vercel
        (găzduirea aplicației). Aceștia prelucrează datele doar pentru a ne furniza serviciul, pe baza unor contracte de
        prelucrare.{operator.trackingEnabled ? ' Pentru măsurarea campaniilor, o formă criptată ireversibil a emailului și a numărului de telefon ajunge și la Meta Platforms Ireland Limited, care poate transfera date și în afara Uniunii Europene, pe baza clauzelor contractuale standard.' : ''} Nu vindem datele.
      </LegalSection>
      <LegalSection title="7. Cookie-uri">
        {operator.trackingEnabled
          ? 'Site-ul folosește un cookie strict necesar pentru autentificarea în panoul de administrare și instrumente de măsurare a campaniilor, printre care Meta Pixel, care plasează cookie-uri proprii în browserul tău. Când trimiți formularul de înscriere, transmitem către Meta și o formă criptată ireversibil (hash) a emailului și a numărului de telefon, ca să putem măsura rezultatele campaniilor. Poți bloca aceste cookie-uri din setările browserului sau dintr-o extensie de blocare, iar preferințele de publicitate le poți schimba direct din contul tău Meta. Blocarea lor nu afectează în niciun fel folosirea site-ului.'
          : 'Site-ul folosește un singur cookie, strict necesar pentru autentificarea în panoul de administrare. Nu folosim cookie-uri de analiză sau de publicitate și nu te urmărim pe alte site-uri.'}
      </LegalSection>
      <LegalSection title="8. Drepturile tale">
        Ai dreptul de acces la date, de rectificare, de ștergere, de restricționare a prelucrării, de opoziție, de
        portabilitate și de retragere a consimțământului. Ne poți scrie
        {operator.email ? ` la ${operator.email}` : ''} și îți răspundem în cel mult o lună.
      </LegalSection>
      <LegalSection title="9. Plângeri">
        Dacă nu ești mulțumit de răspunsul nostru, te poți adresa Autorității Naționale de Supraveghere a Prelucrării
        Datelor cu Caracter Personal, B-dul G-ral. Gheorghe Magheru 28-30, Sector 1, cod poștal 010336, București, sau
        online pe dataprotection.ro.
      </LegalSection>
    </>
  );
}

function TermsSections() {
  return (
    <>
      <LegalSection title="1. Utilizarea site-ului">
        Site-ul prezintă serviciile, proiectele, produsele și cursurile IV Concept. Informațiile au caracter general și pot
        fi actualizate fără notificare prealabilă.
      </LegalSection>
      <LegalSection title="2. Oferte și comenzi">
        Trimiterea unui formular nu reprezintă încheierea automată a unui contract. Prețul, dimensiunile, materialele,
        termenul și condițiile finale sunt confirmate individual printr-o ofertă acceptată de ambele părți.
      </LegalSection>
      <LegalSection title="3. Înscrierea la curs">
        Completarea formularului de înscriere este o solicitare de contact, nu o rezervare confirmată. Locul, data,
        programul și costul participării se confirmă separat, după ce te contactăm.
      </LegalSection>
      <LegalSection title="4. Produse personalizate">
        Aspectul produselor realizate manual poate prezenta variații naturale de textură și nuanță. Pentru produsele
        executate pe dimensiuni sau specificații personalizate se aplică termenii comunicați în oferta individuală.
      </LegalSection>
      <LegalSection title="5. Proprietate intelectuală">
        Textele, imaginile, logo-ul, proiectele și materialele vizuale de pe site aparțin IV Concept sau sunt utilizate cu
        permisiune. Reproducerea sau utilizarea lor comercială fără acord scris este interzisă.
      </LegalSection>
      <LegalSection title="6. Răspundere">
        Depunem eforturi pentru ca informațiile să fie corecte și site-ul disponibil, însă nu garantăm funcționarea
        neîntreruptă și nu răspundem pentru probleme cauzate de servicii externe sau utilizarea necorespunzătoare a site-ului.
      </LegalSection>
      <LegalSection title="7. Legea aplicabilă">
        Acești termeni sunt guvernați de legislația din România. Eventualele neînțelegeri vor fi soluționate mai întâi pe
        cale amiabilă, iar apoi de instanțele competente.
      </LegalSection>
    </>
  );
}

export function LegalSections({ document }: { document: LegalDocument }) {
  return document === 'privacy' ? <PrivacySections /> : <TermsSections />;
}
