import React from "react";

/** Site footer: the honesty line, always visible. */
export const Footer = () => {
  return (
    <footer className="border-t border-[var(--rule)] mt-10">
      <div className="max-w-[1600px] mx-auto px-4 lg:px-8 py-5 text-sm mb-muted flex flex-wrap gap-x-6 gap-y-1">
        <span>tIDR = token uji tanpa nilai · test token, no value</span>
        <span>Nama agen &amp; vendor fiktif · fictional names</span>
        <span>Penerbit klaim = kunci demo · demo claim issuer</span>
      </div>
    </footer>
  );
};
