import { supabase } from '../supabaseClient';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { Bot } from 'lucide-react';
import { useI18n } from '../context/I18nContext';

export function AuthScreen() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="auth-wall-container">
      <div className="auth-card-wrapper">
        <div className="auth-branding">
          <Bot size={40} className="icon-emerald" />
          <h1>{t('auth.title')}</h1>
          <p>{t('auth.subtitle')}</p>
        </div>
        <div className="auth-lang-flags">
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
        <Auth
          supabaseClient={supabase}
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: '#3b82f6',
                  brandAccent: '#2563eb',
                  inputBackground: '#020617',
                  inputText: '#f8fafc',
                  inputBorder: '#1e293b',
                  inputPlaceholder: '#64748b'
                }
              }
            }
          }}
          theme="dark"
          providers={['google']}
        />
      </div>
    </div>
  );
}
