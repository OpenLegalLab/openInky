# Technical Context

**Technologies Used:**
- React 18, `@fluentui/react` (v8) for Office-specific component design
- `diff` (jsdiff) for word-level diff generation
- Node.js environment (v16-v21 compatible via initial `package.json` specifications, running on Webpack)
- `yo office` Office Add-in generator framework (Task Pane template)
- TypeScript (v5+)

**Development Setup:**
- Add-in testing executed via `npm start` utilizing Microsoft's `office-addin-debugging` tooling, natively sideloading over `localhost:3000`.
- Requires `manifest.xml` validation for Add-in metadata, provider domains, and ribbon groupings.
- Uses `npm run build` for Webpack production packaging.

**Technical Constraints & Trade-offs:**
- Fetching large texts and reinserting chunks requires precision handling to not lose cursor state in Word documents.
- `ChangeTrackingMode` requires turning off and on dynamically mid-sync to prevent native diffs combining the entire paragraph block as one giant deletion/insertion operation.
- Because `Word.Range` objects behave unpredictably between `Word.run` boundaries, ranges are discarded after text is extracted. We create fresh range pointers explicitly targeting current cursor context or the entire document body.
- AI parameters such as `temperature` may be unsupported dynamically across different OpenAI-compatible servers (specifically `litellm` handling `gpt-5.2` logic), restricting us to default configurations unless explicitly handled.

**Dependencies:**
- `diff`, `@types/diff`, `@fluentui/react`, `@fluentui/react-icons`, `@fluentui/react-components`.
