import { afterEach, describe, expect, it, vi } from "vitest";
import type { OpenSanctionsClient } from "../../src/client.js";
import { handleGetEntity } from "../../src/tools/entity.js";
import entityFixture from "../fixtures/entity-with-relations.json";

function mockClient(entityResult = entityFixture) {
  return {
    getEntity: vi.fn().mockResolvedValue(entityResult),
  } as unknown as OpenSanctionsClient;
}

describe("get_entity tool", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns entity with relationships", async () => {
    const client = mockClient();
    const result = await handleGetEntity(client, {
      entityId: "Q314650",
    });

    expect(client.getEntity).toHaveBeenCalledWith("Q314650");

    const parsed = JSON.parse(result);
    expect(parsed.id).toBe("Q314650");
    expect(parsed.name).toBe("Viktor Bout");
    expect(parsed.datasets).toContain("us_ofac_sdn");
    expect(parsed.relationships).toHaveLength(1);
    expect(parsed.relationships[0].name).toBe("Air Cess Ltd");
    expect(parsed.relationships[0].relationship).toBe("ownershipOwner");
  });

  it("handles entity with no relationships", async () => {
    const client = mockClient({ ...entityFixture, adjacent: {} });
    const result = await handleGetEntity(client, { entityId: "NK-test" });

    const parsed = JSON.parse(result);
    expect(parsed.relationships).toHaveLength(0);
  });
});
