import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type ClientConfig,
  OpenSanctionsClient,
  OpenSanctionsError,
  createClientConfig,
} from "../src/client.js";
import catalogFixture from "./fixtures/catalog.json";
import searchFixture from "./fixtures/search-person.json";

function testConfig(overrides?: Partial<ClientConfig>): ClientConfig {
  return {
    apiUrl: "https://api.test.opensanctions.org",
    apiKey: "test-key-123",
    dataset: "default",
    maxRetries: 1,
    timeoutMs: 1000,
    ...overrides,
  };
}

function mockFetch(response: object, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      url: "https://api.test.opensanctions.org/test",
      json: () => Promise.resolve(response),
      text: () => Promise.resolve(JSON.stringify(response)),
    }),
  );
}

function mockFetchSequence(
  responses: Array<{ body: object; status: number }>,
): void {
  const fn = vi.fn();
  for (const [i, r] of responses.entries()) {
    fn.mockResolvedValueOnce({
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      url: "https://api.test.opensanctions.org/test",
      json: () => Promise.resolve(r.body),
      text: () => Promise.resolve(JSON.stringify(r.body)),
    });
  }
  vi.stubGlobal("fetch", fn);
}

describe("createClientConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("uses defaults when no env vars set", () => {
    process.env.OPENSANCTIONS_API_URL = undefined;
    process.env.OPENSANCTIONS_API_KEY = undefined;
    process.env.OPENSANCTIONS_DATASET = undefined;

    const config = createClientConfig();
    expect(config.apiUrl).toBe("https://api.opensanctions.org");
    expect(config.apiKey).toBeUndefined();
    expect(config.dataset).toBe("default");
    expect(config.maxRetries).toBe(3);
  });

  it("reads env vars", () => {
    process.env.OPENSANCTIONS_API_URL = "http://localhost:9090/";
    process.env.OPENSANCTIONS_API_KEY = "my-key";
    process.env.OPENSANCTIONS_DATASET = "us_ofac_sdn";
    process.env.OPENSANCTIONS_MAX_RETRIES = "5";

    const config = createClientConfig();
    expect(config.apiUrl).toBe("http://localhost:9090");
    expect(config.apiKey).toBe("my-key");
    expect(config.dataset).toBe("us_ofac_sdn");
    expect(config.maxRetries).toBe(5);
  });

  it("strips trailing slashes from URL", () => {
    process.env.OPENSANCTIONS_API_URL = "https://example.com///";
    const config = createClientConfig();
    expect(config.apiUrl).toBe("https://example.com");
  });
});

