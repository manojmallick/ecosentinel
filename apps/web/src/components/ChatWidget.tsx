"use client";

import { FormEvent, useMemo, useState } from "react";

import {
  CHAT_PROMPT_SUGGESTIONS,
  createAssistantMessage,
  createUserMessage,
  createWelcomeMessage,
  submitChatQuestion,
  type ChatMessage
} from "../lib/chat";
import { getAqiBand } from "../lib/aqiColors";
import { formatReadingFreshness, formatReadingResolution, useAqiReadings } from "../lib/api";

function formatMessageTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function ChatWidget() {
  const { lastUpdated, locationStatus, readings, status } = useAqiReadings();
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(() => [createWelcomeMessage()]);
  const [responseMode, setResponseMode] = useState<"idle" | "live" | "preview">("idle");
  const [isResponding, setIsResponding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const primaryReading = readings[0];
  const primaryBand = getAqiBand(primaryReading.aqi);

  const chatStatusLabel = useMemo(() => {
    if (responseMode === "live") {
      return "Live advisor";
    }

    if (responseMode === "preview") {
      return "Preview advisor";
    }

    return status === "live" ? "AQI synced" : "AQI preview";
  }, [responseMode, status]);

  async function sendMessage(message: string) {
    const trimmedMessage = message.trim();

    if (!trimmedMessage || isResponding) {
      return;
    }

    const userMessage = createUserMessage(trimmedMessage);

    setDraft("");
    setError(null);
    setIsResponding(true);
    setMessages((currentMessages) => [...currentMessages, userMessage]);

    try {
      const reply = await submitChatQuestion({
        message: trimmedMessage,
        contextReading: primaryReading
      });

      setMessages((currentMessages) => [
        ...currentMessages,
        createAssistantMessage(reply.reply, reply.timestamp)
      ]);
      setResponseMode(reply.source);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error ? submissionError.message : "The advisor could not process that question."
      );
    } finally {
      setIsResponding(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(draft);
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.7fr_1.3fr]">
      <aside className="grid gap-4 rounded-[2rem] border border-emerald-200/10 bg-slate-950/75 p-5 shadow-[0_30px_90px_-60px_rgba(34,197,94,0.85)] backdrop-blur">
        <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">Advisor context</p>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-200">
              {chatStatusLabel}
            </span>
          </div>
          <div className="mt-4 text-4xl font-semibold text-white">{primaryReading.aqi}</div>
          <div className="mt-2 flex items-center gap-3">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: primaryBand.color }}
            />
            <span className="text-base font-medium text-slate-100">{primaryReading.category}</span>
          </div>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            The chatbot uses the current AQI reading for {primaryReading.pointName.toLowerCase()} first,
            then labels whether that context came from the requested location, stored local history, or a
            preview fallback response.
          </p>
          <p className="mt-4 text-xs uppercase tracking-[0.2em] text-slate-400">
            AQI refresh {new Date(lastUpdated).toLocaleTimeString()} ·{" "}
            {locationStatus === "granted"
              ? "browser location enabled"
              : locationStatus === "locating"
                ? "locating device"
                : "fallback location"}
          </p>
        </div>

        <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/65 p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Suggested prompts</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {CHAT_PROMPT_SUGGESTIONS.map((prompt) => (
              <button
                key={prompt}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-slate-200 transition hover:border-emerald-300/40 hover:bg-emerald-400/10"
                onClick={() => {
                  void sendMessage(prompt);
                }}
                type="button"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <div className="flex min-h-[640px] flex-col rounded-[2rem] border border-white/10 bg-slate-950/75 shadow-[0_35px_120px_-70px_rgba(56,189,248,0.95)] backdrop-blur">
        <div className="border-b border-white/10 px-6 py-5">
          <p className="text-xs uppercase tracking-[0.3em] text-sky-300">Citizen advisor</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">Chat with EcoSentinel about today’s air</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
            Ask plain-language questions about school runs, exercise, or whether sensitive groups should
            take extra care. The UI is ready now, and it will automatically switch to the live advisor once
            `/api/chat` is available.
          </p>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
          {messages.map((message) => {
            const isAssistant = message.role === "assistant";

            return (
              <article
                key={message.id}
                className={`max-w-3xl rounded-[1.75rem] border px-5 py-4 ${
                  isAssistant
                    ? "border-emerald-300/15 bg-emerald-400/10 text-slate-50"
                    : "ml-auto border-sky-300/20 bg-sky-400/10 text-slate-50"
                }`}
              >
                <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.24em] text-slate-300">
                  <span>{isAssistant ? "EcoSentinel" : "You"}</span>
                  <span>{formatMessageTime(message.timestamp)}</span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-100">{message.content}</p>
              </article>
            );
          })}

          {isResponding ? (
            <article className="max-w-sm rounded-[1.75rem] border border-emerald-300/15 bg-emerald-400/10 px-5 py-4 text-slate-100">
              <div className="text-[11px] uppercase tracking-[0.24em] text-slate-300">EcoSentinel</div>
              <div className="mt-3 flex items-center gap-2">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-300" />
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-300 [animation-delay:120ms]" />
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-300 [animation-delay:240ms]" />
                <span className="ml-2 text-sm text-slate-200">Thinking through the latest AQI context…</span>
              </div>
            </article>
          ) : null}
        </div>

        <div className="border-t border-white/10 px-6 py-5">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="sr-only">Ask the citizen advisor a question</span>
              <textarea
                className="min-h-[136px] w-full rounded-[1.75rem] border border-white/10 bg-white/5 px-5 py-4 text-sm leading-7 text-slate-50 outline-none transition placeholder:text-slate-400 focus:border-emerald-300/40 focus:bg-white/10"
                onChange={(event) => {
                  setDraft(event.target.value);
                }}
                placeholder="Ask about cycling to school, walking your dog, opening windows tonight, or whether an AQI spike could affect sensitive family members."
                value={draft}
              />
            </label>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-slate-300">
                {formatReadingResolution(primaryReading.resolution)} ·{" "}
                <span className="font-medium text-white">
                  {primaryReading.source} / {formatReadingFreshness(primaryReading.freshness)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {error ? <div className="text-sm text-rose-300">{error}</div> : null}
                <button
                  className="inline-flex items-center justify-center rounded-full bg-emerald-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
                  disabled={!draft.trim() || isResponding}
                  type="submit"
                >
                  {isResponding ? "Thinking…" : "Ask advisor"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
