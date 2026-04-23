jest.mock("../src/db/pool", () => ({
  query: jest.fn()
}));

const pool = require("../src/db/pool");
const { getHealth } = require("../src/routes/health");

describe("getHealth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a healthy payload when the database responds", async () => {
    pool.query.mockResolvedValue({ rows: [{ "?column?": 1 }] });

    const response = {
      json: jest.fn()
    };

    await getHealth({}, response);

    expect(response.json).toHaveBeenCalledWith({
      status: "ok",
      collector: "enabled",
      service: "ecosentinel-api",
      version: "0.1.0",
      db: "connected",
      timestamp: expect.any(String)
    });
  });

  it("returns a degraded payload when the database check fails", async () => {
    pool.query.mockRejectedValue(new Error("db down"));

    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await getHealth({}, response);

    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith({
      status: "degraded",
      collector: "enabled",
      service: "ecosentinel-api",
      version: "0.1.0",
      db: "disconnected",
      timestamp: expect.any(String)
    });
  });
});
