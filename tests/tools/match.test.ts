import { afterEach, describe, expect, it, vi } from "vitest";
import type { OpenSanctionsClient } from "../../src/client.js";
import { handleMatchEntity } from "../../src/tools/match.js";
import matchFixture from "../fixtures/match-person.json";

function mockClient(matchResult = matchFixture) {
  return {
    match: vi.fn().mockResolvedValue(matchResult),
  } as unknown as OpenSanctionsClient;
}

describe("match_entity tool", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns scored matches for a person", async () => {
    const client = mockClient();
    const result = await handleMatchEntity(client, {
      schema: "Person",
      properties: { name: ["Viktor Bout"], birthDate: ["1967-01-13"] },
    });

    expect(client.match).toHaveBeenCalledWith(
      "Person",
      { name: ["Viktor Bout"], birthDate: ["1967-01-13"] },
      { dataset: undefined },
    );

    const parsed = JSON.parse(result);
    expect(parsed.matches).toHaveLength(1);
    expect(parsed.matches[0].score).toBe(0.95);
    expect(parsed.matches[0].datasets).toContain("us_ofac_sdn");
  });

  it("passes dataset filter", async () => {
    const client = mockClient();
    await handleMatchEntity(client, {
      schema: "Company",
      properties: { name: ["Test Corp"] },
      dataset: "eu_fsf",
    });

    expect(client.match).toHaveBeenCalledWith(
      "Company",
      { name: ["Test Corp"] },
      { dataset: "eu_fsf" },
    );
  });

  it("handles no matches", async () => {
    const client = mockClient({
      responses: { "0": { results: [], total: 0 } },
    });
    const result = await handleMatchEntity(client, {
      schema: "Person",
      properties: { name: ["Nobody Known"] },
    });

    const parsed = JSON.parse(result);
    expect(parsed.matches).toHaveLength(0);
    expect(parsed.message).toContain("No matches");
  });
});
