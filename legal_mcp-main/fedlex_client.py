"""
Fedlex SPARQL client — wraps the Fedlex SPARQL endpoint and HTML fetching.

The Fedlex API is a two-layer system:
  1. SPARQL endpoint (https://fedlex.data.admin.ch/sparqlendpoint)
     → returns METADATA: which laws exist, their titles, SR numbers,
       dates, taxonomy, relationships between acts, amendment history.
     → does NOT contain the actual law text.

  2. The law text itself lives as HTML/PDF/XML files linked from the metadata.
     → you follow the chain: ConsolidationAbstract → Consolidation → Expression → Manifestation → URL
     → then HTTP GET that URL to get the actual text.

This client handles both layers.
"""

import re
import logging
from typing import Optional
from SPARQLWrapper import SPARQLWrapper, JSON
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError

logger = logging.getLogger(__name__)

SPARQL_ENDPOINT = "https://fedlex.data.admin.ch/sparqlendpoint"
FEDLEX_BASE = "https://www.fedlex.admin.ch"

LANG_MAP = {
    "de": "DEU",
    "fr": "FRA",
    "it": "ITA",
    "en": "ENG",
    "rm": "ROH",
}


def _sparql_query(query: str) -> list[dict]:
    """Execute a SPARQL query and return results as list of dicts."""
    sparql = SPARQLWrapper(SPARQL_ENDPOINT)
    sparql.setReturnFormat(JSON)
    sparql.setQuery(query)
    sparql.addCustomHttpHeader("Accept", "application/sparql-results+json")

    try:
        response = sparql.query().convert()
    except (URLError, HTTPError) as e:
        logger.error(f"SPARQL query failed: {e}")
        raise RuntimeError(f"Failed to query Fedlex SPARQL endpoint: {e}")

    bindings = response.get("results", {}).get("bindings", [])
    results = []
    for row in bindings:
        results.append({k: v["value"] for k, v in row.items()})
    return results


def search_laws(
    keyword: str,
    language: str = "de",
    limit: int = 10,
) -> list[dict]:
    """
    Search the Classified Compilation for laws matching a keyword in the title.

    This queries the SPARQL endpoint for jolux:ConsolidationAbstract entries
    whose title contains the keyword.

    Returns: list of dicts with keys:
        - uri: the Fedlex ELI URI (e.g. https://fedlex.data.admin.ch/eli/cc/1979/1573_1573_1573)
        - title: the law title in the requested language
        - sr_number: the SR classification number (if available)
        - date_in_force: date the law entered into force
        - url: link to the Fedlex website
    """
    lang_code = LANG_MAP.get(language, "DEU")
    keyword_lower = keyword.lower()

    query = f"""
    PREFIX jolux: <http://data.legilux.public.lu/resource/ontology/jolux#>
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    SELECT DISTINCT ?consolidation ?title ?date ?taxonomy ?taxonomyLabel WHERE {{
        ?consolidation a jolux:ConsolidationAbstract;
            jolux:isRealizedBy ?expression;
            jolux:dateEntryInForce ?date.
        ?expression jolux:language <http://publications.europa.eu/resource/authority/language/{lang_code}>;
                    jolux:title ?title.
        OPTIONAL {{
            ?consolidation jolux:classifiedByTaxonomyEntry ?taxonomy.
            ?taxonomy skos:prefLabel ?taxonomyLabel.
            FILTER(LANG(?taxonomyLabel) = "{language}")
        }}
        FILTER(CONTAINS(LCASE(?title), "{keyword_lower}"))
    }}
    ORDER BY ?title
    LIMIT {limit}
    """

    rows = _sparql_query(query)

    results = []
    for row in rows:
        uri = row["consolidation"]
        # Convert data URI to website URL
        url = uri.replace("https://fedlex.data.admin.ch/eli/", f"{FEDLEX_BASE}/eli/")
        # Extract SR-like path from URI
        sr_path = uri.replace("https://fedlex.data.admin.ch/eli/cc/", "")

        results.append({
            "uri": uri,
            "title": row["title"],
            "sr_path": sr_path,
            "date_in_force": row.get("date"),
            "taxonomy": row.get("taxonomyLabel", ""),
            "url": f"{url}/{language}",
        })

    return results


