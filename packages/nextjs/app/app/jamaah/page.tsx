import JamaahScreen from "./JamaahScreen";

type Search = Record<string, string | string[] | undefined>;

/** The first value of a query param (Next gives an array when a key repeats). */
export const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// Rendered per request: the server reads ?id= / ?pilgrim= so the first HTML is the deep-linked passbook layout (its
// heading and reserved height), not a generic page that jumps once the client sees the URL (mobile CLS).
export default async function JamaahPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  return <JamaahScreen initialId={first(sp.id)} initialPilgrim={first(sp.pilgrim)} />;
}
