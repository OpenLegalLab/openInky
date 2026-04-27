#!/usr/bin/env python3
"""
Fedlex MCP Server — gives Claude access to Swiss federal law.

Tools exposed:
  - search_laws: keyword search across the Classified Compilation
  - get_law_metadata: detailed info about a specific law by ELI URI
  - get_law_text: fetch the actual text of a law (or a specific article)
  - list_amendments: show the version history of a law
  - browse_taxonomy: navigate the SR classification tree

Run with:
  python server.py                    # stdio transport (for Claude Desktop)
  python server.py --transport sse    # SSE transport (for remote/Cowork)
"""

import sys
import json
import logging
from mcp.server.fastmcp import FastMCP

import fedlex_client as fedlex

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

mcp = FastMCP(
    "Fedlex — Swiss Federal Law",
    instructions="""
    This server provides access to Swiss federal law via the Fedlex platform.

    The data comes from two sources:
    1. The SPARQL endpoint at fedlex.data.admin.ch — this contains METADATA
       about laws (titles, dates, SR numbers, taxonomy, amendment history).
    2. The actual law TEXT is fetched as HTML from the Fedlex website and
       can be searched for specific articles.

    Typical workflows:
    - "What laws exist about X?" → use search_laws
    - "Tell me about SR 700" → use get_law_metadata with the ELI URI
    - "What does Art. 49 PBG say?" → use search_laws to find it, then get_law_text
    - "When was this law last amended?" → use list_amendments
    - "What topics does Swiss law cover?" → use browse_taxonomy

    All laws are identified by ELI URIs like:
      https://fedlex.data.admin.ch/eli/cc/1979/1573_1573_1573

    Languages: de (German), fr (French), it (Italian), en (English), rm (Romansh)
    """,
)


@mcp.tool()
def search_laws(
    keyword: str,
    language: str = "de",
    limit: int = 10,
) -> str:
    """
    Search Swiss federal law by keyword in the title.

    Searches the Classified Compilation (Systematische Rechtssammlung) for
    laws whose title contains the given keyword.

    Args:
        keyword: Search term (e.g. "Raumplanung", "Umweltschutz", "Obligationenrecht").
                 Case-insensitive. Searches in the title of the law.
        language: Language for results — "de", "fr", "it", "en", or "rm". Default: "de".
        limit: Maximum number of results. Default: 10.

    Returns:
        JSON list of matching laws with title, URI, date, and Fedlex URL.
        Use the URI with get_law_metadata or get_law_text for more details.
    """
    try:
        results = fedlex.search_laws(keyword, language, limit)
        if not results:
            return json.dumps({
                "count": 0,
                "message": f"No laws found matching '{keyword}'. Try a broader or different keyword.",
            }, ensure_ascii=False, indent=2)
        return json.dumps({
            "count": len(results),
            "results": results,
        }, ensure_ascii=False, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
def get_law_metadata(
    eli_uri: str,
    language: str = "de",
) -> str:
    """
    Get detailed metadata about a specific Swiss federal law.

    Retrieves title, abbreviation, entry-in-force date, in-force status,
    document type, legal taxonomy classification, and a link to Fedlex.

    Args:
        eli_uri: The ELI URI of the law, e.g.
                 "https://fedlex.data.admin.ch/eli/cc/1979/1573_1573_1573"
                 (get this from search_laws results).
        language: Language — "de", "fr", "it", "en", or "rm". Default: "de".

    Returns:
        JSON with the law's metadata.
    """
    try:
        result = fedlex.get_law_metadata(eli_uri, language)
        return json.dumps(result, ensure_ascii=False, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
def get_law_text(
    eli_uri: str,
    article: str = "",
    language: str = "de",
) -> str:
    """
    Fetch the actual text of a Swiss federal law, optionally a specific article.

    This follows the full FRBR chain from the law's metadata to the actual
    HTML document, fetches it, and extracts the requested content.

    Args:
        eli_uri: The ELI URI of the law (from search_laws or get_law_metadata).
        article: Optional article number to extract (e.g. "49", "12a").
                 If empty, returns the beginning of the full text.
        language: Language — "de", "fr", "it", "en", or "rm". Default: "de".

    Returns:
        The text of the law or specific article. For full laws, truncated
        to a reasonable length.
    """
    try:
        # Step 1: Get the URL of the HTML version
        url = fedlex.get_law_text_url(eli_uri, language, "HTML")
        if not url:
            return json.dumps({
                "error": "Could not find HTML version of this law.",
                "hint": "Try the Fedlex website directly.",
                "url": eli_uri.replace(
                    "https://fedlex.data.admin.ch/eli/",
                    "https://www.fedlex.admin.ch/eli/",
                ) + f"/{language}",
            }, ensure_ascii=False, indent=2)

        # Step 2: Fetch the HTML
        html = fedlex.fetch_law_html(url)

        # Step 3: Extract article or return summary
        if article:
            text = fedlex.extract_article_from_html(html, article)
            if text:
                return json.dumps({
                    "uri": eli_uri,
                    "article": article,
                    "language": language,
                    "text": text,
                    "source_url": url,
                }, ensure_ascii=False, indent=2)
            else:
                return json.dumps({
                    "error": f"Article {article} not found in the document.",
                    "hint": "Check the article number. Some laws use different numbering.",
                    "source_url": url,
                }, ensure_ascii=False, indent=2)
        else:
            # Return a truncated version of the full text
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(html, "html.parser")
            text = soup.get_text(separator="\n", strip=True)
            # Limit to ~4000 chars
            if len(text) > 4000:
                text = text[:4000] + "\n\n[... truncated, use 'article' parameter to get specific articles]"

            return json.dumps({
                "uri": eli_uri,
                "language": language,
                "text": text,
                "source_url": url,
            }, ensure_ascii=False, indent=2)

    except Exception as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
def list_amendments(
    eli_uri: str,
    limit: int = 20,
) -> str:
    """
    List the amendment/version history of a Swiss federal law.

    Shows all consolidated versions over time, ordered newest first.

    Args:
        eli_uri: The ELI URI of the law.
        limit: Maximum number of versions to return. Default: 20.

    Returns:
        JSON list of versions with dates.
    """
    try:
        results = fedlex.list_amendments(eli_uri, limit)
        if not results:
            return json.dumps({
                "count": 0,
                "message": "No amendment history found for this law.",
            }, ensure_ascii=False, indent=2)
        return json.dumps({
            "count": len(results),
            "versions": results,
        }, ensure_ascii=False, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
def browse_taxonomy(
    parent_uri: str = "",
    language: str = "de",
) -> str:
    """
    Browse the SR legal taxonomy (classification tree).

    Call without parent_uri to see top-level categories.
    Call with a parent_uri to see subcategories.

    Args:
        parent_uri: URI of the parent taxonomy entry. Empty for top level.
        language: Language — "de", "fr", "it", "en". Default: "de".

    Returns:
        JSON list of taxonomy entries with label and URI.
    """
    try:
        uri = parent_uri if parent_uri else None
        results = fedlex.browse_taxonomy(uri, language)
        return json.dumps({
            "count": len(results),
            "entries": results,
        }, ensure_ascii=False, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)})


if __name__ == "__main__":
    transport = "stdio"
    if "--transport" in sys.argv:
        idx = sys.argv.index("--transport")
        if idx + 1 < len(sys.argv):
            transport = sys.argv[idx + 1]

    if transport == "sse":
        mcp.run(transport="sse")
    else:
        mcp.run(transport="stdio")
