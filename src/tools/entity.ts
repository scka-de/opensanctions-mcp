import type { OpenSanctionsClient } from "../client.js";

export interface GetEntityInput {
  entityId: string;
}

export async function handleGetEntity(
  client: OpenSanctionsClient,
  input: GetEntityInput,
): Promise<string> {
  const entity = await client.getEntity(input.entityId);

  const relationships = [];
  for (const [relationType, adjacent] of Object.entries(
    entity.adjacent ?? {},
  )) {
    for (const related of adjacent.results) {
      relationships.push({
        relationship: relationType,
        id: related.id,
        name: related.caption,
        type: related.schema,
        datasets: related.datasets,
      });
    }
  }

  return JSON.stringify({
    id: entity.id,
    name: entity.caption,
    type: entity.schema,
    properties: entity.properties,
    datasets: entity.datasets,
    first_seen: entity.first_seen,
    last_seen: entity.last_seen,
    relationships,
  });
}
