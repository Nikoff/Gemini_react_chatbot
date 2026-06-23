import { useState } from 'react';
import { Bot, Check, Zap, Users, Building2, ArrowRight, Star } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useI18n } from '../context/I18nContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface Props {
  onLogin: () => void;
}

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: '/month',
    description: 'Perfect for trying out the AI assistant',
    features: ['50 messages/day', '3 conversations', 'Basic models only', 'Text input'],
    cta: 'Get Started Free',
    icon: <Zap size={24} />,
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$19',
    period: '/month',
    description: 'For power users who need unlimited access',
    features: ['Unlimited messages', 'Unlimited conversations', 'All AI models', 'Voice & image input', 'File upload', 'Custom system prompts', 'Priority support'],
    cta: 'Start Pro Trial',
    icon: <Star size={24} />,
    highlighted: true,
    priceId: 'pro_monthly',
  },
  {
    name: 'Team',
    price: '$49',
    period: '/user/month',
    description: 'For teams and organizations',
    features: ['Everything in Pro', 'Shared workspaces', 'Admin dashboard', 'SSO / SAML', 'Audit logs', 'Custom branding', 'Dedicated support'],
    cta: 'Contact Sales',
    icon: <Users size={24} />,
    highlighted: false,
  },
];

const features = [
  { title: 'Multi-Modal AI', description: 'Text, voice, and image understanding with Gemini models', icon: '🎨' },
  { title: 'Real-Time Streaming', description: 'See AI responses appear token by token in real-time', icon: '⚡' },
  { title: 'Smart Tools', description: 'Calculator, time, and custom function calling', icon: '🔧' },
  { title: 'Conversation Branching', description: 'Edit and regenerate from any point in the conversation', icon: '🌿' },
  { title: 'Context Compression', description: 'AI automatically summarizes long conversations', icon: '📦' },
  { title: 'Share & Collaborate', description: 'Share conversations with anyone via secure links', icon: '🔗' },
];

export function LandingPage({ onLogin }: Props) {
  const { t } = useI18n();
  const [hoveredPlan, setHoveredPlan] = useState<number | null>(null);

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

      const res = await fetch(`${API_URL}/api/subscription/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ priceId: process.env[`STRIPE_${priceId.toUpperCase()}_ID`] || priceId }),
      });

      if (res.ok) {
        const { url } = await res.json();
        window.location.href = url;
      }
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
          <button className="landing-nav-btn" onClick={onLogin}>
            Sign In <ArrowRight size={16} />
          </button>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-content">
          <h1 className="landing-hero-title">
            Your AI Assistant,<br />
            <span className="gradient-text">Powered by Gemini</span>
          </h1>
          <p className="landing-hero-subtitle">
            Chat with the most advanced AI models. Upload images, record voice, 
            and let AI help you with anything — from code to creative writing.
          </p>
          <div className="landing-hero-actions">
            <button className="landing-cta-primary" onClick={onLogin}>
              Start Free <ArrowRight size={18} />
            </button>
            <button className="landing-cta-secondary" onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}>
              View Pricing
            </button>
          </div>
        </div>
      </section>

      <section className="landing-features">
        <h2 className="section-title">Everything you need</h2>
        <p className="section-subtitle">Powerful features for every use case</p>
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
        <h2 className="section-title">Simple, transparent pricing</h2>
        <p className="section-subtitle">Choose the plan that fits your needs</p>
        <div className="pricing-grid">
          {plans.map((plan, i) => (
            <div
              key={i}
              className={`pricing-card ${plan.highlighted ? 'highlighted' : ''}`}
              onMouseEnter={() => setHoveredPlan(i)}
              onMouseLeave={() => setHoveredPlan(null)}
            >
              {plan.highlighted && <div className="pricing-badge">Most Popular</div>}
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
        <p>&copy; 2026 Nikoff AI. All rights reserved.</p>
      </footer>
    </div>
  );
}
