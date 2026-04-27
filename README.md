# OpenInky

**OpenInky** is an open-source Microsoft Word Add-in with a React-based sidebar AI assistant, primarily tailored for legal professionals and everyday writers. This was developed as a stealth fun project during the **OpenLegalLab 2026**.

## Features
- **Context-Aware AI Assistant:** Highlight a specific portion of text, or leave your selection empty to process the entire document. The AI will strictly follow your custom or quick-action prompts to improve, simplify, or format the designated text.
- **Native Track Changes Integration:** OpenInky uses word-level differencing (`jsdiff`) to compute precise modifications. Unlike standard AI tools that blindly replace large blocks of text, OpenInky inserts human-like redlines back into your document via Word's native Track Changes API.
- **Customizable LLM Endpoints:** Seamlessly connect OpenInky to any OpenAI-compatible API endpoint directly from the settings pane. 

## Setup & Local Development

This project was scaffolded using the `yo office` React template and customized as a single-host Word Add-in. 

### Prerequisites
- Node.js (v16 to v20 recommended)
- Microsoft Word (Desktop or Online)

### Running Locally
1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Start the local development server:
   ```bash
   npm start
   ```
   This command will automatically spin up a local HTTPS server (on port 3000), sideload the add-in manifest into Microsoft Word, and open the application.

## LLM Configuration

OpenInky does not lock you into a specific AI provider. You can securely configure your connection locally in the application:
1. Open the **OpenInky Add-in** in Word.
2. Click the gear icon to open **Settings**.
3. Provide your:
   - **Base URL** (e.g., `https://api.openai.com/v1`)
   - **API Key**
   - **Model Name** (e.g., `gpt-5.2-turbo`, `llama-3`)
4. Click **Save**. These settings are cached locally in your browser's local storage.
(we use LiteLLM to expose a unified OpenAI-compatible endpoint)

## Deployment

Deploying a Microsoft Office Add-in requires two separate components: hosting the Web Application and distributing the `manifest.xml`.

### 1. Build and Host the Web App
You need to host the compiled static assets on an HTTPS-enabled server (such as GitHub Pages, Vercel, Netlify, or Azure Static Web Apps).

1. Open `webpack.config.js` and locate the `urlProd` variable.
2. Update `urlProd` to the URL where you plan to host the app (e.g., `https://openlegallab.github.io/openInky/`).
3. Build the production application:
   ```bash
   npm run build
   ```
4. Upload the contents of the generated `dist` folder to your chosen hosting provider.

### 2. Distribute the Manifest

Once your web application is live, you must distribute the `manifest.xml` file located in the `dist` folder (the build process automatically replaces local `https://localhost:3000` URLs with your `urlProd` production URL inside this file).

**For Individual Use (Sideloading):**
- Place the `manifest.xml` in a shared network folder.
- In Word, navigate to **File > Options > Trust Center > Trust Center Settings > Trusted Add-in Catalogs**.
- Add the network folder URL and check "Show in Menu".
- Restart Word, go to **Insert > Get Add-ins > Shared Folder**, and select OpenInky.
- *(Alternatively, upload it directly using Word on the Web).*

**For Organization-Wide Use:**
- A Microsoft 365 Admin can navigate to the [Microsoft 365 Admin Center](https://admin.microsoft.com/).
- Go to **Settings > Integrated Apps**.
- Click **Upload custom apps** and select the `manifest.xml`.
- Deploy it to specific users, groups, or the entire organization.

## Contributing
We welcome improvements! See the `TODO.md` file for an outline of upcoming tasks, known bugs, and requested features. 

## Try the Demo

You can try OpenInky without setting up a local development environment! We have hosted a live version at `https://openinky.raxal.io`.

**How to install the demo:**
1. Download the [`manifest.demo.xml`](manifest.demo.xml) file from this repository.
2. Sideload it into Microsoft Word:
   - **Word on the Web:** Go to Insert > Add-ins > Manage My Add-ins > Upload My Add-in, and select the downloaded file.
   - **Word Desktop (Windows):** Create a shared network folder, place the XML file there, and add the folder path to **Trust Center > Trusted Add-in Catalogs**. Then go to Insert > Get Add-ins > Shared Folder.
   - **Mac:** Place the file in `/Users/<username>/Library/Containers/com.microsoft.Word/Data/Documents/wef`.

## Changelog

### v0.2.1.0
- **Live Demo Deployment:** Added `manifest.demo.xml` to easily test the hosted version at `https://openinky.raxal.io`.
- Added an `index.html` redirect to the GitHub repository.

### v0.2.0
- **Native Tools Support:** Direct API integration with Fedlex and Onlinekommentar to search and fetch legal data.
- **External MCP Server Support:** Configurable dynamically loaded tools from external MCP servers via SSE (Server-Sent Events) transports (e.g., Entscheidsuche).
- **Anti-Hallucination Features:** Improved LLM system prompts directing the AI not to invent results if an API search fails or returns zero matches.
- **Full Source Transparency:** Verwendete Tools UI clearly shows the raw, un-truncated retrieved content for full accountability.
- **API UI Toggles:** Easily turn Fedlex, Onlinekommentar, and External MCP servers on or off directly from the main task pane.

## License
Licensed under the No-Resale Source Licence – see LICENSE.md.

## Acknowledgements
This project incorporates tool logic translated from the following open-source projects:
- **Fedlex MCP Client**: Provides SPARQL querying and HTML extraction for Swiss federal laws.
- **Onlinekommentar MCP**: Provides API integration for searching and retrieving Swiss legal commentaries.
