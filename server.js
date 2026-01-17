import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { cardType, whoFor, theme, vibe } = req.body || {};

  // Safety: allow only known values
  const allowed = {
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

  function assertAllowed(value, list) {
    return list.includes(value);
  }

  if (
    !assertAllowed(cardType, allowed.cardType) ||
    !assertAllowed(whoFor, allowed.whoFor) ||
    !assertAllowed(theme, allowed.theme) ||
    !assertAllowed(vibe, allowed.vibe)
  ) {
    return res.status(400).json({ error: "Invalid input" });
  }

  const prompt = `
Create a greeting card FRONT design.

Text on card: "${cardType.toUpperCase()}"
Recipient: ${whoFor}
Theme: ${theme}
Vibe: ${vibe}

Design rules:
- Print-friendly
- Leave margins
- Kind, uplifting, respectful
- No logos, brands, watermarks
- No real people or photoreal faces
`;

  try {
    const result = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1536",
    });

    const base64 = result.data[0].b64_json;
    res.status(200).json({
      imageDataUrl: `data:image/png;base64,${base64}`,
    });
  } catch (err) {
    res.status(500).json({ error: "Image generation failed" });
  }
}
