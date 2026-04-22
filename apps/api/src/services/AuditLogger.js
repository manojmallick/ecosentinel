const crypto = require("crypto");

const pool = require("../db/pool");

const ED25519_PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = canonicalize(value[key]);
        return result;
      }, {});
  }

  return value;
}

function toCanonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function normalizeSeedHex(seedHex = process.env.SIGNING_PRIVATE_KEY) {
  if (!seedHex) {
    throw new Error("SIGNING_PRIVATE_KEY is required for prediction signing");
  }

  const normalized = seedHex.trim().toLowerCase();

  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new Error("SIGNING_PRIVATE_KEY must be a 32-byte hex string");
  }

  return normalized;
}

function createPrivateKey(seedHex = process.env.SIGNING_PRIVATE_KEY) {
  const normalizedSeed = normalizeSeedHex(seedHex);
  const seed = Buffer.from(normalizedSeed, "hex");

  return crypto.createPrivateKey({
    key: Buffer.concat([ED25519_PKCS8_PREFIX, seed]),
    format: "der",
    type: "pkcs8"
  });
}

function createPublicKeyFromHex(publicKeyHex = process.env.SIGNING_PUBLIC_KEY) {
  if (!publicKeyHex || !/^[0-9a-f]{64}$/i.test(publicKeyHex.trim())) {
    throw new Error("SIGNING_PUBLIC_KEY must be a 32-byte hex string");
  }

  return crypto.createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKeyHex.trim(), "hex")]),
    format: "der",
    type: "spki"
  });
}

function getPublicKeyHex(seedHex = process.env.SIGNING_PRIVATE_KEY) {
  const privateKey = createPrivateKey(seedHex);
  const publicKey = crypto.createPublicKey(privateKey).export({
    format: "der",
    type: "spki"
  });

  return publicKey.subarray(ED25519_SPKI_PREFIX.length).toString("hex");
}

function signPayload(payload, seedHex = process.env.SIGNING_PRIVATE_KEY) {
  const privateKey = createPrivateKey(seedHex);
  const message = Buffer.from(toCanonicalJson(payload));
  const signature = crypto.sign(null, message, privateKey).toString("hex");

  return {
    publicKey: getPublicKeyHex(seedHex),
    signature
  };
}

function verifyPayload(payload, signatureHex, publicKeyHex = process.env.SIGNING_PUBLIC_KEY) {
  const publicKey = createPublicKeyFromHex(publicKeyHex);
  const message = Buffer.from(toCanonicalJson(payload));

  return crypto.verify(null, message, publicKey, Buffer.from(signatureHex, "hex"));
}

async function persistAuditEvent(
  {
    eventType,
    payload,
    signature = null
  },
  db = pool
) {
  const query = `
    INSERT INTO audit_log (event_type, payload, signature)
    VALUES ($1, $2::jsonb, $3)
    RETURNING id, event_type, payload, signature, created_at
  `;

  const result = await db.query(query, [eventType, JSON.stringify(payload), signature]);
  return result.rows[0];
}

async function signPredictionOutput(
  prediction,
  {
    db = pool,
    eventType = "PREDICTION",
    persist = true,
    seedHex = process.env.SIGNING_PRIVATE_KEY
  } = {}
) {
  const { signature, publicKey } = signPayload(prediction, seedHex);
  const signedPrediction = {
    ...prediction,
    publicKey,
    signature
  };

  if (persist) {
    await persistAuditEvent(
      {
        eventType,
        payload: signedPrediction,
        signature
      },
      db
    );
  }

  return signedPrediction;
}

module.exports = {
  canonicalize,
  createPrivateKey,
  createPublicKeyFromHex,
  getPublicKeyHex,
  persistAuditEvent,
  signPayload,
  signPredictionOutput,
  toCanonicalJson,
  verifyPayload
};
