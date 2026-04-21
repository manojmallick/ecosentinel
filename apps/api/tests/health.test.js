const { getHealth } = require("../src/routes/health");

describe("getHealth", () => {
  it("returns a starter health payload", () => {
    const response = {
      json: jest.fn()
    };

    getHealth({}, response);

    expect(response.json).toHaveBeenCalledWith({
      status: "ok",
      service: "ecosentinel-api",
      version: "0.1.0",
      timestamp: expect.any(String)
    });
  });
});