describe("OpenSanctionsClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("search", () => {
    it("returns search results", async () => {
      mockFetch(searchFixture);
      const client = new OpenSanctionsClient(testConfig());
      const result = await client.search("Viktor Bout");

      expect(result.results).toHaveLength(1);
      expect(result.results[0].caption).toBe("Viktor Anatolyevich Bout");
      expect(result.results[0].score).toBe(0.95);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/search/default?q=Viktor+Bout"),
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("includes schema and limit params when provided", async () => {
      mockFetch(searchFixture);
      const client = new OpenSanctionsClient(testConfig());
      await client.search("test", { schema: "Person", limit: 5 });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("schema=Person"),
        expect.anything(),
      );
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("limit=5"),
        expect.anything(),
      );
    });
  });

  describe("match", () => {
    it("sends POST with schema and properties", async () => {
      const matchResponse = {
        responses: { "0": { results: searchFixture.results, total: 1 } },
      };
      mockFetch(matchResponse);
      const client = new OpenSanctionsClient(testConfig());

      await client.match("Person", { name: ["Viktor Bout"] });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/match/default"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            schema: "Person",
            properties: { name: ["Viktor Bout"] },
          }),
        }),
      );
    });
  });

  describe("getEntity", () => {
    it("fetches entity by ID", async () => {
      const entityResponse = {
        ...searchFixture.results[0],
        adjacent: {},
      };
      mockFetch(entityResponse);
      const client = new OpenSanctionsClient(testConfig());
      const result = await client.getEntity("NK-2Ciy8EG7jz1YHMGCxYLb25");

      expect(result.id).toBe("NK-2Ciy8EG7jz1YHMGCxYLb25");
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/entities/NK-2Ciy8EG7jz1YHMGCxYLb25"),
        expect.anything(),
      );
    });
  });

  describe("getCatalog", () => {
    it("returns dataset catalog", async () => {
      mockFetch(catalogFixture);
      const client = new OpenSanctionsClient(testConfig());
      const result = await client.getCatalog();

      expect(result.datasets).toHaveLength(2);
      expect(result.datasets[0].name).toBe("us_ofac_sdn");
    });
  });

  describe("error handling", () => {
    it("throws on 401 with helpful message", async () => {
      mockFetch({ detail: "No API key provided." }, 401);
      const client = new OpenSanctionsClient(testConfig());

      await expect(client.search("test")).rejects.toThrow(OpenSanctionsError);
      await expect(client.search("test")).rejects.toThrow(
        /API key required or invalid/,
      );
    });

    it("throws on 404", async () => {
      mockFetch({ detail: "Not found" }, 404);
      const client = new OpenSanctionsClient(testConfig());

      await expect(client.getEntity("bad-id")).rejects.toThrow(/Not found/);
    });

    it("retries on 429 then succeeds", async () => {
      mockFetchSequence([
        { body: { detail: "Rate limited" }, status: 429 },
        { body: searchFixture, status: 200 },
      ]);
      const client = new OpenSanctionsClient(testConfig());
      const result = await client.search("test");

      expect(result.results).toHaveLength(1);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("throws after retries exhausted on 429", async () => {
      mockFetchSequence([
        { body: { detail: "Rate limited" }, status: 429 },
        { body: { detail: "Rate limited" }, status: 429 },
      ]);
      const client = new OpenSanctionsClient(testConfig({ maxRetries: 1 }));

      await expect(client.search("test")).rejects.toThrow(/rate limit/i);
    });

    it("retries on 500 then succeeds", async () => {
      mockFetchSequence([
        { body: { detail: "Internal error" }, status: 500 },
        { body: searchFixture, status: 200 },
      ]);
      const client = new OpenSanctionsClient(testConfig());
      const result = await client.search("test");

      expect(result.results).toHaveLength(1);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("throws on network error after retries", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
      );
      const client = new OpenSanctionsClient(testConfig({ maxRetries: 1 }));

      await expect(client.search("test")).rejects.toThrow(/Cannot connect/);
    });

    it("throws on timeout (AbortError)", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(
          () =>
            new Promise((_, reject) => {
              const err = new DOMException(
                "The operation was aborted",
                "AbortError",
              );
              setTimeout(() => reject(err), 10);
            }),
        ),
      );
      const client = new OpenSanctionsClient(
        testConfig({ maxRetries: 0, timeoutMs: 1000 }),
      );

      await expect(client.search("test")).rejects.toThrow(/timeout/i);
    });

    it("throws on generic HTTP error (400)", async () => {
      mockFetch({ detail: "Bad request" }, 400);
      const client = new OpenSanctionsClient(testConfig());

      await expect(client.search("test")).rejects.toThrow(/400/);
    });
  });

  describe("auth header", () => {
    it("includes API key when configured", async () => {
      mockFetch(searchFixture);
      const client = new OpenSanctionsClient(testConfig({ apiKey: "my-key" }));
      await client.search("test");

      expect(fetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "ApiKey my-key",
          }),
        }),
      );
    });

    it("omits auth header when no key configured", async () => {
      mockFetch(catalogFixture);
      const client = new OpenSanctionsClient(testConfig({ apiKey: undefined }));
      await client.getCatalog();

      const callHeaders = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1]
        .headers;
      expect(callHeaders).not.toHaveProperty("Authorization");
    });
  });
});
