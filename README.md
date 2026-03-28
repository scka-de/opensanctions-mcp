# opensanctions-mcp

MCP server for sanctions screening and PEP checks via the [OpenSanctions](https://www.opensanctions.org/) API.

Lets AI agents (Claude, Cursor, Windsurf, GPT) screen persons and companies against 320+ sanctions and PEP lists from OFAC, EU, UN, UK HMT, and more.

> **Disclaimer:** This tool provides informational data only. It is not legal or compliance advice. Always verify matches with official sources before taking action.

## Quick Start

Add to your MCP client config:

```json
{
  "mcpServers": {
    "opensanctions": {
      "command": "npx",
      "args": ["-y", "opensanctions-mcp"],
      "env": {
        "OPENSANCTIONS_API_KEY": "your-key-here"
      }
    }
  }
}
```

Get a free API key at [opensanctions.org/api](https://www.opensanctions.org/api/).

### Where to add this config

- **Claude Desktop:** `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows)
- **Cursor:** Settings > MCP Servers
- **Windsurf:** `~/.windsurf/config.json`

## Tools

### search_entities

Search the OpenSanctions database by name or keyword.

```
"Search for entities named Viktor Bout"
"Find companies related to Iran sanctions"
```

### match_entity

Screen a person or company against sanctions and PEP lists using structured properties. This is the primary screening tool.

```
"Screen Viktor Bout, born 1967-01-13, Russian national, against sanctions lists"
"Check if Acme Corp is on any EU sanctions list"
```

### get_entity

Fetch complete details for a specific entity, including relationships to other entities (companies, associates, family members).

```
"Get full details for entity NK-2Ciy8EG7jz1YHMGCxYLb25"
```

### list_datasets

List available sanctions and PEP datasets. No API key required.

```
"What sanctions lists are available?"
"Show me EU-related datasets"
```

### get_dataset

Get details about a specific dataset (publisher, entity count, last updated). No API key required.

```
"Tell me about the OFAC SDN list"
```

### investigate_entity

Run a full compliance investigation in one call: match, fetch details, map relationships, and return structured data.

```
"Investigate Viktor Bout for sanctions exposure"
"Run a compliance check on Acme Corp, jurisdiction Belgium"
```

## Configuration

| Environment Variable | Required | Default | Description |
|---|---|---|---|
| `OPENSANCTIONS_API_KEY` | Yes* | — | API key for the hosted OpenSanctions API. Get one at [opensanctions.org/api](https://www.opensanctions.org/api/). |
| `OPENSANCTIONS_API_URL` | No | `https://api.opensanctions.org` | API URL. Set to your self-hosted yente instance. |
| `OPENSANCTIONS_DATASET` | No | `default` | Dataset to screen against. `default` includes all 320+ sources. |
| `OPENSANCTIONS_MAX_RETRIES` | No | `3` | Max retries for failed API calls. |
| `DEBUG` | No | — | Set to any value to enable debug logging. |

*Not required for `list_datasets`, `get_dataset`, or when using a self-hosted yente instance without auth.

## Self-hosted yente

If you run your own [yente](https://github.com/opensanctions/yente) instance, point the server at it:

```json
{
  "mcpServers": {
    "opensanctions": {
      "command": "npx",
      "args": ["-y", "opensanctions-mcp"],
      "env": {
        "OPENSANCTIONS_API_URL": "http://localhost:8000"
      }
    }
  }
}
```

No API key needed for self-hosted yente.

## Development

```bash
git clone https://github.com/scka-de/opensanctions-mcp.git
cd opensanctions-mcp
npm install
npm test          # run tests (fixtures, no API key needed)
npm run build     # compile to dist/
npm run dev       # run in dev mode
npm run lint      # check code style
```

## License

MIT
