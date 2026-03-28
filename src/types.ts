/**
 * Types representing OpenSanctions yente API responses.
 * Based on the OpenAPI spec at api.opensanctions.org/openapi.json
 */

export interface EntityProperties {
  [key: string]: string[];
}

export interface Entity {
  id: string;
  caption: string;
  schema: string;
  properties: EntityProperties;
  datasets: string[];
  referents: string[];
  first_seen: string;
  last_seen: string;
  target: boolean;
  last_change: string;
}

export interface ScoredEntity extends Entity {
  score: number;
  match: boolean;
  explanations?: Record<string, unknown>[];
}

export interface SearchTotal {
  value: number;
  relation: string;
}

export interface SearchResponse {
  results: Entity[];
  total: SearchTotal;
  limit: number;
  offset: number;
}

export interface MatchResponse {
  responses: Record<
    string,
    { status: number; results: ScoredEntity[]; total: SearchTotal }
  >;
}

export interface EntityResponse extends Entity {
  adjacent?: Record<string, AdjacentResult> | null;
}

export interface AdjacentResult {
  results: Entity[];
  total: number;
  limit: number;
  offset: number;
}

export interface DatasetPublisher {
  name: string;
  url: string | null;
  acronym: string | null;
  description: string | null;
  country: string | null;
  country_label: string | null;
  official: boolean;
}

export interface Dataset {
  name: string;
  title: string;
  summary: string | null;
  description: string | null;
  url: string | null;
  updated_at: string | null;
  last_export: string | null;
  entity_count: number | null;
  thing_count: number | null;
  version: string | null;
  publisher: DatasetPublisher | null;
  children: string[];
  deprecated: boolean;
}

export interface CatalogResponse {
  datasets: Dataset[];
}

export interface AlgorithmFeature {
  description: string;
  coefficient: number;
  url: string;
}

export interface Algorithm {
  name: string;
  description: string;
  features: Record<string, AlgorithmFeature>;
}

export interface AlgorithmsResponse {
  algorithms: Algorithm[];
}

export interface HealthResponse {
  status: string;
}

export interface ApiError {
  detail: string;
}
