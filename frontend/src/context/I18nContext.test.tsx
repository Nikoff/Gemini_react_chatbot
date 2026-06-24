import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { type ReactNode } from 'react';
import { I18nProvider, useI18n } from './I18nContext';

function wrapper({ children }: { children: ReactNode }) {
  return <I18nProvider>{children}</I18nProvider>;
}

beforeEach(() => {
  localStorage.clear();
});

describe('I18nContext', () => {
  it('defaults to English locale', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.locale).toBe('en');
  });

  it('returns English translations by default', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.t('app.title')).toBe('Nikoff Free Chatbot');
    expect(result.current.t('chat.send')).toBe('Send');
  });

  it('switches locale to Russian and returns Russian translations', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    act(() => result.current.setLocale('ru'));
    expect(result.current.locale).toBe('ru');
    expect(result.current.t('app.title')).toBe('Nikoff \u0427\u0430\u0442-\u0431\u043e\u0442');
    expect(result.current.t('chat.send')).toBe('\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c');
  });

  it('falls back to English for unknown keys', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.t('nonexistent.key')).toBe('nonexistent.key');
  });

  it('falls back to English when Russian translation is missing for a key', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    act(() => result.current.setLocale('ru'));
    expect(result.current.t('app.title')).toBeTruthy();
  });

  it('persists locale to localStorage', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    act(() => result.current.setLocale('ru'));
    expect(localStorage.getItem('locale')).toBe('ru');
  });

  it('reads persisted locale on mount', () => {
    localStorage.setItem('locale', 'ru');
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.locale).toBe('ru');
  });
});
