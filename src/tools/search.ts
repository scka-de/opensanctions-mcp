import type { OpenSanctionsClient } from "../client.js";

export interface SearchEntitiesInput {
  query: string;
  schema?: string;
  dataset?: string;
  limit?: number;
}

export async function handleSearchEntities(
  client: OpenSanctionsClient,
  input: SearchEntitiesInput,
): Promise<string> {
  const response = await client.search(input.query, {
    schema: input.schema,
    dataset: input.dataset,
    limit: input.limit,
  });

  if (response.results.length === 0) {
    return JSON.stringify({
      message: `No entities found matching "${input.query}".`,
      total: 0,
    });
  }

  const results = response.results.map((entity) => ({
    id: entity.id,
    name: entity.caption,
    type: entity.schema,
    datasets: entity.datasets,
    properties: entity.properties,
  }));

  return JSON.stringify({
    total: response.total.value,
    results,
  });
}
