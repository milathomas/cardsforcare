import OpenAI from "openai";

export const config = {
  runtime: "nodejs",
};

// Safety: only allow dropdown values
const ALLOWED = {
  cardType: [
    "Welcome Home",
    "Thank You So Much",
    "Happy Holidays",
    "Thinking of You",
    "Congratulations",
  ],
  whoFor: [
    "Someone you don’t know (community card)",
    "A new resident",
    "A senior in an elder care home",
    "Grandma",
    "Grandpa",
    "Friend",
  ],
  theme: [
    "Outer Space",
    "Nature / Flowers",
    "Cute Animals",
    "Robots",
    "Festive Minimalist",
    "Anime",
  ],
  vibe: ["Calm & gentle", "Cheerful & silly", "Bold & inspiring"],
};

function isAllowed(val, list) {
  return typeof val === "string" && list.includes(val);
}

function buildPrompt({ cardType, whoFor, theme, vibe }) {
  return [
    "Design a greeting card FRONT (portrait).",
    `Headline text (readable): "${cardType.toUpperCase()}".`,
    `Recipient: ${whoFor}.`,
    `Theme: ${theme}.`,
    `Vibe: ${vibe}.`,
    "",
    "Constraints:",
    "- Print-friendly with safe margins.",
    "- Kind, uplifting, respectful, appropriate for all ages.",
    "- No logos, brands, or watermarks.",
    "- No real people or photoreal faces.",
    "- Clean illustration style.",
    "- Just the card itself, no background.",
    "- Just have the front of the card, no back or inside.",
    "- No additional words, just the main message (e.g. Welcome Home).",
    "- Size should be half of A4 paper (vertical positioning),",
    
  ].join("\n");
}

function setCors(req, res) {
  const origin =
    req?.headers?.origin ||
    (typeof req?.headers?.get === "function" ? req.headers.get("origin") : "");

  const allowedOrigins = new Set([
    "https://airplanegirl.com",
    "https://www.airplanegirl.com",
  ]);

  if (allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

// Download OpenAI-hosted image URL and convert to base64 data URL
async function fetchImageAsDataUrl(imageUrl) {
  const r = await fetch(imageUrl);
  if (!r.ok) throw new Error(`Failed to download image (${r.status})`);

  const contentType = r.headers.get("content-type") || "image/png";
  const arrayBuffer = await r.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return `data:${contentType};base64,${base64}`;
}

export default async function handler(req, res) {
  setCors(req, res);

  // Preflight
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  try {
    // Health check
    if (req.method === "GET") {
      return res.status(200).json({
        ok: true,
        message: "Cards for Care API is running. Send a POST to generate an image.",
      });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY env var in Vercel." });
    }

    const { cardType, whoFor, theme, vibe } = req.body || {};

    if (
      !isAllowed(cardType, ALLOWED.cardType) ||
      !isAllowed(whoFor, ALLOWED.whoFor) ||
      !isAllowed(theme, ALLOWED.theme) ||
      !isAllowed(vibe, ALLOWED.vibe)
    ) {
      return res.status(400).json({ error: "Invalid input" });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY.trim() });
    const prompt = buildPrompt({ cardType, whoFor, theme, vibe });

    // DALL·E 3 (typically returns a URL)
    const result = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      size: "1024x1024",
    });

    const item = result?.data?.[0];

    // If OpenAI gives base64 directly, use it
    if (item?.b64_json) {
      return res.status(200).json({
        imageDataUrl: `data:image/png;base64,${item.b64_json}`,
      });
    }

    // If OpenAI gives a URL, download it and convert to base64
    if (item?.url) {
      const imageDataUrl = await fetchImageAsDataUrl(item.url);
      return res.status(200).json({ imageDataUrl });
    }

    return res.status(500).json({
      error: "OpenAI returned no image data.",
      details: JSON.stringify(result)?.slice(0, 800),
    });
  } catch (err) {
    console.error("generate-card error:", err);
    return res.status(500).json({
      error: "Server error",
      details: err?.message || String(err),
    });
  }
}
