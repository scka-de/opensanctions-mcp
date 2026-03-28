import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { OpenSanctionsClient, createClientConfig } from "./client.js";
import { logger } from "./logger.js";
import { handleGetDataset, handleListDatasets } from "./tools/datasets.js";
import { handleGetEntity } from "./tools/entity.js";
import { handleInvestigateEntity } from "./tools/investigate.js";
import { handleMatchEntity } from "./tools/match.js";
import { handleSearchEntities } from "./tools/search.js";

export function createServer(): McpServer {
  const config = createClientConfig();
  const client = new OpenSanctionsClient(config);

  const server = new McpServer({
    name: "opensanctions-mcp",
    version: "0.1.0",
  });

  server.tool(
    "search_entities",
    `Search the OpenSanctions database by name or keyword. Returns matching entities ordered by relevance.

Use this for exploratory queries: "find entities named Goldman", "search for companies in Russia".
For formal sanctions screening with confidence scores, use match_entity instead.

Results include entity type, datasets (which sanctions lists), and properties. For numeric match scores, use match_entity.`,
    {
      query: z.string().describe("Name or keyword to search for"),
      schema: z
        .string()
        .optional()
        .describe(
          'Filter by entity type: "Person", "Company", "LegalEntity", "Organization"',
        ),
      dataset: z
        .string()
        .optional()
        .describe(
          'Screen against a specific dataset (e.g. "us_ofac_sdn"). Defaults to all datasets.',
        ),
      limit: z
        .number()
        .optional()
        .describe("Max results to return (default: 20)"),
    },
    async (input) => {
      const text = await handleSearchEntities(client, input);
      return { content: [{ type: "text" as const, text }] };
    },
  );

  server.tool(
    "match_entity",
    `Screen a person or company against sanctions and PEP (Politically Exposed Person) lists using structured properties.

This is the primary screening tool. Provide a schema type and properties for precise matching.
The matching algorithm uses name comparison, birth dates, nationalities, and identifiers for scoring.

Scores: 0.0-1.0. Above 0.9 = very high confidence match. 0.7-0.9 = likely match, investigate further. Below 0.7 = possible but uncertain.

PEP = Politically Exposed Person (senior government officials, their families, close associates). PEP status appears in the "topics" property as "role.pep".`,
    {
      schema: z
        .enum(["Person", "Company", "LegalEntity", "Organization"])
        .describe("Entity type to match against"),
      properties: z
        .record(z.array(z.string()))
        .describe(
          'Entity properties. Required: "name". Optional for Person: "birthDate", "nationality", "idNumber", "gender". Optional for Company: "jurisdiction", "registrationNumber", "incorporationDate".',
        ),
      dataset: z
        .string()
        .optional()
        .describe("Screen against a specific dataset. Defaults to all."),
    },
    async (input) => {
      const text = await handleMatchEntity(client, input);
      return { content: [{ type: "text" as const, text }] };
    },
  );

  server.tool(
    "get_entity",
    `Fetch complete details for a specific entity by ID, including all properties, dataset memberships, and relationships to other entities.

Use this after finding an entity via search or match to get the full picture: aliases, addresses, birth dates, related companies, family members, associates.

Relationships come from the OpenSanctions knowledge graph. Types include: ownershipOwner, familyRelative, associate, directorshipDirector, and more.`,
    {
      entityId: z.string().describe("OpenSanctions entity ID (e.g. NK-...)"),
    },
    async (input) => {
      const text = await handleGetEntity(client, input);
      return { content: [{ type: "text" as const, text }] };
    },
  );

  server.tool(
    "list_datasets",
    `List available sanctions and PEP datasets in OpenSanctions. No API key required.

Returns dataset names, titles, summaries, and entity counts. Use the optional query parameter to filter.
Examples of datasets: "us_ofac_sdn" (US OFAC), "eu_fsf" (EU Financial Sanctions), "un_sc_sanctions" (UN Security Council), "gb_hmt_sanctions" (UK HMT).`,
    {
      query: z
        .string()
        .optional()
        .describe(
          'Filter datasets by name, title, or summary (e.g. "ofac", "eu", "pep")',
        ),
    },
    async (input) => {
      const text = await handleListDatasets(client, input);
      return { content: [{ type: "text" as const, text }] };
    },
  );

  server.tool(
    "get_dataset",
    `Get full details about a specific dataset: description, publisher, entity count, last updated, and coverage information. No API key required.

Use list_datasets first to find dataset names, then this tool for details.`,
    {
      name: z.string().describe('Dataset name (e.g. "us_ofac_sdn", "eu_fsf")'),
    },
    async (input) => {
      const text = await handleGetDataset(client, input);
      return { content: [{ type: "text" as const, text }] };
    },
  );

  server.tool(
    "investigate_entity",
    `Run a multi-step compliance investigation on a person or company. This is the most powerful tool — it combines matching, entity details, and relationship traversal in one call.

Steps: (1) Match the name against sanctions/PEP lists, (2) Fetch full details and relationships for top matches, (3) Return structured data with scores, datasets, and connected entities.

Returns data only — no risk judgments. You (the AI) should interpret the scores, dataset memberships, and relationships to provide context to the user.

Requires both name and schema (Person/Company). Provide additional properties like birthDate or nationality for better match precision.`,
    {
      name: z.string().describe("Entity name to investigate"),
      schema: z
        .enum(["Person", "Company", "LegalEntity", "Organization"])
        .describe("Entity type"),
      birthDate: z
        .string()
        .optional()
        .describe("ISO date (Person only, improves match precision)"),
      nationality: z
        .string()
        .optional()
        .describe("ISO country code (Person only)"),
      jurisdiction: z
        .string()
        .optional()
        .describe("ISO country code (Company only)"),
      threshold: z
        .number()
        .optional()
        .describe("Minimum match score 0.0-1.0 (default: 0.7)"),
      max_matches: z
        .number()
        .optional()
        .describe("Max matches to investigate in detail (default: 3)"),
      dataset: z
        .string()
        .optional()
        .describe("Specific dataset to screen against"),
    },
    async (input) => {
      const text = await handleInvestigateEntity(client, input);
      return { content: [{ type: "text" as const, text }] };
    },
  );

  return server;
}

async function main(): Promise<void> {
  logger.info("Starting OpenSanctions MCP server");

  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info("OpenSanctions MCP server running on stdio");
}

main().catch((error) => {
  logger.error("Fatal error", { error: String(error) });
  process.exit(1);
});
