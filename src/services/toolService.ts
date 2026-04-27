import { ToolCall, ToolDefinition } from "./llmService";
import { search_laws, get_law_metadata, get_law_text, list_amendments, browse_taxonomy } from "./tools/fedlex";
import { search_commentaries, get_commentary_by_id } from "./tools/onlinekommentar";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const nativeTools: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "search_laws",
      description: "Search the Classified Compilation for laws matching a keyword in the title.",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "Keyword to search for in law titles." },
          language: { type: "string", description: "Language code (de, fr, it, en, rm)." },
          limit: { type: "number", description: "Maximum number of results to return." }
        },
        required: ["keyword"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_law_metadata",
      description: "Get detailed metadata for a specific law by its ELI URI.",
      parameters: {
        type: "object",
        properties: {
          eli_uri: { type: "string", description: "The ELI URI of the law." },
          language: { type: "string", description: "Language code (de, fr, it, en, rm)." }
        },
        required: ["eli_uri"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_law_text",
      description: "Get the text of a law by its ELI URI. Can extract a specific article if article_number is provided.",
      parameters: {
        type: "object",
        properties: {
          eli_uri: { type: "string", description: "The ELI URI of the law." },
          language: { type: "string", description: "Language code (de, fr, it, en, rm)." },
          article_number: { type: "string", description: "Optional article number to extract (e.g. '49', '49a')." }
        },
        required: ["eli_uri"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_amendments",
      description: "List the amendment history of a law (consolidated versions over time).",
      parameters: {
        type: "object",
        properties: {
          eli_uri: { type: "string", description: "The ELI URI of the law." },
          limit: { type: "number", description: "Maximum number of amendments to return." }
        },
        required: ["eli_uri"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "browse_taxonomy",
      description: "Browse the legal taxonomy tree (SR classification).",
      parameters: {
        type: "object",
        properties: {
          parent_uri: { type: "string", description: "Optional parent URI to get children. If omitted, returns top-level categories." },
          language: { type: "string", description: "Language code (de, fr, it, en, rm)." }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_commentaries",
      description: "Searches for legal commentaries based on a query and filters.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "The full-text search query." },
          language: { type: "string", description: "Content language (en, de, fr, it)." },
          legislative_act: { type: "string", description: "Filter by legislative act ID." },
          sort: { type: "string", description: "Sort order: title, -title, date, -date." },
          page: { type: "number", description: "Page number for pagination." }
        },
        required: ["search"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_commentary_by_id",
      description: "Retrieves a specific commentary by its ID.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "The ID of the commentary to retrieve." }
        },
        required: ["id"]
      }
    }
  }
];

let mcpClients: Record<string, Client> = {};

async function getMcpClient(url: string): Promise<Client> {
  if (mcpClients[url]) {
    return mcpClients[url];
  }

  const transport = new SSEClientTransport(new URL(url));
  const client = new Client({ name: "OpenInky-WordPlugin", version: "1.0.0" }, {
    capabilities: {}
  });
  
  await client.connect(transport);
  mcpClients[url] = client;
  return client;
}

export async function getAvailableTools(
  mcpServers: string[],
  enableFedlex: boolean = true,
  enableOnlinekommentar: boolean = true
): Promise<ToolDefinition[]> {
  let tools: ToolDefinition[] = [];

  if (enableFedlex) {
    tools.push(...nativeTools.filter(t => ["search_laws", "get_law_metadata", "get_law_text", "list_amendments", "browse_taxonomy"].includes(t.function.name)));
  }
  
  if (enableOnlinekommentar) {
    tools.push(...nativeTools.filter(t => ["search_commentaries", "get_commentary_by_id"].includes(t.function.name)));
  }

  for (const serverUrl of mcpServers) {
    try {
      const client = await getMcpClient(serverUrl);
      const serverTools = await client.listTools();
      if (serverTools && serverTools.tools) {
        for (const t of serverTools.tools) {
          tools.push({
            type: "function",
            function: {
              name: t.name,
              description: t.description || "",
              parameters: t.inputSchema as any
            }
          });
        }
      }
    } catch (e) {
      console.error(`Failed to connect or fetch tools from MCP server ${serverUrl}`, e);
    }
  }

  return tools;
}

export async function executeToolCall(call: ToolCall, mcpServers: string[]): Promise<{ result: string, source: string }> {
  const { name, arguments: argsString } = call.function;
  
  let args = {};
  try {
    args = JSON.parse(argsString);
  } catch (e) {
    return { result: `Error: Invalid JSON arguments for tool ${name}`, source: "System" };
  }

  try {
    switch (name) {
      case "search_laws":
        return { result: JSON.stringify(await search_laws(args as any)), source: "Fedlex API" };
      case "get_law_metadata":
        return { result: JSON.stringify(await get_law_metadata(args as any)), source: "Fedlex API" };
      case "get_law_text":
        return { result: JSON.stringify(await get_law_text(args as any)), source: "Fedlex API" };
      case "list_amendments":
        return { result: JSON.stringify(await list_amendments(args as any)), source: "Fedlex API" };
      case "browse_taxonomy":
        return { result: JSON.stringify(await browse_taxonomy(args as any)), source: "Fedlex API" };
      case "search_commentaries":
        return { result: await search_commentaries(args as any), source: "Onlinekommentar API" };
      case "get_commentary_by_id":
        return { result: await get_commentary_by_id(args as any), source: "Onlinekommentar API" };
      default:
        // Attempt to execute via MCP servers
        for (const serverUrl of mcpServers) {
          try {
            const client = await getMcpClient(serverUrl);
            const serverTools = await client.listTools();
            if (serverTools.tools.some(t => t.name === name)) {
              const result = await client.callTool({
                name: name,
                arguments: args
              });
              if (result.isError) {
                return { result: `Error from MCP tool ${name}: ${JSON.stringify(result.content)}`, source: `MCP Server: ${serverUrl}` };
              }
              return { 
                result: (result.content as any[]).map((c: any) => c.type === 'text' ? c.text : JSON.stringify(c)).join("\n"),
                source: `MCP Server: ${serverUrl}`
              };
            }
          } catch (e) {
            console.error(`Error executing MCP tool ${name} on server ${serverUrl}`, e);
          }
        }
        return { result: `Error: Tool ${name} not found locally or on connected MCP servers.`, source: "System" };
    }
  } catch (e: any) {
    return { result: `Error executing tool ${name}: ${e.message}`, source: "System" };
  }
}
