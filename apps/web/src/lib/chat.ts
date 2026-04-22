import type { AqiReading } from "./api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";
const DEFAULT_LAT = 52.3676;
const DEFAULT_LNG = 4.9041;

export type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  timestamp: string;
};

export type ChatReply = {
  contextAqi: number;
  contextCategory: string;
  reply: string;
  source: "live" | "preview";
  strategy: "llm" | "fallback" | "preview";
  timestamp: string;
};

export type SubmitChatQuestionOptions = {
  contextReading?: AqiReading;
  fetchImpl?: typeof fetch;
  lat?: number;
  lng?: number;
  message: string;
};

export const CHAT_PROMPT_SUGGESTIONS = [
  "Is it safe to cycle to school at 8 AM?",
  "Should I go for a run this evening?",
  "What precautions should my family take today?"
] as const;

export function normalizeQuestion(message: string) {
  return message.trim().replace(/\s+/g, " ");
}

export function createAssistantMessage(content: string, timestamp = new Date().toISOString()): ChatMessage {
  return {
    id: `assistant-${timestamp}`,
    role: "assistant",
    content,
    timestamp
  };
}

export function createUserMessage(content: string, timestamp = new Date().toISOString()): ChatMessage {
  return {
    id: `user-${timestamp}`,
    role: "user",
    content,
    timestamp
  };
}

export function createWelcomeMessage() {
  return createAssistantMessage(
    "I’m EcoSentinel’s citizen advisor. Ask about outdoor plans, school runs, or how today’s air quality may change over the next few hours."
  );
}

function describeFallbackBand(aqi: number) {
  if (aqi <= 50) {
    return "Good";
  }

  if (aqi <= 100) {
    return "Moderate";
  }

  if (aqi <= 150) {
    return "USG";
  }

  if (aqi <= 200) {
    return "Unhealthy";
  }

  return "Very Unhealthy";
}

function buildPreviewReply(message: string, contextReading?: AqiReading) {
  const fallbackAqi = contextReading?.aqi ?? 54;
  const fallbackCategory = contextReading?.category ?? describeFallbackBand(fallbackAqi);
  const lowerQuestion = message.toLowerCase();
  const isExerciseQuestion = /(run|cycle|walk|outside|outdoor|school|exercise|jog)/.test(lowerQuestion);
  const mentionsFamily = /(child|kids|family|daughter|son|asthma)/.test(lowerQuestion);

  const activityGuidance =
    fallbackAqi <= 50
      ? "Outdoor plans look reasonable right now."
      : fallbackAqi <= 100
        ? "It is still manageable, but sensitive groups should shorten strenuous outdoor activity."
        : "It would be safer to limit time outside until conditions improve.";

  const tailoredGuidance = isExerciseQuestion
    ? "If you do head out, choose a shorter route away from major roads and keep the effort moderate."
    : "Check in again later today because conditions can shift quickly around traffic peaks.";

  const familyGuidance = mentionsFamily
    ? "Children and anyone with asthma should keep rescue medication handy and watch for irritation or coughing."
    : "If anyone in your household is especially sensitive to pollution, consider extra precautions.";

  return {
    contextAqi: fallbackAqi,
    contextCategory: fallbackCategory,
    reply: [
      `Current Amsterdam AQI is about ${fallbackAqi} (${fallbackCategory}).`,
      activityGuidance,
      tailoredGuidance,
      familyGuidance
    ].join(" "),
    source: "preview" as const,
    strategy: "preview" as const,
    timestamp: new Date().toISOString()
  };
}

export async function submitChatQuestion({
  contextReading,
  fetchImpl = fetch,
  lat = contextReading?.lat ?? DEFAULT_LAT,
  lng = contextReading?.lng ?? DEFAULT_LNG,
  message
}: SubmitChatQuestionOptions): Promise<ChatReply> {
  const normalizedMessage = normalizeQuestion(message);

  if (!normalizedMessage) {
    throw new Error("Please enter a question for the advisor.");
  }

  try {
    const response = await fetchImpl(`${API_BASE_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: normalizedMessage,
        lat,
        lng
      })
    });

    if (!response.ok) {
      throw new Error(`Chat request failed with ${response.status}`);
    }

    const payload = (await response.json()) as Partial<ChatReply>;

    if (!payload.reply || !payload.timestamp || payload.contextAqi == null || !payload.contextCategory) {
      throw new Error("Chat response was missing required advisor fields");
    }

    return {
      contextAqi: payload.contextAqi,
      contextCategory: payload.contextCategory,
      reply: payload.reply,
      source: "live",
      strategy: payload.strategy ?? "llm",
      timestamp: payload.timestamp
    };
  } catch (_error) {
    return buildPreviewReply(normalizedMessage, contextReading);
  }
}
