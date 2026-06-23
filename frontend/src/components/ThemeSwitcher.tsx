import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { Palette, X } from 'lucide-react';

export function ThemeSwitcher() {
  const { theme, setTheme, themes } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`theme-switcher ${isOpen ? 'open' : ''}`}>
      {!isOpen ? (
        <button className="theme-toggle-btn" onClick={() => setIsOpen(true)} title="Themes">
          <Palette size={18} />
        </button>
      ) : (
        <>
          <div className="theme-switcher-header">
            <span className="theme-switcher-label">Theme</span>
            <button className="theme-close-btn" onClick={() => setIsOpen(false)}>
              <X size={14} />
            </button>
          </div>
          <div className="theme-options">
            {themes.map((t) => (
              <button
                key={t.id}
                className={`theme-option ${theme === t.id ? 'active' : ''}`}
                onClick={() => { setTheme(t.id); setIsOpen(false); }}
                title={t.name}
              >
                <span className="theme-icon">{t.icon}</span>
                <span className="theme-name">{t.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
