import test from "node:test";
import assert from "node:assert/strict";

import {
  createAssistantMessage,
  createUserMessage,
  createWelcomeMessage,
  normalizeQuestion,
  submitChatQuestion
} from "./chat.ts";

test("normalizeQuestion trims and collapses repeated whitespace", () => {
  assert.equal(normalizeQuestion("  Is   it safe   outside?  "), "Is it safe outside?");
});

test("createWelcomeMessage returns an assistant starter message", () => {
  const message = createWelcomeMessage();

  assert.equal(message.role, "assistant");
  assert.match(message.content, /citizen advisor/i);
});

test("createUserMessage and createAssistantMessage keep roles distinct", () => {
  const user = createUserMessage("Hello", "2026-04-23T08:00:00.000Z");
  const assistant = createAssistantMessage("Hi there", "2026-04-23T08:01:00.000Z");

  assert.equal(user.role, "user");
  assert.equal(user.id, "user-2026-04-23T08:00:00.000Z");
  assert.equal(assistant.role, "assistant");
  assert.equal(assistant.id, "assistant-2026-04-23T08:01:00.000Z");
});

test("submitChatQuestion uses the live API when available", async () => {
  const reply = await submitChatQuestion({
    message: "Should I go for a run?",
    fetchImpl: async () =>
      ({
        ok: true,
        json: async () => ({
          reply: "AQI is currently good, so a short run is reasonable.",
          contextAqi: 44,
          contextCategory: "Good",
          strategy: "llm",
          timestamp: "2026-04-23T08:10:00.000Z"
        })
      }) as Response
  });

  assert.equal(reply.source, "live");
  assert.equal(reply.strategy, "llm");
  assert.equal(reply.contextAqi, 44);
});

test("submitChatQuestion falls back to preview guidance when the API is unavailable", async () => {
  const reply = await submitChatQuestion({
    message: "Can my daughter cycle to school today?",
    contextReading: {
      aqi: 82,
      category: "Moderate",
      color: "#facc15",
      freshness: "preview",
      lat: 52.3676,
      lng: 4.9041,
      pointName: "Amsterdam Centre",
      pollutants: {
        no2: 24,
        o3: 58,
        pm10: 18,
        pm25: 11
      },
      resolution: "preview",
      source: "simulated",
      timestamp: "2026-04-23T08:00:00.000Z"
    },
    fetchImpl: async () => {
      throw new Error("network down");
    }
  });

  assert.equal(reply.source, "preview");
  assert.equal(reply.strategy, "preview");
  assert.match(reply.reply, /Current Amsterdam AQI is about 82/i);
  assert.match(reply.reply, /Children and anyone with asthma/i);
});
