import type { OpenSanctionsClient } from "../client.js";

export interface MatchEntityInput {
  schema: string;
  properties: Record<string, string[]>;
  dataset?: string;
}

export async function handleMatchEntity(
  client: OpenSanctionsClient,
  input: MatchEntityInput,
): Promise<string> {
  const response = await client.match(input.schema, input.properties, {
    dataset: input.dataset,
  });

  const firstQuery = Object.values(response.responses)[0];
  if (!firstQuery || firstQuery.results.length === 0) {
    return JSON.stringify({
      message: "No matches found for the provided entity.",
      matches: [],
    });
  }

  const matches = firstQuery.results.map((entity) => ({
    id: entity.id,
    name: entity.caption,
    type: entity.schema,
    score: entity.score,
    datasets: entity.datasets,
    properties: entity.properties,
  }));

  return JSON.stringify({
    total: firstQuery.total.value,
    matches,
  });
}
