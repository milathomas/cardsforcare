import OpenAI from "openai";

/**
 * Force Node.js runtime (important for OpenAI SDK).
 * This prevents accidental Edge execution which can crash.
 */
export const config = {
  runtime: "nodejs",
};

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
    "Create a greeting card FRONT design (portrait).",
    `Headline text (must be readable): "${cardType.toUpperCase()}".`,
    `Recipient: ${whoFor}.`,
    `Theme: ${theme}.`,
    `Vibe: ${vibe}.`,
    "",
    "Design rules:",
    "- Print-friendly with safe margins (no text near edges).",
    "- Kind, uplifting, respectful, appropriate for all ages.",
    "- No logos, no brands, no watermarks.",
    "- No real people or photoreal faces.",
  ].join("\n");
}

export default async function handler(req, res) {
  // ----- CORS (allow your IONOS site) -----
  // In Node serverless, origin is usually on req.headers.origin (string).
  // This fallback keeps it safe even if something changes.
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

  // Preflight (browser sends this before POST)
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  try {
    // GET = health check (should never crash)
    if (req.method === "GET") {
      return res.status(200).json({
        ok: true,
        message:
          "Cards for Care API is running. Send a POST to generate an image.",
      });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "Missing OPENAI_API_KEY env var in Vercel.",
      });
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

    const prompt = buildPrompt({ cardType, whoFor, theme, vibe });

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY.trim(),
    });

    const result = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      size: "1024x1536",
    });

    const b64 = result?.data?.[0]?.b64_json;
    if (!b64) {
      return res.status(500).json({ error: "OpenAI returned no image data." });
    }

    return res.status(200).json({
      imageDataUrl: `data:image/png;base64,${b64}`,
    });
  } catch (err) {
    console.error("generate-card error:", err);
    return res.status(500).json({
      error: "Server error",
      details: err?.message || String(err),
    });
  }
}
