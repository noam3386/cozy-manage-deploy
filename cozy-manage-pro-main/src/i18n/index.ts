import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import he from './locales/he';
import en from './locales/en';
import fr from './locales/fr';

const savedLanguage = localStorage.getItem('app-language') || 'he';

i18n.use(initReactI18next).init({
  resources: { he: { translation: he }, en: { translation: en }, fr: { translation: fr } },
  lng: savedLanguage,
  fallbackLng: 'he',
interpolation: { escapeValue: false },
  initImmediate: false,
});

export const getDirection = (lang?: string): 'rtl' | 'ltr' => {
  return (lang || i18n.language) === 'he' ? 'rtl' : 'ltr';
};

// Set initial direction
document.documentElement.dir = getDirection(savedLanguage);
document.documentElement.lang = savedLanguage;

export default i18n;
