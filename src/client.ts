import { logger } from "./logger.js";
import type {
  CatalogResponse,
  EntityResponse,
  MatchResponse,
  SearchResponse,
} from "./types.js";

export interface ClientConfig {
  apiUrl: string;
  apiKey: string | undefined;
  dataset: string;
  maxRetries: number;
  timeoutMs: number;
}

export function createClientConfig(): ClientConfig {
  return {
    apiUrl: (
      process.env.OPENSANCTIONS_API_URL || "https://api.opensanctions.org"
    ).replace(/\/+$/, ""),
    apiKey: process.env.OPENSANCTIONS_API_KEY,
    dataset: process.env.OPENSANCTIONS_DATASET || "default",
    maxRetries: Number.parseInt(
      process.env.OPENSANCTIONS_MAX_RETRIES || "3",
      10,
    ),
    timeoutMs: 5000,
  };
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  config: ClientConfig,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.status === 429 && attempt < config.maxRetries) {
        const delay = 2 ** attempt * 1000;
        logger.warn(`Rate limited (429), retrying in ${delay}ms`, {
          attempt: attempt + 1,
          url,
        });
        await sleep(delay);
        continue;
      }

      if (response.status >= 500 && attempt < config.maxRetries) {
        const delay = 2000;
        logger.warn(
          `Server error (${response.status}), retrying in ${delay}ms`,
          {
            attempt: attempt + 1,
            url,
          },
        );
        await sleep(delay);
        continue;
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (lastError.name === "AbortError") {
        throw new OpenSanctionsError(
          `Request timeout after ${config.timeoutMs}ms: ${url}`,
        );
      }

      if (attempt < config.maxRetries) {
        const delay = 2 ** attempt * 1000;
        logger.warn(`Network error, retrying in ${delay}ms`, {
          attempt: attempt + 1,
          error: lastError.message,
        });
        await sleep(delay);
      }
    }
  }

  throw new OpenSanctionsError(
    `Cannot connect to OpenSanctions API at ${config.apiUrl}: ${lastError?.message}`,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class OpenSanctionsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenSanctionsError";
  }
}

function headers(config: ClientConfig): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (config.apiKey) {
    h.Authorization = `ApiKey ${config.apiKey}`;
  }
  return h;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 401 || response.status === 403) {
    throw new OpenSanctionsError(
      "API key required or invalid. Set OPENSANCTIONS_API_KEY environment variable. Get a free key at https://www.opensanctions.org/api/",
    );
  }

  if (response.status === 404) {
    throw new OpenSanctionsError(`Not found: ${response.url}`);
  }

  if (response.status === 429) {
    throw new OpenSanctionsError(
      "OpenSanctions API rate limit exceeded. Try again later or use a self-hosted yente instance.",
    );
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "Unknown error");
    throw new OpenSanctionsError(
      `OpenSanctions API error (${response.status}): ${text}`,
    );
  }

  return response.json() as Promise<T>;
}

export class OpenSanctionsClient {
  private config: ClientConfig;

  constructor(config: ClientConfig) {
    this.config = config;
  }

  async search(
    query: string,
    options?: { dataset?: string; schema?: string; limit?: number },
  ): Promise<SearchResponse> {
    const dataset = options?.dataset || this.config.dataset;
    const params = new URLSearchParams({ q: query });
    if (options?.schema) params.set("schema", options.schema);
    if (options?.limit) params.set("limit", String(options.limit));

    const url = `${this.config.apiUrl}/search/${dataset}?${params}`;
    const response = await fetchWithRetry(
      url,
      { method: "GET", headers: headers(this.config) },
      this.config,
    );
    return handleResponse<SearchResponse>(response);
  }

  async match(
    schema: string,
    properties: Record<string, string[]>,
    options?: { dataset?: string },
  ): Promise<MatchResponse> {
    const dataset = options?.dataset || this.config.dataset;
    const url = `${this.config.apiUrl}/match/${dataset}`;
    const body = { schema, properties };

    const response = await fetchWithRetry(
      url,
      {
        method: "POST",
        headers: headers(this.config),
        body: JSON.stringify(body),
      },
      this.config,
    );
    return handleResponse<MatchResponse>(response);
  }

  async getEntity(entityId: string): Promise<EntityResponse> {
    const url = `${this.config.apiUrl}/entities/${entityId}`;
    const response = await fetchWithRetry(
      url,
      { method: "GET", headers: headers(this.config) },
      this.config,
    );
    return handleResponse<EntityResponse>(response);
  }

  async getCatalog(): Promise<CatalogResponse> {
    const url = `${this.config.apiUrl}/catalog`;
    const response = await fetchWithRetry(
      url,
      { method: "GET", headers: headers(this.config) },
      this.config,
    );
    return handleResponse<CatalogResponse>(response);
  }
}
