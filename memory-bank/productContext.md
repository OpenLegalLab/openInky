# Product Context

**Why this project exists:**
OpenInky exists to provide a specialized AI writing and editing assistant right inside Microsoft Word, specifically catering to legal professionals (though usable by anyone). Many AI tools blindly replace text without highlighting what actually changed. OpenInky solves this by using Word's native Track Changes, making AI suggestions transparent and easy to accept or reject.

**Problems it solves:**
- Disconnect between AI web interfaces and where users actually write (Microsoft Word).
- Loss of edit transparency when AI replaces chunks of text.
- The need for rapid text adjustments tailored to legal contexts (simplifying, formalizing, spell-checking, checking legal terminology).

**How it should work:**
A sidebar Task Pane opens in Microsoft Word. Users select text in their document, click quick-action prompt buttons or write their own instruction, and the AI processes the request. The add-in then computes the exact differences and inserts them back into the document with Track Changes enabled, showing clear insertions and deletions.

**User experience goals:**
- Seamless integration with Microsoft Word (no context switching).
- High transparency through Track Changes.
- Professional, inclusive, and intuitive German UI.
- Easy to configure and self-host or use with custom LLM endpoints.
