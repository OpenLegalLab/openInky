# Implementation Plan

[Overview]
The goal is to implement tool-calling capabilities in the OpenInky Word Add-in by natively supporting direct API logic for Fedlex and Onlinekommentar, as well as an MCP client for external servers via SSE.

This implementation enhances the existing LLM integration by introducing a unified `ToolService` that provides native tools directly translated from the user's Python/Node code and dynamically fetches tools from external MCP servers (like Entscheidsuche). The `llmService` will be updated to send these tool definitions to the LLM, process tool calls, and feed the results back. This allows legal professionals to directly query Swiss law and commentaries within the Add-in without leaving Microsoft Word. Additionally, licensing and copyright attributions will be added to the project documentation and GUI to acknowledge the incorporated open-source code.

[Types]
Introduction of structured types to manage tool execution, LLM requests with tools, and MCP server configurations.

- `ToolDefinition`: Interface defining `type`, `function.name`, `function.description`, and `function.parameters` matching the OpenAI spec.
- `ToolCall`: Interface for tool calls received from the LLM, containing `id`, `type`, and `function.arguments`.
- `ToolResponse`: Interface for the LLM's required format for submitting tool results (`role: 'tool'`, `tool_call_id`, `content`).
- Updates to `LLMConfig` in `llmService.ts`: Add optional `mcpServers: string[]` to store URLs of external MCP servers.
- Updates to `LLMRequest` in `llmService.ts`: Add optional `tools?: ToolDefinition[]` and `tool_choice?: string`.

[Files]
Creation of new service files for tool logic and modifications to existing UI and LLM components to support the tool-calling loop.

- New file `src/services/tools/fedlex.ts`: Direct translation of the Fedlex Python SPARQL and HTML fetching logic into TypeScript.
- New file `src/services/tools/onlinekommentar.ts`: Direct translation of the Onlinekommentar Node API fetching logic into TypeScript.
- New file `src/services/toolService.ts`: Central registry for tools, responsible for combining native tools with dynamically fetched MCP tools (via SSEClientTransport) and routing tool executions.
- Modify `src/services/llmService.ts`: Update `fetchCompletion` to accept tools and handle the tool execution loop if `tool_calls` are returned by the LLM.
- Modify `src/taskpane/components/App.tsx`: Update the main prompt execution flow to support tool loading states and pass configurations to the updated `llmService`.
- Modify `src/taskpane/components/Settings.tsx`: Add UI fields for users to configure external MCP server URLs (e.g., `https://mcp.entscheidsuche.ch/mcp`).
- Modify `README.md` and `LICENSE.md`: Append copyright notices for Fedlex and Onlinekommentar code.

[Functions]
Implementation of native tool logic, tool coordination, and recursive LLM completion handling.

- New functions in `fedlex.ts`: `search_laws`, `get_law_metadata`, `get_law_text`, `list_amendments`, `browse_taxonomy` (making HTTP requests and XML/HTML parsing where necessary).
- New functions in `onlinekommentar.ts`: `search_commentaries`, `get_commentary_by_id`.
- New functions in `toolService.ts`: `getAvailableTools(mcpServers: string[])` to aggregate native and remote tools, and `executeToolCall(call: ToolCall)` to route execution to the correct native or MCP handler.
- Modified `fetchCompletion` in `llmService.ts`: Enhance to detect `finish_reason === 'tool_calls'`, call `executeToolCall` for each, and recursively call the LLM API with the appended tool responses until completion.

[Classes]
Integration of the official Model Context Protocol Client class to manage SSE connections.

- New class usage in `toolService.ts`: Instantiate `Client` from `@modelcontextprotocol/sdk/client/index.js` and `SSEClientTransport` from `@modelcontextprotocol/sdk/client/sse.js` to connect to and interact with configured MCP servers dynamically.

[Dependencies]
Installation of required packages for MCP protocol support and parameter validation.

- Install `@modelcontextprotocol/sdk` (version `^1.17.1`) to enable MCP client connectivity over SSE.
- Install `zod` to assist with any schema validation if required by the SDK or tool definitions.

[Implementation Order]
Sequential integration starting from core API logic, building up to LLM integration and UI configuration.

1. Install new dependencies (`@modelcontextprotocol/sdk` and `zod`).
2. Create `src/services/tools/fedlex.ts` and `src/services/tools/onlinekommentar.ts` with direct API fetching logic.
3. Create `src/services/toolService.ts` to manage native tools and establish the MCP Client logic for external servers.
4. Update `src/services/llmService.ts` to support OpenAI tool schemas, parsing `tool_calls`, executing them via `toolService`, and handling the recursive tool-call completion loop.
5. Update `src/taskpane/components/Settings.tsx` to add UI for entering MCP Server URLs and display copyright/license notices.
6. Update `README.md` and `LICENSE.md` with appropriate attributions.
7. Test the full tool-calling flow with `App.tsx` handling complex legal queries.