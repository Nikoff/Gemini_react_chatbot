import { Bot, Check, Zap, Users, Star, ArrowRight } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useI18n } from '../context/I18nContext';
import { api } from '../utils/apiClient';

interface Props {
  onLogin: () => void;
}

export function LandingPage({ onLogin }: Props) {
  const { locale, setLocale, t } = useI18n();

  const plans = [
    {
      name: t('landing.plan.free'),
      price: t('landing.plan.freePrice'),
      period: t('landing.plan.freePeriod'),
      description: t('landing.plan.freeDesc'),
      features: [t('landing.plan.freeFeat1'), t('landing.plan.freeFeat2'), t('landing.plan.freeFeat3'), t('landing.plan.freeFeat4')],
      cta: t('landing.plan.freeCta'),
      icon: <Zap size={24} />,
      highlighted: false,
    },
    {
      name: t('landing.plan.pro'),
      price: t('landing.plan.proPrice'),
      period: t('landing.plan.proPeriod'),
      description: t('landing.plan.proDesc'),
      features: [t('landing.plan.proFeat1'), t('landing.plan.proFeat2'), t('landing.plan.proFeat3'), t('landing.plan.proFeat4'), t('landing.plan.proFeat5'), t('landing.plan.proFeat6'), t('landing.plan.proFeat7')],
      cta: t('landing.plan.proCta'),
      icon: <Star size={24} />,
      highlighted: true,
      priceId: 'pro_monthly',
    },
    {
      name: t('landing.plan.team'),
      price: t('landing.plan.teamPrice'),
      period: t('landing.plan.teamPeriod'),
      description: t('landing.plan.teamDesc'),
      features: [t('landing.plan.teamFeat1'), t('landing.plan.teamFeat2'), t('landing.plan.teamFeat3'), t('landing.plan.teamFeat4'), t('landing.plan.teamFeat5'), t('landing.plan.teamFeat6'), t('landing.plan.teamFeat7')],
      cta: t('landing.plan.teamCta'),
      icon: <Users size={24} />,
      highlighted: false,
    },
  ];

  const features = [
    { title: t('landing.feat1.title'), description: t('landing.feat1.desc'), icon: '\ud83c\udfa8' },
    { title: t('landing.feat2.title'), description: t('landing.feat2.desc'), icon: '\u26a1' },
    { title: t('landing.feat3.title'), description: t('landing.feat3.desc'), icon: '\ud83d\udd27' },
    { title: t('landing.feat4.title'), description: t('landing.feat4.desc'), icon: '\ud83c\udf3f' },
    { title: t('landing.feat5.title'), description: t('landing.feat5.desc'), icon: '\ud83d\udce6' },
    { title: t('landing.feat6.title'), description: t('landing.feat6.desc'), icon: '\ud83d\udd17' },
  ];

  const handleCheckout = async (priceId?: string) => {
    if (!priceId) {
      onLogin();
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        onLogin();
        return;
      }

      const { url } = await api<{ url: string }>('/api/subscription/checkout', {
        method: 'POST',
        body: { priceId },
        token: session.access_token,
      });
      window.location.href = url;
    } catch (err) {
      console.error('Checkout failed:', err);
    }
  };

  return (
    <div className="landing-page">
      <nav className="landing-nav">
        <div className="landing-nav-content">
          <div className="landing-logo">
            <Bot size={28} />
            <span>Nikoff</span>
          </div>
          <div className="lang-flags">
            <button
              className={`lang-flag-btn ${locale === 'en' ? 'active' : ''}`}
              onClick={() => setLocale('en')}
              title="English"
            >
              <img src="https://flagcdn.com/w40/gb.png" alt="EN" className="flag-img" />
            </button>
            <button
              className={`lang-flag-btn ${locale === 'ru' ? 'active' : ''}`}
              onClick={() => setLocale('ru')}
              title="Russian"
            >
              <img src="https://flagcdn.com/w40/ru.png" alt="RU" className="flag-img" />
            </button>
          </div>
          <button className="landing-nav-btn" onClick={onLogin}>
            {t('landing.signIn')} <ArrowRight size={16} />
          </button>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-content">
          <h1 className="landing-hero-title">
            {t('landing.heroTitle1')}<br />
            <span className="gradient-text">{t('landing.heroTitle2')}</span>
          </h1>
          <p className="landing-hero-subtitle">
            {t('landing.heroSubtitle')}
          </p>
          <div className="landing-hero-actions">
            <button className="landing-cta-primary" onClick={onLogin}>
              {t('landing.startFree')} <ArrowRight size={18} />
            </button>
            <button className="landing-cta-secondary" onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}>
              {t('landing.viewPricing')}
            </button>
          </div>
        </div>
      </section>

      <section className="landing-features">
        <h2 className="section-title">{t('landing.featuresTitle')}</h2>
        <p className="section-subtitle">{t('landing.featuresSub')}</p>
        <div className="features-grid">
          {features.map((f, i) => (
            <div key={i} className="feature-card">
              <span className="feature-icon">{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="landing-pricing">
        <h2 className="section-title">{t('landing.pricingTitle')}</h2>
        <p className="section-subtitle">{t('landing.pricingSub')}</p>
        <div className="pricing-grid">
          {plans.map((plan, i) => (
            <div
              key={i}
              className={`pricing-card ${plan.highlighted ? 'highlighted' : ''}`}
            >
              {plan.highlighted && <div className="pricing-badge">{t('landing.mostPopular')}</div>}
              <div className="pricing-icon">{plan.icon}</div>
              <h3>{plan.name}</h3>
              <div className="pricing-price">
                <span className="price">{plan.price}</span>
                <span className="period">{plan.period}</span>
              </div>
              <p className="pricing-description">{plan.description}</p>
              <ul className="pricing-features">
                {plan.features.map((f, j) => (
                  <li key={j}>
                    <Check size={16} />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                className={`pricing-cta ${plan.highlighted ? 'primary' : 'secondary'}`}
                onClick={() => handleCheckout(plan.priceId)}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      <footer className="landing-footer">
        <p>{t('landing.footer')}</p>
      </footer>
    </div>
  );
}
