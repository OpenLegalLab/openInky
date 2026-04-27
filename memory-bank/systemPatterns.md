# System Patterns

**System Architecture:**
- **Frontend Framework:** React 18 using `@fluentui/react` for Office-native aesthetic components.
- **Entry Point:** `src/taskpane/index.tsx` bootstrapping the Add-in rendering logic.
- **Core Services:**
  - `llmService.ts`: Specialized module for communicating with OpenAI-compatible endpoints securely. Defines and expects specific interfaces (`LLMConfig`, `LLMMessage`, `LLMRequest`, `LLMResponse`).
  - `diffService.ts`: Wraps `jsdiff.diffWords` to determine granular value insertions and deletions (`DiffChunk`).
  - `wordService.ts`: Houses Microsoft Office `Word.run` contexts. Interacts heavily with `ChangeTrackingMode` turning it off to insert unchanged strings, and turning it to `trackAll` before inserting/deleting diffs.

**Key Technical Decisions:**
- Utilizing `jsdiff` specifically for word-level comparison rather than sentence or paragraph to emulate natural human correction.
- Circumventing Word range synchronization issues by isolating operations within clearly defined `Word.run` blocks, extracting text first, processing via API, calculating diffs, and then starting a new `Word.run` block for the tracking edits.
- Providing user-accessible local storage caching of configuration states (`Settings.tsx` saving `baseUrl`, `apiKey`, and `model` to `localStorage`).

**Component Relationships:**
- `<App />` is the main functional component. It holds state (prompt text, processing flags, errors).
- When a user requests text improvement, `<App />` delegates to `wordService.getTargetText()` to pull selection.
- `<App />` then triggers `llmService.fetchCompletion(...)`.
- `<App />` calculates the diff via `diffService.computeWordDiff(...)`.
- `<App />` finally pushes edits back to the document via `wordService.applyTrackedChanges(...)`.
- `<Settings />` is conditionally rendered over `<App />` when the user needs to configure endpoint variables.
