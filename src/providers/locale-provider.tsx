'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { translateToArabic } from '@/lib/i18n';

type Locale = 'en' | 'ar';

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (english: string, arabic?: string) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    const stored = window.localStorage.getItem('gatepass-locale');
    if (stored === 'ar' || stored === 'en') setLocaleState(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    window.localStorage.setItem('gatepass-locale', locale);
  }, [locale]);

  useEffect(() => {
    if (locale !== 'ar') return;
    const originalText = new Map<Text, string>();
    const translatedText = new Map<Text, string>();
    const originalAttributes = new Map<Element, Map<string, string>>();
    let applying = false;

    const translateNode = (root: Node) => {
      if (applying) return;
      applying = true;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node: Node | null = root.nodeType === Node.TEXT_NODE ? root : walker.nextNode();
      while (node) {
        const textNode = node as Text;
        if (!textNode.parentElement?.closest('script,style,[data-no-translate]')) {
          const previousOriginal = originalText.get(textNode);
          const previousTranslation = translatedText.get(textNode);
          const raw = previousOriginal === undefined || (textNode.data !== previousOriginal && textNode.data !== previousTranslation)
            ? textNode.data
            : previousOriginal;
          originalText.set(textNode, raw);
          const trimmed = raw.trim();
          const translated = translateToArabic(trimmed);
          if (translated !== trimmed) textNode.data = raw.replace(trimmed, translated);
          translatedText.set(textNode, textNode.data);
        }
        node = walker.nextNode();
      }
      const elements = root instanceof Element ? [root, ...root.querySelectorAll('*')] : [];
      for (const element of elements) {
        for (const attribute of ['placeholder', 'title', 'aria-label']) {
          const value = element.getAttribute(attribute);
          if (!value) continue;
          const originals = originalAttributes.get(element) ?? new Map<string, string>();
          if (!originalAttributes.has(element)) originalAttributes.set(element, originals);
          if (!originals.has(attribute)) originals.set(attribute, value);
          element.setAttribute(attribute, translateToArabic(originals.get(attribute) ?? value));
        }
      }
      applying = false;
    };

    translateNode(document.body);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) translateNode(node);
        if (mutation.type === 'characterData') translateNode(mutation.target);
      }
    });
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });
    return () => {
      observer.disconnect();
      applying = true;
      for (const [node, value] of originalText) {
        if (node.isConnected) node.data = value;
      }
      for (const [element, attributes] of originalAttributes) {
        if (!element.isConnected) continue;
        for (const [name, value] of attributes) element.setAttribute(name, value);
      }
      applying = false;
    };
  }, [locale]);

  const value = useMemo<LocaleContextValue>(() => ({
    locale,
    setLocale: setLocaleState,
    t: (english, arabic) => locale === 'ar' ? (arabic ?? translateToArabic(english)) : english,
  }), [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error('useLocale must be used inside LocaleProvider.');
  return context;
}
