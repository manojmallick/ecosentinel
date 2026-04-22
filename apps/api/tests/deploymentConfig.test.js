const fs = require("fs");
const path = require("path");

describe("deployment configuration", () => {
  it("defines a Railway deploy config with the API health check", () => {
    const railwayConfigPath = path.resolve(__dirname, "../railway.json");
    const railwayConfig = JSON.parse(fs.readFileSync(railwayConfigPath, "utf8"));

    expect(railwayConfig.deploy).toEqual(
      expect.objectContaining({
        startCommand: "npm start",
        healthcheckPath: "/api/health",
        restartPolicyType: "ON_FAILURE"
      })
    );
  });

  it("defines a Vercel config for the Next.js frontend app", () => {
    const vercelConfigPath = path.resolve(__dirname, "../../web/vercel.json");
    const vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, "utf8"));

    expect(vercelConfig).toEqual(
      expect.objectContaining({
        framework: "nextjs",
        installCommand: "npm install",
        buildCommand: "npm run build"
      })
    );
  });

  it("documents the deployment-critical environment variables in the API env example", () => {
    const envExamplePath = path.resolve(__dirname, "../.env.example");
    const envExample = fs.readFileSync(envExamplePath, "utf8");

    expect(envExample).toContain("DATABASE_URL=");
    expect(envExample).toContain("IQAIR_API_KEY=");
    expect(envExample).toContain("OPENAI_API_KEY=");
    expect(envExample).toContain("SIGNING_PRIVATE_KEY=");
    expect(envExample).toContain("TFJS_MODEL_PATH=");
  });
});
