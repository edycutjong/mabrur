import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// The ID/EN switch is CSS (styles/mabrur.css): mirror its three rules so jsdom's computed style — and so
// getByRole names, toBeVisible — sees only the active language, as a browser does. Tests switch with
// document.documentElement.classList.add("lang-en").
const style = document.createElement("style");
style.textContent = ".t-en{display:none}html.lang-en .t-en{display:inline}html.lang-en .t-id{display:none}";
document.head.appendChild(style);

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove("lang-en");
  document.documentElement.setAttribute("lang", "id");
});
