"use client";

import { useCallback, useSyncExternalStore } from "react";
import { Lang, applyLang, currentLang } from "~~/utils/mabrur/i18n";

// The <html> class is the store: the boot script, this app's toggle and nothing else write it. The server (and the
// hydration pass) always read "id"; React then re-renders with the real value without a hydration mismatch.
const subscribe = (onChange: () => void) => {
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => mo.disconnect();
};
const serverLang = (): Lang => "id";

/** The current language, for the few things CSS cannot switch: attributes (aria-label, placeholder, title), <option>. */
export const useLang = (): Lang => useSyncExternalStore(subscribe, currentLang, serverLang);

/** `t(id, en)` → the string for the current language. */
export const useT = () => {
  const lang = useLang();
  return useCallback((id: string, en: string) => (lang === "en" ? en : id), [lang]);
};

/** The language plus a toggle that flips the whole page and remembers the choice (shared with the landing). */
export const useLangToggle = () => {
  const lang = useLang();
  const toggle = useCallback(() => applyLang(currentLang() === "en" ? "id" : "en"), []);
  return { lang, toggle };
};
