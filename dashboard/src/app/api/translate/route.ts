import { NextResponse } from "next/server";

// Simple in-memory cache so repeated toggles for the same transcript don't re-hit Groq.
const cache = new Map<string, string>();

export async function POST(request: Request) {
  const { text } = await request.json();
  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const cached = cache.get(text);
  if (cached) {
    return NextResponse.json({ translated: cached });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Translation not configured" }, { status: 500 });
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "Translate the following wellness check-in call transcript into natural, plain English. " +
            "Keep the 'Speaker: line' format exactly as given (one line per turn, same speaker labels). " +
            "Do not add commentary, notes, or markdown -- output only the translated transcript.",
        },
        { role: "user", content: text },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    return NextResponse.json({ error: `Translation failed: ${body}` }, { status: 502 });
  }

  const data = await res.json();
  const translated: string = data.choices?.[0]?.message?.content?.trim() ?? "";
  cache.set(text, translated);

  return NextResponse.json({ translated });
}