def get_law_metadata(eli_uri: str, language: str = "de") -> dict:
    """
    Get detailed metadata for a specific law by its ELI URI.

    Returns title, abbreviation, dates, in-force status, taxonomy, and
    links to the current consolidated version.
    """
    lang_code = LANG_MAP.get(language, "DEU")

    query = f"""
    PREFIX jolux: <http://data.legilux.public.lu/resource/ontology/jolux#>
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    SELECT ?title ?abbreviation ?dateInForce ?dateNoLonger ?status ?statusLabel
           ?taxonomy ?taxonomyLabel ?docType ?docTypeLabel WHERE {{
        <{eli_uri}> a jolux:ConsolidationAbstract;
            jolux:isRealizedBy ?expression.
        ?expression jolux:language <http://publications.europa.eu/resource/authority/language/{lang_code}>;
                    jolux:title ?title.
        OPTIONAL {{ ?expression jolux:titleShort ?abbreviation. }}
        OPTIONAL {{ <{eli_uri}> jolux:dateEntryInForce ?dateInForce. }}
        OPTIONAL {{ <{eli_uri}> jolux:dateNoLongerInForce ?dateNoLonger. }}
        OPTIONAL {{
            <{eli_uri}> jolux:inForceStatus ?status.
            ?status skos:prefLabel ?statusLabel.
            FILTER(LANG(?statusLabel) = "{language}")
        }}
        OPTIONAL {{
            <{eli_uri}> jolux:classifiedByTaxonomyEntry ?taxonomy.
            ?taxonomy skos:prefLabel ?taxonomyLabel.
            FILTER(LANG(?taxonomyLabel) = "{language}")
        }}
        OPTIONAL {{
            <{eli_uri}> jolux:typeDocument ?docType.
            ?docType skos:prefLabel ?docTypeLabel.
            FILTER(LANG(?docTypeLabel) = "{language}")
        }}
    }}
    LIMIT 1
    """

    rows = _sparql_query(query)
    if not rows:
        return {"error": f"No law found for URI: {eli_uri}"}

    row = rows[0]
    url = eli_uri.replace("https://fedlex.data.admin.ch/eli/", f"{FEDLEX_BASE}/eli/")

    return {
        "uri": eli_uri,
        "title": row.get("title", ""),
        "abbreviation": row.get("abbreviation", ""),
        "date_in_force": row.get("dateInForce", ""),
        "date_no_longer_in_force": row.get("dateNoLonger", ""),
        "in_force_status": row.get("statusLabel", ""),
        "document_type": row.get("docTypeLabel", ""),
        "taxonomy": row.get("taxonomyLabel", ""),
        "url": f"{url}/{language}",
    }


def get_law_text_url(
    eli_uri: str,
    language: str = "de",
    file_format: str = "HTML",
) -> Optional[str]:
    """
    Follow the FRBR chain from a ConsolidationAbstract to the actual
    document URL for the latest consolidated version.

    Chain: ConsolidationAbstract → Consolidation (latest by date)
           → Expression (in requested language)
           → Manifestation (in requested format)
           → URL (the actual file)
    """
    lang_code = LANG_MAP.get(language, "DEU")
    format_uri = f"http://publications.europa.eu/resource/authority/file-type/{file_format}"

    query = f"""
    PREFIX jolux: <http://data.legilux.public.lu/resource/ontology/jolux#>
    SELECT ?url ?date WHERE {{
        ?consolidation jolux:isMemberOf <{eli_uri}>;
            jolux:dateApplicability ?date;
            jolux:isRealizedBy ?expression.
        ?expression jolux:language <http://publications.europa.eu/resource/authority/language/{lang_code}>;
                    jolux:isEmbodiedBy ?manifestation.
        ?manifestation jolux:format <{format_uri}>;
                       jolux:isExemplifiedBy ?url.
    }}
    ORDER BY DESC(?date)
    LIMIT 1
    """

    rows = _sparql_query(query)
    if rows:
        return rows[0]["url"]
    return None


def fetch_law_html(url: str) -> str:
    """Fetch the HTML content of a law from its URL."""
    req = Request(url, headers={"Accept": "text/html", "User-Agent": "FedlexMCP/1.0"})
    try:
        with urlopen(req, timeout=30) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except (URLError, HTTPError) as e:
        raise RuntimeError(f"Failed to fetch law text from {url}: {e}")


