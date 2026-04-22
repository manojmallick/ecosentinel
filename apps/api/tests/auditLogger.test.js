jest.mock("../src/db/pool", () => ({
  query: jest.fn()
}));

const pool = require("../src/db/pool");
const {
  getPublicKeyHex,
  persistAuditEvent,
  signPayload,
  signPredictionOutput,
  toCanonicalJson,
  verifyPayload
} = require("../src/services/AuditLogger");

const TEST_PRIVATE_KEY = "1111111111111111111111111111111111111111111111111111111111111111";

describe("AuditLogger", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("canonicalizes nested objects deterministically before signing", () => {
    const json = toCanonicalJson({
      b: 2,
      a: {
        d: 4,
        c: 3
      }
    });

    expect(json).toBe('{"a":{"c":3,"d":4},"b":2}');
  });

  it("signs and verifies a prediction payload with Ed25519", () => {
    const payload = {
      lat: 52.3676,
      lng: 4.9041,
      forecast: [{ hour: 1, aqi: 48, confidence: { low: 42, high: 55 } }]
    };

    const signed = signPayload(payload, TEST_PRIVATE_KEY);

    expect(signed.signature).toMatch(/^[0-9a-f]+$/);
    expect(signed.publicKey).toBe(getPublicKeyHex(TEST_PRIVATE_KEY));
    expect(verifyPayload(payload, signed.signature, signed.publicKey)).toBe(true);
  });

  it("persists audit events to the audit_log table", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          id: 12,
          event_type: "PREDICTION",
          payload: { ok: true },
          signature: "abcd",
          created_at: "2026-04-22T09:00:00.000Z"
        }
      ]
    });

    const result = await persistAuditEvent({
      eventType: "PREDICTION",
      payload: { ok: true },
      signature: "abcd"
    });

    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO audit_log"), [
      "PREDICTION",
      JSON.stringify({ ok: true }),
      "abcd"
    ]);
    expect(result).toEqual({
      id: 12,
      event_type: "PREDICTION",
      payload: { ok: true },
      signature: "abcd",
      created_at: "2026-04-22T09:00:00.000Z"
    });
  });

  it("returns a signed prediction and persists it by default", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          id: 13,
          event_type: "PREDICTION",
          payload: {},
          signature: "abcd",
          created_at: "2026-04-22T09:05:00.000Z"
        }
      ]
    });

    const signed = await signPredictionOutput(
      {
        lat: 52.3676,
        lng: 4.9041,
        forecast: []
      },
      {
        db: pool,
        seedHex: TEST_PRIVATE_KEY
      }
    );

    expect(signed).toEqual({
      lat: 52.3676,
      lng: 4.9041,
      forecast: [],
      publicKey: getPublicKeyHex(TEST_PRIVATE_KEY),
      signature: expect.any(String)
    });
    expect(pool.query).toHaveBeenCalledTimes(1);
  });
});
