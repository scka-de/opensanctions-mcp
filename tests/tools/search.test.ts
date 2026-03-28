import { afterEach, describe, expect, it, vi } from "vitest";
import type { OpenSanctionsClient } from "../../src/client.js";
import { handleSearchEntities } from "../../src/tools/search.js";
import searchFixture from "../fixtures/search-person.json";

function mockClient(searchResult = searchFixture) {
  return {
    search: vi.fn().mockResolvedValue(searchResult),
  } as unknown as OpenSanctionsClient;
}

describe("search_entities tool", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns formatted results for a name query", async () => {
    const client = mockClient();
    const result = await handleSearchEntities(client, {
      query: "Viktor Bout",
    });

    expect(client.search).toHaveBeenCalledWith("Viktor Bout", {
      dataset: undefined,
      schema: undefined,
      limit: undefined,
    });
    expect(result).toContain("Viktor Bout");
    expect(result).toContain("us_ofac_sdn");
  });

  it("passes optional params to client", async () => {
    const client = mockClient();
    await handleSearchEntities(client, {
      query: "test",
      schema: "Company",
      dataset: "eu_fsf",
      limit: 5,
    });

    expect(client.search).toHaveBeenCalledWith("test", {
      schema: "Company",
      dataset: "eu_fsf",
      limit: 5,
    });
  });

  it("handles empty results", async () => {
    const client = mockClient({
      results: [],
      total: { value: 0, relation: "eq" },
      limit: 20,
      offset: 0,
    });
    const result = await handleSearchEntities(client, {
      query: "zzzznotfound",
    });

    expect(result).toContain("No entities found");
  });
});
