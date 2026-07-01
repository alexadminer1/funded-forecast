/**
 * scripts/imovirtual-probe.ts
 * One-shot diagnostic script for imovirtual.com source.
 * Does NOT write to DB, does NOT download photos, does NOT touch src/.
 *
 * Run: npx tsx scripts/imovirtual-probe.ts
 */

const BASE_URL = "https://www.imovirtual.com";
const BASE_PATH = "/pt/resultados/comprar/apartamento/lisboa/cascais";
const DESCRIPTION = encodeURIComponent("vista mar");
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Accept-Language": "pt-PT,pt;q=0.9",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
};

interface Listing {
  id: string;
  title: string;
  price: string;
  location: string;
  link: string;
}

interface ProbeResult {
  url: string;
  status: number;
  blocked: boolean;
  count: number | null;
  listings: Listing[];
  bodyPreview: string;
}

function buildUrl(page?: number): string {
  const description = encodeURIComponent("vista mar");
  const url = new URL(`${BASE_URL}${BASE_PATH}`);
  url.searchParams.set("description", "vista mar");
  if (page && page > 1) {
    url.searchParams.set("page", String(page));
  }
  return url.toString();
}

async function fetchPage(page?: number): Promise<ProbeResult> {
  const url = buildUrl(page);
  console.log(`\n→ GET ${url}`);

  const res = await fetch(url, { headers: HEADERS });
  const status = res.status;
  const html = await res.text();
  const bodyPreview = html.substring(0, 300);

  // Check for DataDome / captcha block
  const blocked =
    status === 403 ||
    status === 429 ||
    html.includes("datadome") ||
    html.includes("DataDome") ||
    html.includes("captcha") ||
    html.includes("Captcha") ||
    html.includes("Just a moment") ||
    html.toLowerCase().includes("access denied");

  if (blocked) {
    console.error(`  ⛔  BLOCKED — HTTP ${status}`);
    console.error(`  Body preview: ${bodyPreview}`);
    return { url, status, blocked, count: null, listings: [], bodyPreview };
  }

  // Extract total count — «de XXXX anúncios»
  const countMatch = html.match(/de\s+([\d\s]+)\s*anúncios/);
  let count: number | null = null;
  if (countMatch) {
    count = parseInt(countMatch[1].replace(/\s/g, ""), 10);
  }

  // Extract listings — links /pt/anuncio/…-ID{id}
  const listings: Listing[] = [];
  const seenIds = new Set<string>();

  // Regex to find listing URLs
  const linkRe = /href="(\/pt\/anuncio\/[^"]+?-ID([^"]+?))"/g;
  // Regex to match listing data blocks (title, price, location)
  // We'll do a two-pass: first collect all IDs+links, then find surrounding context

  let match: RegExpExecArray | null;
  while ((match = linkRe.exec(html)) !== null) {
    const link = match[1];
    const id = match[2];
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    // Extract surrounding context to find title, price, location
    const pos = match.index;
    const context = html.substring(Math.max(0, pos - 2000), pos + 2000);

    // Extract title (from aria-label or title attribute near the link, or h3)
    const titleMatch =
      context.match(/data-cy="listing-item-title"[^>]*>\s*<[^>]*>([^<]+)</) ||
      context.match(/data-cy="listing-item-title"[^>]*>([^<]+)</) ||
      context.match(/<h3[^>]*>\s*<[^>]*>([^<]+)</) ||
      context.match(/<title[^>]*>([^<]+)</);
    const title = titleMatch
      ? titleMatch[1].trim().replace(/&amp;/g, "&")
      : "N/A";

    // Extract price
    const priceMatch =
      context.match(/data-cy="listing-item-price"[^>]*>\s*<[^>]*>([^<]+)</) ||
      context.match(/data-cy="listing-item-price"[^>]*>([^<]+)</);
    const price = priceMatch
      ? priceMatch[1].trim().replace(/&nbsp;/g, " ")
      : "N/A";

    // Extract location/address
    const addrMatch =
      context.match(/data-cy="advert-card-address"[^>]*>\s*<[^>]*>([^<]+)</) ||
      context.match(/data-cy="advert-card-address"[^>]*>([^<]+)</);
    const location = addrMatch ? addrMatch[1].trim() : "N/A";

    listings.push({ id, title, price, location, link });
  }

  return { url, status, blocked, count, listings, bodyPreview };
}

async function main() {
  console.log("=".repeat(60));
  console.log("IMOVIRTUAL PROBE — Diagnostic Script");
  console.log("=".repeat(60));

  // ── PAGE 1 ────────────────────────────────────────────────────
  const p1 = await fetchPage();

  if (p1.blocked) {
    console.log("\nRESULT: count=N/A, blocked=yes, pagination=N/A");
    process.exit(1);
  }

  const count = p1.count;

  // Self-check
  if (count === null) {
    console.warn("  ⚠  Could not parse count from page");
  } else if (count > 1000) {
    console.error(`  ✗  PARAMS DROPPED — count=${count} (expected ≈305, got >1000 → description filter not applied)`);
  } else {
    console.log(`  ✓  count=${count} — filter applied correctly (expected ≈305)`);
  }

  console.log(`\n── PAGE 1: first 5 listings ──────────────────────────────`);
  const page1Ids: string[] = [];
  p1.listings.slice(0, 5).forEach((l, i) => {
    page1Ids.push(l.id);
    console.log(`  [${i + 1}] id=${l.id}`);
    console.log(`      title:    ${l.title}`);
    console.log(`      price:    ${l.price}`);
    console.log(`      location: ${l.location}`);
    console.log(`      link:     ${l.link}`);
  });

  // ── PAGE 2 ────────────────────────────────────────────────────
  console.log(`\n── PAGE 2: first 3 IDs ───────────────────────────────────`);
  const p2 = await fetchPage(2);

  let paginationOk = false;
  if (p2.blocked) {
    console.error("  ⛔  Page 2 BLOCKED");
  } else {
    const page2Ids = p2.listings.slice(0, 3).map((l) => l.id);
    page2Ids.forEach((id, i) => {
      console.log(`  [${i + 1}] id=${id}`);
    });

    // Check pagination: IDs on page 2 must differ from page 1
    const overlap = page2Ids.filter((id) => page1Ids.includes(id));
    paginationOk = page2Ids.length > 0 && overlap.length === 0;

    if (paginationOk) {
      console.log("  ✓  Pagination OK — pages have different listings");
    } else {
      console.error(
        `  ✗  Pagination FAIL — overlap detected: ${JSON.stringify(overlap)}`
      );
    }
  }

  // ── FINAL RESULT ──────────────────────────────────────────────
  const blocked = p1.blocked || p2.blocked;
  console.log("\n" + "=".repeat(60));
  console.log(
    `RESULT: count=${count ?? "N/A"}, blocked=${blocked ? "yes" : "no"}, pagination=${paginationOk ? "ok" : "fail"}`
  );
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
