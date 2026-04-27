# Progress

**What works:**
- Internal deployment manifest (`manifest.ll.xml`) configurable via `SourceLocation` query parameters.
- Live demo deployment available at `https://openinky.raxal.io` with `manifest.demo.xml`.
- Fully scaffolded React-based Word Add-in using Fluent UI.
- Secure, customizable LLM Endpoint interaction service configured for local caching.
- Diff generation logic using `jsdiff.diffWords` reliably identifies granular text changes.
- Integration with Word `ChangeTrackingMode` perfectly applies granular redlines back into the active document.
- User Interface fully translated and localized to gender-inclusive German terminology ("OpenInky", "Einstellungen", "Für Nicht-Jurist:innen").
- Manifest correctly aligned with OpenLegalLab branding and repository paths.

**What's left to build:**
- Further edge-case handling if the user selects complex formatting (e.g. bolding/italics/hyperlinks) that could be disrupted during paragraph reconstruction.
- Implement additional models or specific custom system prompts globally configurable in Settings.

**Current Status:**
- Integration is functional. E2E testing completed dynamically via Sideloading.
- Support added for initial configuration via `window.location.search` URL parameters.

**Evolution of Project Decisions:**
- Add-in moved away from hardcoded temperature parameters to handle LLM specific nuances gracefully.
- Explicitly swapped Fluent UI references to rely on v8 Stack components ensuring rapid iteration rather than fully migrating to Fluent UI v9 structure immediately.
- Changed focus from a generic placeholder "Contoso" / "WordPlugin" structure directly into the branded "OpenInky" representing OpenLegalLab initiatives.
