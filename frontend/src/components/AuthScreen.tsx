import { supabase } from '../supabaseClient';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { Bot } from 'lucide-react';

export function AuthScreen() {
  return (
    <div className="auth-wall-container">
      <div className="auth-card-wrapper">
        <div className="auth-branding">
          <Bot size={40} className="icon-emerald" />
          <h1>Nikoff Gateway</h1>
          <p>Authenticate to connect to the cloud model grid infrastructure.</p>
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
