import { redirect } from "next/navigation";

// The landing page will live here later; until then the product is at /app.
export default function Home() {
  redirect("/app");
}
