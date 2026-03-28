import { afterEach, describe, expect, it, vi } from "vitest";
import type { OpenSanctionsClient } from "../../src/client.js";
import { OpenSanctionsError } from "../../src/client.js";
import { handleInvestigateEntity } from "../../src/tools/investigate.js";
import entityFixture from "../fixtures/entity-with-relations.json";
import matchFixture from "../fixtures/match-person.json";

function mockClient(overrides?: {
  matchResult?: unknown;
  entityResult?: unknown;
  entityError?: Error;
}) {
  return {
    match: vi.fn().mockResolvedValue(overrides?.matchResult ?? matchFixture),
    getEntity: overrides?.entityError
      ? vi.fn().mockRejectedValue(overrides.entityError)
      : vi.fn().mockResolvedValue(overrides?.entityResult ?? entityFixture),
  } as unknown as OpenSanctionsClient;
}

describe("investigate_entity tool", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns structured investigation for a sanctioned person", async () => {
    const client = mockClient();
    const result = await handleInvestigateEntity(client, {
      name: "Viktor Bout",
      schema: "Person",
    });

    const parsed = JSON.parse(result);

    expect(parsed.query.name).toBe("Viktor Bout");
    expect(parsed.query.schema).toBe("Person");
    expect(parsed.matches).toHaveLength(1);
    expect(parsed.matches[0].score).toBe(1.0);
    expect(parsed.matches[0].datasets).toContain("us_ofac_sdn");
    expect(parsed.matches[0].relationships).toHaveLength(1);
    expect(parsed.matches[0].relationships[0].name).toBe("Air Cess Ltd");
    expect(parsed.datasets_involved).toBeDefined();
    expect(parsed.datasets_involved.length).toBeGreaterThan(0);
    expect(parsed.disclaimer).toContain("informational only");
  });

  it("passes optional properties to match", async () => {
    const client = mockClient();
    await handleInvestigateEntity(client, {
      name: "Viktor Bout",
      schema: "Person",
      birthDate: "1967-01-13",
      nationality: "RU",
    });

    expect(client.match).toHaveBeenCalledWith(
      "Person",
      expect.objectContaining({
        name: ["Viktor Bout"],
        birthDate: ["1967-01-13"],
        nationality: ["RU"],
      }),
      expect.anything(),
    );
  });

  it("respects threshold filter", async () => {
    const lowScoreMatch = {
      responses: {
        q: {
          results: [
            {
              ...matchFixture.responses.q.results[0],
              score: 0.5,
            },
          ],
          total: { value: 1, relation: "eq" },
        },
      },
    };
    const client = mockClient({ matchResult: lowScoreMatch });
    const result = await handleInvestigateEntity(client, {
      name: "test",
      schema: "Person",
      threshold: 0.7,
    });

    const parsed = JSON.parse(result);
    expect(parsed.matches).toHaveLength(0);
    expect(parsed.message).toContain("No matches above threshold");
  });

  it("handles no matches", async () => {
    const client = mockClient({
      matchResult: {
        responses: { q: { results: [], total: { value: 0, relation: "eq" } } },
      },
    });
    const result = await handleInvestigateEntity(client, {
      name: "Nobody",
      schema: "Person",
    });

    const parsed = JSON.parse(result);
    expect(parsed.matches).toHaveLength(0);
    expect(parsed.message).toContain("No matches");
  });

  it("returns partial results when entity fetch fails", async () => {
    const client = mockClient({
      entityError: new OpenSanctionsError("Not found"),
    });
    const result = await handleInvestigateEntity(client, {
      name: "Viktor Bout",
      schema: "Person",
    });

    const parsed = JSON.parse(result);
    expect(parsed.matches).toHaveLength(1);
    expect(parsed.matches[0].relationships).toHaveLength(0);
    expect(parsed.matches[0].fetch_error).toContain("Not found");
  });

  it("deduplicates entity IDs before fetching", async () => {
    const duplicateMatch = {
      responses: {
        q: {
          results: [
            matchFixture.responses.q.results[0],
            { ...matchFixture.responses.q.results[0], score: 0.9 },
          ],
          total: { value: 2, relation: "eq" },
        },
      },
    };
    const client = mockClient({ matchResult: duplicateMatch });
    await handleInvestigateEntity(client, {
      name: "Viktor Bout",
      schema: "Person",
    });

    expect(client.getEntity).toHaveBeenCalledTimes(1);
  });

  it("limits matches to max_matches", async () => {
    const manyMatches = {
      responses: {
        q: {
          results: Array.from({ length: 10 }, (_, i) => ({
            ...matchFixture.responses.q.results[0],
            id: `NK-${i}`,
            score: 0.95 - i * 0.01,
          })),
          total: { value: 10, relation: "eq" },
        },
      },
    };
    const client = mockClient({ matchResult: manyMatches });
    const result = await handleInvestigateEntity(client, {
      name: "test",
      schema: "Person",
      max_matches: 2,
    });

    const parsed = JSON.parse(result);
    expect(parsed.matches).toHaveLength(2);
    expect(client.getEntity).toHaveBeenCalledTimes(2);
  });
});
