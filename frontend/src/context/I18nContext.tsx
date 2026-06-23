import { createContext, useContext, useState, ReactNode } from 'react';

type Locale = 'en' | 'ru';

const translations: Record<Locale, Record<string, string>> = {
  en: {
    'app.title': 'Nikoff Free Chatbot',
    'auth.title': 'Nikoff Gateway',
    'auth.subtitle': 'Authenticate to connect to the cloud model grid infrastructure.',
    'sidebar.newChat': 'New Chat',
    'sidebar.recent': 'Recent Conversations',
    'sidebar.systemPrompt': 'System Prompt',
    'sidebar.admin': 'Admin',
    'sidebar.signOut': 'Sign Out',
    'chat.placeholder': 'Type a message...',
    'chat.placeholderImage': 'Add a caption...',
    'chat.placeholderAudio': 'Add a caption (optional)...',
    'chat.thinking': 'AI is thinking...',
    'chat.empty': 'How can I assist your workflow today?',
    'chat.emptySub': 'Select an LLM engine above to deploy complex processing arrays.',
    'chat.voiceReady': 'Voice message ready',
    'chat.dropImage': 'Drop image here',
    'chat.send': 'Send',
    'chat.search': 'Search messages...',
    'chat.exportJson': 'Export as JSON',
    'chat.exportMd': 'Export as Markdown',
    'chat.share': 'Share conversation',
    'chat.linkCopied': 'Link copied!',
    'admin.title': 'Admin Dashboard',
    'admin.users': 'Users',
    'admin.threads': 'Threads',
    'admin.messages': 'Messages',
    'admin.recentThreads': 'Recent Threads',
    'admin.makeAdmin': 'Make Admin',
    'admin.revoke': 'Revoke',
    'modal.systemPrompt': 'System Prompt',
    'modal.systemPromptDesc': 'Instructions for the AI in this conversation.',
    'modal.cancel': 'Cancel',
    'modal.save': 'Save',
    'error.title': 'Something went wrong',
    'error.desc': 'The application encountered an unexpected error.',
    'error.reload': 'Reload Page',
  },
  ru: {
    'app.title': 'Nikoff Чат-бот',
    'auth.title': 'Nikoff Шлюз',
    'auth.subtitle': 'Авторизуйтесь для подключения к облаку ИИ.',
    'sidebar.newChat': 'Новый чат',
    'sidebar.recent': 'Последние беседы',
    'sidebar.systemPrompt': 'Системная инструкция',
    'sidebar.admin': 'Админ',
    'sidebar.signOut': 'Выйти',
    'chat.placeholder': 'Введите сообщение...',
    'chat.placeholderImage': 'Добавьте подпись...',
    'chat.placeholderAudio': 'Добавьте подпись (необязательно)...',
    'chat.thinking': 'ИИ думает...',
    'chat.empty': 'Чем я могу помочь сегодня?',
    'chat.emptySub': 'Выберите модель выше для начала работы.',
    'chat.voiceReady': 'Голосовое сообщение готово',
    'chat.dropImage': 'Перетащите изображение сюда',
    'chat.send': 'Отправить',
    'chat.search': 'Поиск сообщений...',
    'chat.exportJson': 'Экспорт в JSON',
    'chat.exportMd': 'Экспорт в Markdown',
    'chat.share': 'Поделиться беседой',
    'chat.linkCopied': 'Ссылка скопирована!',
    'admin.title': 'Панель администратора',
    'admin.users': 'Пользователи',
    'admin.threads': 'Беседы',
    'admin.messages': 'Сообщения',
    'admin.recentThreads': 'Последние беседы',
    'admin.makeAdmin': 'Сделать админом',
    'admin.revoke': 'Отозвать',
    'modal.systemPrompt': 'Системная инструкция',
    'modal.systemPromptDesc': 'Инструкции для ИИ в этой беседе.',
    'modal.cancel': 'Отмена',
    'modal.save': 'Сохранить',
    'error.title': 'Что-то пошло не так',
    'error.desc': 'Приложение столкнулось с непредвиденной ошибкой.',
    'error.reload': 'Перезагрузить страницу',
  },
};

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  locale: 'en',
  setLocale: () => {},
  t: (key) => key,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => {
    return (localStorage.getItem('locale') as Locale) || 'en';
  });

  const handleSetLocale = (newLocale: Locale) => {
    setLocale(newLocale);
    localStorage.setItem('locale', newLocale);
  };

  const t = (key: string): string => {
    return translations[locale]?.[key] || translations.en[key] || key;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale: handleSetLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