def extract_article_from_html(html: str, article_number: str) -> Optional[str]:
    """
    Extract a specific article from the Fedlex HTML.

    Fedlex uses Akoma Ntoso XML rendered as HTML. Articles are typically
    in elements with id attributes like "art_1" or data attributes.
    This is a best-effort extraction.
    """
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        # Fallback: regex-based extraction
        return _extract_article_regex(html, article_number)

    soup = BeautifulSoup(html, "html.parser")

    # Normalize article number: "49" → various patterns
    art_num = article_number.strip().rstrip(".")

    # Strategy 1: Look for id attributes containing the article number
    for pattern in [f"art_{art_num}", f"art{art_num}", f"a{art_num}"]:
        el = soup.find(id=pattern) or soup.find(attrs={"data-article": art_num})
        if el:
            return el.get_text(separator="\n", strip=True)

    # Strategy 2: Look for headings like "Art. 49" and grab the following content
    for heading in soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "div"]):
        text = heading.get_text(strip=True)
        if re.search(rf'\bArt\.?\s*{re.escape(art_num)}\b', text):
            # Collect this element and siblings until the next article
            parts = [heading.get_text(separator="\n", strip=True)]
            for sib in heading.find_next_siblings():
                sib_text = sib.get_text(strip=True)
                if re.search(r'\bArt\.?\s*\d+', sib_text) and not re.search(
                    rf'\bArt\.?\s*{re.escape(art_num)}\b', sib_text
                ):
                    break
                parts.append(sib.get_text(separator="\n", strip=True))
            return "\n".join(parts)

    return None


def _extract_article_regex(html: str, article_number: str) -> Optional[str]:
    """Fallback regex-based article extraction."""
    art_num = article_number.strip().rstrip(".")
    pattern = rf'(Art\.?\s*{re.escape(art_num)}\b.*?)(?=Art\.?\s*\d+\b|$)'
    match = re.search(pattern, html, re.DOTALL | re.IGNORECASE)
    if match:
        # Clean HTML tags
        text = re.sub(r'<[^>]+>', ' ', match.group(1))
        text = re.sub(r'\s+', ' ', text).strip()
        return text[:3000]  # Limit length
    return None


def list_amendments(eli_uri: str, limit: int = 20) -> list[dict]:
    """
    List the amendment history of a law — i.e. all the different
    consolidated versions over time.
    """
    query = f"""
    PREFIX jolux: <http://data.legilux.public.lu/resource/ontology/jolux#>
    SELECT ?consolidation ?dateApplicability ?publicationDate WHERE {{
        ?consolidation jolux:isMemberOf <{eli_uri}>;
            jolux:dateApplicability ?dateApplicability.
        OPTIONAL {{ ?consolidation jolux:publicationDate ?publicationDate. }}
    }}
    ORDER BY DESC(?dateApplicability)
    LIMIT {limit}
    """

    rows = _sparql_query(query)
    return [
        {
            "consolidation_uri": row["consolidation"],
            "date_applicable": row["dateApplicability"],
            "date_published": row.get("publicationDate", ""),
        }
        for row in rows
    ]


def browse_taxonomy(parent_uri: Optional[str] = None, language: str = "de") -> list[dict]:
    """
    Browse the legal taxonomy tree (SR classification).

    If parent_uri is None, returns the top-level categories.
    Otherwise returns children of the given taxonomy entry.
    """
    if parent_uri:
        query = f"""
        PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
        SELECT ?entry ?label ?notation WHERE {{
            ?entry skos:broader <{parent_uri}>;
                   skos:prefLabel ?label.
            OPTIONAL {{ ?entry skos:notation ?notation. }}
            FILTER(LANG(?label) = "{language}")
        }}
        ORDER BY ?notation
        """
    else:
        query = f"""
        PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
        PREFIX jolux: <http://data.legilux.public.lu/resource/ontology/jolux#>
        SELECT ?entry ?label ?notation WHERE {{
            ?entry a skos:Concept;
                   skos:inScheme <https://fedlex.data.admin.ch/vocabulary/legal-taxonomy>;
                   skos:prefLabel ?label.
            FILTER NOT EXISTS {{ ?entry skos:broader ?parent. }}
            OPTIONAL {{ ?entry skos:notation ?notation. }}
            FILTER(LANG(?label) = "{language}")
        }}
        ORDER BY ?notation
        """

    rows = _sparql_query(query)
    return [
        {
            "uri": row["entry"],
            "label": row["label"],
            "notation": row.get("notation", ""),
        }
        for row in rows
    ]
