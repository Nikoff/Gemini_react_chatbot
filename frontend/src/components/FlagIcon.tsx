import type { Locale } from '../context/I18nContext';

export function FlagIcon({ locale }: { locale: Locale }) {
  if (locale === 'ru') {
    return (
      <svg viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg">
        <rect width="640" height="160" fill="#fff"/>
        <rect y="160" width="640" height="160" fill="#0039a6"/>
        <rect y="320" width="640" height="160" fill="#d52b1e"/>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 60 30" xmlns="http://www.w3.org/2000/svg">
      <clipPath id="s">
        <path d="M0,0 v30 h60 v-30 z"/>
      </clipPath>
      <clipPath id="t">
        <path d="M0,0 l30,15 L0,30 z"/>
      </clipPath>
      <g clipPath="url(#s)">
        <path d="M0,0 v30 h60 v-30 z" fill="#012169"/>
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6"/>
        <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#t)" stroke="#C8102E" strokeWidth="4"/>
        <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10"/>
        <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6"/>
      </g>
    </svg>
  );
}
