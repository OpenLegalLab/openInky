# Fedlex MCP Server — Swiss Federal Law for Claude

An MCP server that gives Claude access to Swiss federal law via the [Fedlex](https://www.fedlex.admin.ch/) platform.

## What it does

The server exposes 5 tools:

| Tool | What it does | Data source |
|---|---|---|
| `search_laws` | Find laws by keyword in their title | SPARQL → metadata |
| `get_law_metadata` | Get detailed info about a specific law | SPARQL → metadata |
| `get_law_text` | Fetch the actual text (or a specific article) | SPARQL → URL → HTTP fetch HTML |
| `list_amendments` | Show version history of a law | SPARQL → metadata |
| `browse_taxonomy` | Navigate the SR classification tree | SPARQL → vocabulary |

### How the Fedlex API works (the two layers)

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: SPARQL endpoint                                    │
│  https://fedlex.data.admin.ch/sparqlendpoint                 │
│                                                              │
│  Contains: METADATA                                          │
│  - Which laws exist (ConsolidationAbstract)                  │
│  - Titles, SR numbers, dates, taxonomy                       │
│  - Links between acts (amendments, basic acts)               │
│  - Version history (Consolidation entries)                   │
│  - FRBR chain → URLs to actual documents                     │
│                                                              │
│  Does NOT contain: the actual law text                        │
└──────────────────────┬──────────────────────────────────────┘
                       │ follow URL from metadata
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: Document files                                     │
│  https://www.fedlex.admin.ch/eli/cc/...                      │
│                                                              │
│  Contains: ACTUAL TEXT                                        │
│  - HTML, PDF, XML (Akoma Ntoso) versions                     │
│  - The real law content                                      │
└─────────────────────────────────────────────────────────────┘
```

The `search_laws` and `get_law_metadata` tools only use Layer 1.
The `get_law_text` tool uses both: first SPARQL to find the URL, then HTTP to fetch the text.

## Setup

### 1. Install dependencies

```bash
cd fedlex-mcp
pip install -r requirements.txt
```

### 2. Test it works

```bash
python -c "
from fedlex_client import search_laws
results = search_laws('Raumplanung')
for r in results:
    print(f\"{r['title']} — {r['url']}\")
"
```

### 3. Add to Claude Desktop

Edit your `claude_desktop_config.json`:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "fedlex": {
      "command": "python3",
      "args": ["/ABSOLUTE/PATH/TO/fedlex-mcp/server.py"]
    }
  }
}
```

Replace `/ABSOLUTE/PATH/TO/` with the actual path on your machine.

Restart Claude Desktop. You should see the Fedlex tools in the connector menu.

### 4. (Optional) Run as remote server for Cowork

If you want to share this with your team or use it via Cowork as a remote connector:

```bash
python server.py --transport sse
```

Then add the URL (e.g. `http://localhost:8000/sse`) in Claude Desktop under
Settings → Connectors → Add custom connector.

**Note**: For remote/Cowork, you'll want to deploy this behind HTTPS
(e.g. on Cloud Run, Fly.io, or a simple VPS with nginx + Let's Encrypt).

## Example conversations

Once connected, you can ask Claude things like:

- *"Welche Gesetze gibt es zur Raumplanung?"*
- *"Was sagt Art. 22 des Raumplanungsgesetzes?"*
- *"Wann wurde das Umweltschutzgesetz zuletzt geändert?"*
- *"Zeig mir die SR-Klassifikation für Baurecht"*
- *"What does the Swiss federal constitution say about property rights?"*

## Architecture

```
Claude ←→ MCP Protocol ←→ server.py ←→ fedlex_client.py
                                            │
                                            ├→ SPARQL queries → fedlex.data.admin.ch
                                            └→ HTTP fetch     → www.fedlex.admin.ch
```

The MCP server (`server.py`) defines the tools. The client (`fedlex_client.py`) handles
the actual SPARQL queries and HTML fetching. This separation makes it easy to test
the client independently or reuse it in other contexts.

## Data model (JOLux ontology)

The SPARQL data follows the JOLux ontology with FRBR abstraction levels:

```
ConsolidationAbstract  (= a law in the SR, e.g. "RPG")
    │
    ├── Expression (title in DE/FR/IT/EN)
    │
    └── Consolidation (= a specific version at a point in time)
            │
            ├── Expression (text in DE/FR/IT/EN)
            │       │
            │       └── Manifestation (HTML / PDF / XML format)
            │               │
            │               └── URL (the actual file)
            │
            └── dateApplicability (when this version applies)
```

Full documentation: https://swiss.github.io/fedlex-jolux/

## License

MIT
