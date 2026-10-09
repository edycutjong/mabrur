import { ReactNode } from "react";

/**
 * One piece of UI text in both languages. Both variants are rendered (server-side too); CSS shows the one matching
 * `html.lang-en` (styles/mabrur.css, same rule as the landing's `.t-id` / `.t-en`). The hidden variant is
 * display:none, so it is out of the accessibility tree as well. Identical strings render once.
 */
export const T = ({ id, en }: { id: ReactNode; en: ReactNode }) =>
  typeof id === "string" && id === en ? (
    <>{id}</>
  ) : (
    <>
      <span className="t-id">{id}</span>
      <span className="t-en" lang="en">
        {en}
      </span>
    </>
  );
