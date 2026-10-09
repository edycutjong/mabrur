// One ID/EN switch for the whole site, shared with the static landing (public/landing/index.html) and the deck:
// the same localStorage key, the same default (Indonesian) and the same `html.lang-en` class. Both language variants
// are always rendered (<T/>); CSS shows one. So the server HTML never depends on the viewer's choice — no hydration
// mismatch — and the inline boot script below sets the class before first paint — no flash.

export type Lang = "id" | "en";

export const LANG_KEY = "mabrur-lang";
export const LANG_CLASS = "lang-en";

/** The language the page is showing right now (the class on <html> is the single source of truth). */
export const currentLang = (): Lang =>
  typeof document !== "undefined" && document.documentElement.classList.contains(LANG_CLASS) ? "en" : "id";

/** Switch the whole page, exactly like the landing's setLang(): class, <html lang>, and the shared storage key. */
export const applyLang = (lang: Lang) => {
  const root = document.documentElement;
  root.classList.toggle(LANG_CLASS, lang === "en");
  root.setAttribute("lang", lang);
  try {
    window.localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* storage blocked: the choice lasts for this page only */
  }
};

/** Runs in <head> before first paint (app/layout.tsx): only "en" is stored as a non-default, as on the landing. */
export const LANG_BOOT_SCRIPT = `(function(){try{if(localStorage.getItem(${JSON.stringify(LANG_KEY)})==="en"){var r=document.documentElement;r.classList.add(${JSON.stringify(LANG_CLASS)});r.setAttribute("lang","en")}}catch(e){}})();`;

/** A string in both languages: used where markup cannot carry both variants (attributes, <option>, document text). */
export type Bilingual = { id: string; en: string };

export const pick = (lang: Lang, s: Bilingual): string => (lang === "en" ? s.en : s.id);
