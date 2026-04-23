jest.mock("../src/agents/CitizenAdvisorAgent", () => ({
  answerCitizenQuestion: jest.fn()
}));

const { answerCitizenQuestion } = require("../src/agents/CitizenAdvisorAgent");
const app = require("../src/app");
const { postChat } = require("../src/routes/chat");

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };
}

function buildChatReply() {
  return {
    reply: "Current AQI is 42 (Good). Cycling looks reasonable this morning.",
    contextAqi: 42,
    contextCategory: "Good",
    timestamp: "2026-04-23T01:05:00.000Z",
    strategy: "fallback"
  };
}

describe("chat route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("mounts the chat router in the Express app", () => {
    const mountedRouters = app._router.stack
      .filter((layer) => layer.name === "router")
      .map((layer) => layer.regexp.toString());

    expect(mountedRouters.some((route) => route.includes("\\/api\\/chat"))).toBe(true);
  });

  it("serves POST /api/chat with citizen advisor output", async () => {
    const reply = buildChatReply();
    answerCitizenQuestion.mockResolvedValueOnce(reply);
    const response = createResponse();

    await postChat(
      {
        body: {
          message: "Is it safe to cycle to school?",
          lat: 52.3676,
          lng: 4.9041
        }
      },
      response
    );

    expect(answerCitizenQuestion).toHaveBeenCalledWith({
      message: "Is it safe to cycle to school?",
      lat: 52.3676,
      lng: 4.9041
    });
    expect(response.json).toHaveBeenCalledWith(reply);
  });

  it("rejects an empty chat message", async () => {
    const response = createResponse();

    await postChat(
      {
        body: {
          message: "   ",
          lat: 52.3676,
          lng: 4.9041
        }
      },
      response
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      error: "message is required"
    });
    expect(answerCitizenQuestion).not.toHaveBeenCalled();
  });

  it("rejects invalid chat coordinates", async () => {
    const response = createResponse();

    await postChat(
      {
        body: {
          message: "Can I run today?",
          lat: "bad",
          lng: 4.9041
        }
      },
      response
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      error: "lat and lng must be valid numbers"
    });
    expect(answerCitizenQuestion).not.toHaveBeenCalled();
  });

  it("returns a clear 404 when no AQI context exists", async () => {
    answerCitizenQuestion.mockRejectedValueOnce(new Error("No AQI reading available for advisor context"));
    const response = createResponse();

    await postChat(
      {
        body: {
          message: "Can I run today?",
          lat: 52.3676,
          lng: 4.9041
        }
      },
      response
    );

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({
      error: "No AQI context available for the requested location"
    });
  });
});
