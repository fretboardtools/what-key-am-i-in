export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { chords } = req.body;

  if (!chords || !Array.isArray(chords) || chords.length < 2) {
    return res.status(400).json({ error: "Please provide at least 2 chords" });
  }

  const SYSTEM_PROMPT = `You are a guitar teacher writing in the voice and style of the website unlocktheguitar.net. Your tone is direct, no-nonsense, occasionally irreverent, and always practical. You explain music theory in plain English — no jargon without explanation, no random patterns without context. You believe everything should connect back to key signatures and diatonic harmony.

When given a list of chords a guitarist is playing, you:
1. Identify the most likely key (or keys if ambiguous) — explain WHY these chords point to that key using Roman numerals and diatonic harmony. Be specific.
2. If there are multiple possible keys, acknowledge it briefly, pick the most likely one, and move on.
3. Recommend the 2–3 most useful scales for improvising over these chords — start with the most obvious, then give one slightly more interesting option. For each scale, say WHERE to start on the neck (e.g. "5th fret, low E string") and what it'll sound like.
4. End with one punchy, memorable insight — something that makes the guitarist go "oh, that's why."

Keep it tight. No waffle. Write in short paragraphs, not bullet lists. Sound like a teacher, not a textbook.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `I've been playing these chords: ${chords.join(", ")}. What key am I in, and what scales should I use?`
          }
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err.error?.message || "API error" });
    }

    const data = await response.json();
    const text = data.content?.find(b => b.type === "text")?.text || "";
    return res.status(200).json({ result: text });

  } catch (error) {
    return res.status(500).json({ error: "Failed to reach analysis engine" });
  }
}
