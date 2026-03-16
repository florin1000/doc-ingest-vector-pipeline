import * as cheerio from "cheerio";

export interface ParsedHtml {
  url: string;
  title: string;
  text: string;
  html: string;
  fetchedAt: string;
}

const FETCH_TIMEOUT_MS = 15000;
const MIN_USEFUL_TEXT_LENGTH = 200;

const NOISE_SELECTORS = [
  "script",
  "style",
  "noscript",
  "svg",
  "canvas",
  "iframe",
  "footer",
  "nav",
  "header",
  "aside",
  "form",
  "button",
  "[role='banner']",
  "[role='navigation']",
  "[role='complementary']",
  "[role='contentinfo']",
  ".cookie",
  ".cookies",
  ".newsletter",
  ".subscribe",
  ".advertisement",
  ".ads",
];

const MAIN_CONTENT_SELECTORS = [
  "main",
  "article",
  "[role='main']",
  "#content",
  ".content",
  ".post-content",
  ".article-content",
];

async function fetchHtml(url: string): Promise<string> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), FETCH_TIMEOUT_MS);

  const response = await fetch(url, {
    redirect: "follow",
    signal: abortController.signal,
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; embedding-tools-bot/1.0; +https://example.local)",
      accept: "text/html,application/xhtml+xml",
    },
  }).finally(() => {
    clearTimeout(timeout);
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch HTML (${response.status}): ${url}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("html")) {
    throw new Error(`Expected HTML content type, received: ${contentType || "unknown"}`);
  }

  return response.text();
}

function extractTitle($: cheerio.CheerioAPI): string {
  const h1 = $("h1").first().text().trim();
  if (h1) {
    return h1;
  }

  return $("title").first().text().trim() || "Untitled";
}

function normalizeWhitespace(input: string): string {
  return input
    .replaceAll(/\r\n/g, "\n")
    .replaceAll(/\r/g, "\n")
    .replaceAll(/[ \t]+/g, " ")
    .replaceAll(/\n{3,}/g, "\n\n")
    .trim();
}

function extractBodyText($: cheerio.CheerioAPI): string {
  for (const selector of MAIN_CONTENT_SELECTORS) {
    const candidateText = normalizeWhitespace($(selector).first().text());
    if (candidateText.length >= MIN_USEFUL_TEXT_LENGTH) {
      return candidateText;
    }
  }

  return normalizeWhitespace($("body").text());
}

function applySemanticCleaners($: cheerio.CheerioAPI): void {
  for (const selector of NOISE_SELECTORS) {
    $(selector).remove();
  }

  $("[hidden], [aria-hidden='true']").remove();
  $("*[class*='cookie'], *[id*='cookie']").remove();
}

export async function parseHtmlUrl(url: string): Promise<ParsedHtml> {
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  applySemanticCleaners($);

  return {
    url,
    title: extractTitle($),
    text: extractBodyText($),
    html,
    fetchedAt: new Date().toISOString(),
  };
}
