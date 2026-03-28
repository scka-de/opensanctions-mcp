import type { OpenSanctionsClient } from "../client.js";

export interface ListDatasetsInput {
  query?: string;
}

export interface GetDatasetInput {
  name: string;
}

export async function handleListDatasets(
  client: OpenSanctionsClient,
  input: ListDatasetsInput,
): Promise<string> {
  const catalog = await client.getCatalog();

  let datasets = catalog.datasets.filter((d) => !d.deprecated);

  if (input.query) {
    const q = input.query.toLowerCase();
    datasets = datasets.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.title?.toLowerCase().includes(q) ||
        d.summary?.toLowerCase().includes(q),
    );
  }

  const compact = datasets.map((d) => ({
    name: d.name,
    title: d.title,
    summary: d.summary,
    entity_count: d.entity_count,
  }));

  return JSON.stringify({ total: compact.length, datasets: compact });
}

export async function handleGetDataset(
  client: OpenSanctionsClient,
  input: GetDatasetInput,
): Promise<string> {
  const catalog = await client.getCatalog();
  const dataset = catalog.datasets.find((d) => d.name === input.name);

  if (!dataset) {
    return JSON.stringify({
      error: `Dataset "${input.name}" not found. Use list_datasets to see available datasets.`,
    });
  }

  return JSON.stringify({
    name: dataset.name,
    title: dataset.title,
    summary: dataset.summary,
    description: dataset.description,
    url: dataset.url,
    updated_at: dataset.updated_at,
    entity_count: dataset.entity_count,
    publisher: dataset.publisher,
  });
}
