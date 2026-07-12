import React, { useState } from 'react';
import SplitText from "./SplitText";

const initialForm = {
  name: '',
  email: '',
  phone: '',
  projectDetails: '',
};

export default function FormSection() {
  const [formData, setFormData] = useState(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Numele este obligatoriu.';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email-ul este obligatoriu.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = 'Formatul email-ului este invalid.';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Numărul de telefon este obligatoriu.';
    } else if (!/^[+0-9\s-()]{7,20}$/.test(formData.phone.trim())) {
      newErrors.phone = 'Numărul de telefon este invalid.';
    }

    if (!formData.projectDetails.trim()) {
      newErrors.projectDetails = 'Detaliile lucrării sunt obligatorii.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setStatus('submitting');
    setMessage('');

    // The API stores first/last name separately; send both the full name and
    // a split fallback so older server builds keep working too
    const tokens = formData.name.trim().split(/\s+/);
    const payload = {
      name: formData.name.trim(),
      firstName: tokens[0],
      lastName: tokens.slice(1).join(' ') || tokens[0],
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      projectDetails: formData.projectDetails.trim(),
    };

    try {
      const response = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'A apărut o eroare la trimitere.');
      }

      setStatus('success');
      setMessage('Solicitarea a fost trimisă cu succes! Te vom contacta în curând.');
      setFormData(initialForm);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Trimiterea a eșuat. Te rugăm să încerci din nou.');
    }
  };

  const inputClass = (field: string) =>
    `h-11 w-full rounded-lg border bg-white/50 px-3.5 text-sm text-[#2c2218] outline-none transition placeholder:text-[#2c2218]/35 ${
      errors[field] ? 'border-red-500/60 focus:border-red-600' : 'border-[#2c2218]/15 focus:border-[#8f6b3a]'
    }`;

  const labelClass = 'block text-[10px] font-semibold uppercase tracking-[0.16em] text-[#2c2218]/55';

  return (
    <section id="contact" className="relative z-40 border-t border-white/10 bg-[#e8e0d6] text-[#2c2218]">
      <div className="mx-auto max-w-[1340px] px-6 py-14 md:px-16 md:py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_minmax(0,560px)] lg:items-start lg:gap-14">
          {/* Left info column */}
          <div>
            <span className="block text-[10px] md:text-xs text-[#c5a880] tracking-[0.25em] font-sans font-bold uppercase">
              [ SOLICITĂ OFERTĂ ]
            </span>
            <h2 className="mt-4 font-display text-3xl font-light leading-tight tracking-tight text-[#2c2218] md:text-5xl">
              <SplitText
                  text="Trimite detaliile proiectului tău."
                  className="text-2xl font-semibold text-center"
                  delay={50}
                  duration={1.25}
                  ease="power3.out"
                  splitType="chars"
                  from={{ opacity: 0, y: 10 }}
                  to={{ opacity: 1, y: 0 }}
                  threshold={0.1}
                  rootMargin="-100px"
                  textAlign="center"
                />
            </h2>
            <p className="mt-5 max-w-[400px] font-sans text-sm font-light leading-relaxed text-[#2c2218]/50">
              Completează formularul și revenim cu o propunere personalizată în cel mai scurt timp.
            </p>
          </div>

          {/* Right form column */}
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-[#2c2218]/10 bg-[#e8e0d6] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.4)] sm:p-6 md:p-7"
            noValidate
          >
            <div className="space-y-4">
              {/* Nume */}
              <div className="space-y-1.5">
                <label htmlFor="name" className={labelClass}>
                  Nume *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  autoComplete="name"
                  value={formData.name}
                  onChange={handleChange}
                  disabled={status === 'submitting'}
                  placeholder="Numele complet"
                  className={inputClass('name')}
                />
                {errors.name && <span className="block text-xs text-red-400">{errors.name}</span>}
              </div>

              {/* Email + Telefon */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="email" className={labelClass}>
                    Email *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    autoComplete="email"
                    value={formData.email}
                    onChange={handleChange}
                    disabled={status === 'submitting'}
                    placeholder="nume@email.com"
                    className={inputClass('email')}
                  />
                  {errors.email && <span className="block text-xs text-red-400">{errors.email}</span>}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="phone" className={labelClass}>
                    Telefon *
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    autoComplete="tel"
                    value={formData.phone}
                    onChange={handleChange}
                    disabled={status === 'submitting'}
                    placeholder="0722 000 000"
                    className={inputClass('phone')}
                  />
                  {errors.phone && <span className="block text-xs text-red-400">{errors.phone}</span>}
                </div>
              </div>

              {/* Detalii */}
              <div className="space-y-1.5">
                <label htmlFor="projectDetails" className={labelClass}>
                  Detalii lucrare *
                </label>
                <textarea
                  id="projectDetails"
                  name="projectDetails"
                  value={formData.projectDetails}
                  onChange={handleChange}
                  disabled={status === 'submitting'}
                  rows={4}
                  placeholder="Descrie pe scurt lucrarea dorită (dimensiuni, design, termene etc.)."
                  className={`w-full rounded-lg border bg-white/50 px-3.5 py-2.5 text-sm text-[#2c2218] outline-none transition placeholder:text-[#2c2218]/35 ${
                    errors.projectDetails
                      ? 'border-red-500/60 focus:border-red-600'
                      : 'border-[#2c2218]/15 focus:border-[#8f6b3a]'
                  }`}
                />
                {errors.projectDetails && (
                  <span className="block text-xs text-red-400">{errors.projectDetails}</span>
                )}
              </div>

              {/* Success/Error message */}
              {message && (
                <div
                  className={`rounded-lg border px-3.5 py-2.5 text-xs leading-relaxed ${
                    status === 'success'
                      ? 'border-emerald-700/30 bg-emerald-600/10 text-emerald-800'
                      : 'border-red-600/30 bg-red-600/10 text-red-700'
                  }`}
                  role="status"
                >
                  {message}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={status === 'submitting'}
                className="flex w-full items-center justify-between border-t border-[#2c2218]/20 pt-4 text-left font-sans text-[13px] font-semibold uppercase tracking-[0.06em] text-[#2c2218] transition hover:text-[#8f6b3a] disabled:opacity-50 disabled:hover:text-[#2c2218]"
              >
                <span>{status === 'submitting' ? 'Se trimite...' : 'Trimite cererea'}</span>
                <span aria-hidden className="text-[20px] leading-none">
                  &rarr;
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
