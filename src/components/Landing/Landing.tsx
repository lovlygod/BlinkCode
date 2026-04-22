import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Minus, ChevronRight } from 'lucide-react';
import BlinkLogoIcon from '../common/BlinkLogoIcon';
import { getLandingDict } from '../../utils/landingI18n';
import './Landing.css';

export default function Landing() {
  const { lang } = useParams<{ lang: string }>();
  const t = getLandingDict(lang || 'en');
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const FEATURES = [
    { label: t.f1Label, text: t.f1Text },
    { label: t.f2Label, text: t.f2Text },
    { label: t.f3Label, text: t.f3Text },
    { label: t.f4Label, text: t.f4Text },
    { label: t.f5Label, text: t.f5Text },
    { label: t.f6Label, text: t.f6Text },
    { label: t.f7Label, text: t.f7Text },
    { label: t.f8Label, text: t.f8Text },
  ];

  const STATS = [
    { value: '11', label: t.statThemes },
    { value: '100+', label: t.statLanguages },
    { value: '16', label: t.statShortcuts },
    { value: '6', label: t.statFonts },
  ];

  const PRIVACY = [t.p1, t.p2, t.p3, t.p4];

  const FAQ = [
    { q: t.faq1q, a: t.faq1a },
    { q: t.faq2q, a: t.faq2a },
    { q: t.faq3q, a: t.faq3a },
    { q: t.faq4q, a: t.faq4a },
    { q: t.faq5q, a: t.faq5a },
    { q: t.faq6q, a: t.faq6a },
    { q: t.faq7q, a: t.faq7a },
    { q: t.faq8q, a: t.faq8a },
    { q: t.faq9q, a: t.faq9a },
  ];

  const prefix = lang ? `/${lang}` : '';

  return (
    <div className="landing">
      <nav className="landing-nav">
        <div className="landing-nav-left">
          <a href={prefix || '/'} className="landing-nav-logo-link">
            <BlinkLogoIcon className="landing-nav-logo" />
          </a>
          <a href="https://github.com/lovlygod/BlinkCode" target="_blank" rel="noopener noreferrer" className="landing-nav-link">GitHub</a>
          <div className="landing-nav-lang">
            <a href="/en" className={`landing-lang-link ${(!lang || lang === 'en') ? 'active' : ''}`}>EN</a>
            <a href="/ru" className={`landing-lang-link ${lang === 'ru' ? 'active' : ''}`}>RU</a>
          </div>
        </div>
        <div className="landing-nav-right">
          <button className="landing-nav-cta" onClick={() => navigate('/editor')}>
            <span>{t.openEditor}</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </nav>

      <div className="landing-container">
        <section className="landing-hero">
          <h1 className="landing-hero-title">
            {t.heroTitle1}<br />{t.heroTitle2}
          </h1>
          <p className="landing-hero-sub">
            {t.heroSub1}<br />{t.heroSub2}
          </p>
        </section>

        <section className="landing-section">
          <h3 className="landing-section-title">{t.whatTitle}</h3>
          <p className="landing-section-intro">{t.whatIntro}</p>
          <ul className="landing-feature-list">
            {FEATURES.map((f, i) => (
              <li key={i} className="landing-feature-item">
                <div className="landing-feature-text">
                  <strong>{f.label}</strong> {f.text}
                </div>
              </li>
            ))}
          </ul>
          <a className="landing-section-link" onClick={() => navigate('/editor')}>
            {t.openEditor} <ChevronRight size={14} />
          </a>
        </section>

        <section className="landing-section">
          <h3 className="landing-section-title">{t.statsTitle}</h3>
          <div className="landing-stats">
            {STATS.map(s => (
              <div key={s.label} className="landing-stat">
                <div className="landing-stat-row">
                  <strong>{s.value}</strong>
                  <span>{s.label}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="landing-section">
          <h3 className="landing-section-title">{t.privacyTitle}</h3>
          <ul className="landing-privacy-list">
            {PRIVACY.map((p, i) => (
              <li key={i} className="landing-privacy-item">
                <div className="landing-privacy-text">{p}</div>
              </li>
            ))}
          </ul>
        </section>

        <section className="landing-section landing-faq-section">
          <h3 className="landing-section-title">{t.faqTitle}</h3>
          <ul className="landing-faq-list">
            {FAQ.map((item, i) => (
              <li key={i} className="landing-faq-item">
                <button
                  className="landing-faq-question"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="landing-faq-icon">
                    {openFaq === i ? <Minus size={16} /> : <Plus size={16} />}
                  </span>
                  <span className="landing-faq-q-text">{item.q}</span>
                </button>
                {openFaq === i && (
                  <div className="landing-faq-answer">{item.a}</div>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <footer className="landing-footer">
        <div className="landing-footer-left">
          <BlinkLogoIcon className="landing-footer-logo" />
          <span className="landing-footer-name">
            <span className="blink">Blink</span><span className="wht">Code</span>
          </span>
        </div>
        <div className="landing-footer-links">
          <a href="https://github.com/lovlygod/BlinkCode" target="_blank" rel="noopener noreferrer">GitHub</a>
        </div>
        <div className="landing-footer-copy">
          {t.footerTech}
        </div>
      </footer>
    </div>
  );
}
