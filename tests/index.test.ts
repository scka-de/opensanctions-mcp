import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { describe, expect, it } from "vitest";
import { createServer } from "../src/index.js";

describe("MCP server", () => {
  async function setupClientServer() {
    const server = createServer();
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    const client = new Client({ name: "test-client", version: "1.0.0" });

    await server.connect(serverTransport);
    await client.connect(clientTransport);

    return { client, server };
  }

  it("starts and registers all tools", async () => {
    const { client } = await setupClientServer();
    const result = await client.listTools();

    const toolNames = result.tools.map((t) => t.name);
    expect(toolNames).toContain("search_entities");
    expect(toolNames).toContain("match_entity");
    expect(toolNames).toContain("get_entity");
    expect(toolNames).toContain("list_datasets");
    expect(toolNames).toContain("get_dataset");
    expect(toolNames).toContain("investigate_entity");
    expect(result.tools).toHaveLength(6);
  });

  it("each tool has a description", async () => {
    const { client } = await setupClientServer();
    const result = await client.listTools();

    for (const tool of result.tools) {
      expect(tool.description).toBeDefined();
      expect(tool.description?.length).toBeGreaterThan(20);
    }
  });

  it("each tool has an input schema", async () => {
    const { client } = await setupClientServer();
    const result = await client.listTools();

    for (const tool of result.tools) {
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe("object");
    }
  });
});
