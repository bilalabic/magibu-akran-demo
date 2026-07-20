import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

let jobBackend: (typeof import("@/lib/jobs/qstash"))["jobBackend"];

describe("jobBackend", () => {
  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://test:test@127.0.0.1:5432/test");
    ({ jobBackend } = await import("@/lib/jobs/qstash"));
  });

  afterEach(() => vi.unstubAllEnvs());

  it("production'da QStash token bulunsa bile pg-boss'u varsayılan seçer", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JOB_BACKEND", "");
    vi.stubEnv("QSTASH_TOKEN", "passive-token");

    expect(jobBackend()).toBe("pgboss");
  });

  it("QStash'i yalnızca açıkça seçildiğinde etkinleştirir", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JOB_BACKEND", "qstash");

    expect(jobBackend()).toBe("qstash");
  });

  it("yerel geliştirmede varsayılan olarak inline çalışır", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("JOB_BACKEND", "");

    expect(jobBackend()).toBe("inline");
  });
});
