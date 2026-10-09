"use client";

import { useLangToggle } from "~~/hooks/mabrur/useLang";

/**
 * The "ID | EN" pill, styled and named like the landing's `.lang` button so the switch reads as one control across
 * the site. The highlighted half is drawn by CSS from the <html> class (no flash before hydration); aria-pressed says
 * whether English is on.
 */
export const LangToggle = () => {
  const { lang, toggle } = useLangToggle();
  return (
    <button
      type="button"
      className="mb-lang"
      onClick={toggle}
      aria-pressed={lang === "en"}
      aria-label="ID EN · Ganti bahasa / switch language"
      data-testid="lang-toggle"
    >
      <span data-l="id">ID</span> <span data-l="en">EN</span>
    </button>
  );
};
