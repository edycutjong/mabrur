import { redirect } from "next/navigation";

// `/` is rewritten to the static landing page (next.config.ts → public/landing/index.html) before this route runs.
// This only answers where rewrites are unavailable (e.g. the static IPFS export): send the visitor to the same page.
export default function Home() {
  redirect("/landing/index.html");
}
