jest.mock("pg", () => {
  const on = jest.fn();

  return {
    Pool: jest.fn(() => ({
      on
    }))
  };
});

describe("db pool", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      DATABASE_URL: "postgresql://ecosentinel:password@localhost:5432/ecosentinel"
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("creates a Pool with the expected connection settings", () => {
    const { Pool } = require("pg");

    require("../src/db/pool");

    expect(Pool).toHaveBeenCalledWith({
      connectionString: "postgresql://ecosentinel:password@localhost:5432/ecosentinel",
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000
    });
  });
});
