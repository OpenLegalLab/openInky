# Active Context

**Current Work Focus:**
- Initializing the memory bank to capture project architecture and context.
- Finishing up localized German UI implementations and Add-in manifest branding (OpenInky / Raxal GmbH -> OpenLegalLab).

**Recent Changes:**
- Bumped version to 0.2.2.0 across manifests and `package.json`.
- Updated `webpack.config.js` to exclude `manifest.ll.xml` from the copied `dist` output.
- Added `manifest.ll.xml` for internal deployment (ignored in git) using URL query parameters (`apiKey`, `model`, and `baseUrl`) to pre-configure the LLM endpoint logic.
- Updated `manifest.xml` and `manifest.demo.xml` to include `https://llm.lauxlawyers.ch` in `AppDomains`.
- Updated `App.tsx` initialization to parse `window.location.search` overriding default/cached `LLMConfig`.
- Bumped version to v0.2.1.0 to include `manifest.demo.xml` and an `index.html` redirect to the GitHub repository.
- Hosted a live demo version of the Web App on `https://openinky.raxal.io`.
- Scaffolded project using `yo office` React template and manually converted to single-host Word Add-in.
- Completed core UI development using `@fluentui/react` components (`App.tsx`, `Settings.tsx`).
- Created LLM Service (`llmService.ts`) robust enough to handle custom API bases with fallback error tracking parsed directly from response bodies. Handled specific parameter dropping (e.g. dynamic `temperature` dropping) for modern `gpt-5` series endpoints.
- Developed word tracking and diffing using `jsdiff` algorithm.
- Localized the entire Application to inclusive German language (e.g. using 'Nicht-Jurist:innen').
- Updated manifest Provider, Application name, and Support URLs to align with the OpenLegalLab GitHub repository.

**Next Steps:**
- Further UI/UX refinement if requested by user.
- Testing on diverse platforms (Word for Mac, Word Online) as needed.
- Expand quick prompt actions or model configurations.

**Active Decisions & Considerations:**
- Removing explicit `temperature` parameters in API calls to allow LLMs their native default behaviors, avoiding litellm `UnsupportedParamsError` with advanced models like gpt-5.2.
- Handling of Word Ranges by explicitly avoiding passing Range objects between asynchronous `Word.run()` contexts, opting to capture diff arrays and passing text.
