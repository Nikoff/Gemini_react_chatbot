import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../context/I18nContext';
import { Palette, X, Image, GitBranch, Bot } from 'lucide-react';

interface Props {
  onOpenGeneration?: () => void;
  onOpenWorkflowEditor?: () => void;
  onOpenAgentDashboard?: () => void;
}

export function ThemeSwitcher({ onOpenGeneration, onOpenWorkflowEditor, onOpenAgentDashboard }: Props) {
  const { theme, setTheme, themes } = useTheme();
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="theme-switcher">
      <div className="theme-switcher-buttons">
        {onOpenAgentDashboard && (
          <button className="theme-toggle-btn agent-btn" onClick={onOpenAgentDashboard} title="Agent Dashboard">
            <Bot size={18} />
          </button>
        )}
        {onOpenWorkflowEditor && (
          <button className="theme-toggle-btn workflow-btn" onClick={onOpenWorkflowEditor} title="Workflow Editor">
            <GitBranch size={18} />
          </button>
        )}
        {onOpenGeneration && (
          <button className="theme-toggle-btn gen-btn" onClick={onOpenGeneration} title="Generate Image">
            <Image size={18} />
          </button>
        )}
        {!isOpen ? (
          <button className="theme-toggle-btn" onClick={() => setIsOpen(true)} title={t('app.title')}>
            <Palette size={18} />
          </button>
        ) : (
          <div className="theme-switcher-panel">
            <div className="theme-switcher-header">
              <span className="theme-switcher-label">{t('theme.title')}</span>
              <button className="theme-close-btn" onClick={() => setIsOpen(false)}>
                <X size={14} />
              </button>
            </div>
            <div className="theme-options">
              {themes.map((t) => (
                <button
                  key={t.id}
                  className={`theme-option ${theme === t.id ? 'active' : ''}`}
                  onClick={() => setTheme(t.id)}
                  title={t.name}
                >
                  <span className="theme-icon">{t.icon}</span>
                  <span className="theme-name">{t.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
