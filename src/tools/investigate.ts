import type { OpenSanctionsClient } from "../client.js";
import { logger } from "../logger.js";
import type { EntityResponse, ScoredEntity } from "../types.js";

export interface InvestigateEntityInput {
  name: string;
  schema: string;
  birthDate?: string;
  nationality?: string;
  jurisdiction?: string;
  threshold?: number;
  max_matches?: number;
  dataset?: string;
}

export async function handleInvestigateEntity(
  client: OpenSanctionsClient,
  input: InvestigateEntityInput,
): Promise<string> {
  const threshold = input.threshold ?? 0.7;
  const maxMatches = input.max_matches ?? 3;

  const properties: Record<string, string[]> = {
    name: [input.name],
  };
  if (input.birthDate) properties.birthDate = [input.birthDate];
  if (input.nationality) properties.nationality = [input.nationality];
  if (input.jurisdiction) properties.jurisdiction = [input.jurisdiction];

  const matchResponse = await client.match(input.schema, properties, {
    dataset: input.dataset,
  });

  const firstQuery = Object.values(matchResponse.responses)[0];
  if (!firstQuery || firstQuery.results.length === 0) {
    return JSON.stringify({
      query: { name: input.name, schema: input.schema },
      matches: [],
      datasets_involved: [],
      message: "No matches found for the provided entity.",
      disclaimer:
        "This data is informational only. Not legal or compliance advice. Verify all matches with official sources before taking action.",
    });
  }

  const aboveThreshold = firstQuery.results.filter((r) => r.score >= threshold);

  if (aboveThreshold.length === 0) {
    return JSON.stringify({
      query: { name: input.name, schema: input.schema },
      matches: [],
      datasets_involved: [],
      message: `No matches above threshold (${threshold}). Closest match scored ${firstQuery.results[0].score}.`,
      disclaimer:
        "This data is informational only. Not legal or compliance advice. Verify all matches with official sources before taking action.",
    });
  }

  const topMatches = aboveThreshold.slice(0, maxMatches);

  const uniqueIds = [...new Set(topMatches.map((m) => m.id))];

  const entityDetails = await Promise.all(
    uniqueIds.map((id) => fetchEntitySafe(client, id)),
  );

  const entityMap = new Map<
    string,
    { entity: EntityResponse | null; error?: string }
  >();
  for (let i = 0; i < uniqueIds.length; i++) {
    entityMap.set(uniqueIds[i], entityDetails[i]);
  }

  const allDatasets = new Set<string>();
  const matches = topMatches.map((match) => {
    for (const ds of match.datasets) allDatasets.add(ds);
    const result = entityMap.get(match.id);
    return formatMatch(match, result?.entity ?? null, result?.error);
  });

  return JSON.stringify({
    query: { name: input.name, schema: input.schema },
    matches,
    datasets_involved: [...allDatasets],
    disclaimer:
      "This data is informational only. Not legal or compliance advice. Verify all matches with official sources before taking action.",
  });
}

interface FetchResult {
  entity: EntityResponse | null;
  error?: string;
}

async function fetchEntitySafe(
  client: OpenSanctionsClient,
  entityId: string,
): Promise<FetchResult> {
  try {
    const entity = await client.getEntity(entityId);
    return { entity };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`Failed to fetch entity ${entityId}`, { error: message });
    return { entity: null, error: message };
  }
}

function formatMatch(
  match: ScoredEntity,
  entity: EntityResponse | null,
  fetchError?: string,
): Record<string, unknown> {
  const relationships = [];

  if (entity) {
    for (const [relationType, adjacent] of Object.entries(entity.adjacent)) {
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
  }

  const result: Record<string, unknown> = {
    id: match.id,
    name: match.caption,
    type: match.schema,
    score: match.score,
    datasets: match.datasets,
    properties: match.properties,
    relationships,
  };

  if (!entity && fetchError) {
    result.fetch_error = fetchError;
  } else if (!entity) {
    result.fetch_error = "Could not fetch full entity details.";
  }

  return result;
}
