import { afterEach, describe, expect, it, vi } from "vitest";
import type { OpenSanctionsClient } from "../../src/client.js";
import {
  handleGetDataset,
  handleListDatasets,
} from "../../src/tools/datasets.js";
import catalogFixture from "../fixtures/catalog.json";

function mockClient(catalogResult = catalogFixture) {
  return {
    getCatalog: vi.fn().mockResolvedValue(catalogResult),
  } as unknown as OpenSanctionsClient;
}

describe("list_datasets tool", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns compact dataset list", async () => {
    const client = mockClient();
    const result = await handleListDatasets(client, {});

    const parsed = JSON.parse(result);
    expect(parsed.datasets).toHaveLength(2);
    expect(parsed.datasets[0].name).toBe("us_ofac_sdn");
    expect(parsed.datasets[0].title).toBe(
      "US OFAC Specially Designated Nationals",
    );
    expect(parsed.datasets[0]).toHaveProperty("entity_count");
    expect(parsed.datasets[0]).not.toHaveProperty("description");
  });

  it("filters by query", async () => {
    const client = mockClient();
    const result = await handleListDatasets(client, { query: "ofac" });

    const parsed = JSON.parse(result);
    expect(parsed.datasets).toHaveLength(1);
    expect(parsed.datasets[0].name).toBe("us_ofac_sdn");
  });

  it("handles empty catalog", async () => {
    const client = mockClient({ datasets: [] });
    const result = await handleListDatasets(client, {});

    const parsed = JSON.parse(result);
    expect(parsed.datasets).toHaveLength(0);
  });
});

describe("get_dataset tool", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns full details for a specific dataset", async () => {
    const client = mockClient();
    const result = await handleGetDataset(client, { name: "us_ofac_sdn" });

    const parsed = JSON.parse(result);
    expect(parsed.name).toBe("us_ofac_sdn");
    expect(parsed.description).toBeDefined();
    expect(parsed.publisher).toBeDefined();
    expect(parsed.publisher.name).toBe("US Treasury Department");
  });

  it("returns error for unknown dataset", async () => {
    const client = mockClient();
    const result = await handleGetDataset(client, { name: "nonexistent" });

    const parsed = JSON.parse(result);
    expect(parsed.error).toContain("not found");
  });
});
