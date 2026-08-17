"use client";

import { useState } from "react";

type Turn = { speaker: string; text: string };

function parseTranscript(raw: string): Turn[] {
  return raw
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      const idx = line.indexOf(": ");
      if (idx === -1) return { speaker: "", text: line };
      return { speaker: line.slice(0, idx), text: line.slice(idx + 2) };
    });
}

function ChatBubbles({ turns }: { turns: Turn[] }) {
  return (
    <div className="flex flex-col gap-2">
      {turns.map((turn, i) => {
        const isParent = turn.speaker.toLowerCase() === "parent";
        return (
          <div key={i} className={`flex ${isParent ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                isParent
                  ? "bg-accent-soft text-gray-100"
                  : "bg-white/10 text-gray-200"
              }`}
            >
              <p className="mb-0.5 text-[10px] uppercase tracking-wide text-gray-400">{turn.speaker}</p>
              <p className="whitespace-pre-wrap">{turn.text}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function TranscriptView({ transcript }: { transcript: string }) {
  const [language, setLanguage] = useState<"original" | "english">("original");
  const [translated, setTranslated] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle(target: "original" | "english") {
    setError(null);
    if (target === "original" || translated) {
      setLanguage(target);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: transcript }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Translation failed");
      setTranslated(body.translated);
      setLanguage("english");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Translation failed");
    } finally {
      setLoading(false);
    }
  }

  const shownText = language === "english" && translated ? translated : transcript;
  const turns = parseTranscript(shownText);

  return (
    <div>
      <div className="mb-3 flex items-center gap-1 text-xs">
        <button
          onClick={() => handleToggle("original")}
          className={`press-feedback rounded-full px-2.5 py-1 ${
            language === "original" ? "bg-accent text-black" : "bg-white/10 text-gray-400"
          }`}
        >
          Original
        </button>
        <button
          onClick={() => handleToggle("english")}
          disabled={loading}
          className={`press-feedback rounded-full px-2.5 py-1 ${
            language === "english" ? "bg-accent text-black" : "bg-white/10 text-gray-400"
          } disabled:opacity-50`}
        >
          {loading ? "Translating…" : "English"}
        </button>
        {error && <span className="ml-2 text-red-400">{error}</span>}
      </div>
      {turns.length > 0 ? (
        <ChatBubbles turns={turns} />
      ) : (
        <pre className="whitespace-pre-wrap text-sm text-gray-300">{shownText}</pre>
      )}
    </div>
  );
}
