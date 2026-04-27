/**
 * Fedlex SPARQL client — wraps the Fedlex SPARQL endpoint and HTML fetching.
 * Translated from python to typescript for browser compatibility.
 */

const SPARQL_ENDPOINT = "https://fedlex.data.admin.ch/sparqlendpoint";
const FEDLEX_BASE = "https://www.fedlex.admin.ch";

const LANG_MAP: Record<string, string> = {
  de: "DEU",
  fr: "FRA",
  it: "ITA",
  en: "ENG",
  rm: "ROH",
};

async function _sparqlQuery(query: string): Promise<any[]> {
  const url = new URL(SPARQL_ENDPOINT);
  url.searchParams.append("query", query);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/sparql-results+json",
    },
  });

  if (!response.ok) {
    throw new Error(`SPARQL query failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const bindings = data.results?.bindings || [];
  
  return bindings.map((row: any) => {
    const result: any = {};
    for (const [k, v] of Object.entries(row)) {
      result[k] = (v as any).value;
    }
    return result;
  });
}

export async function search_laws(args: { keyword: string; language?: string; limit?: number }) {
  const { keyword, language = "de", limit = 10 } = args;
  const lang_code = LANG_MAP[language] || "DEU";
  const keyword_lower = keyword.toLowerCase();

  const query = `
    PREFIX jolux: <http://data.legilux.public.lu/resource/ontology/jolux#>
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    SELECT DISTINCT ?consolidation ?title ?date ?taxonomy ?taxonomyLabel WHERE {
        ?consolidation a jolux:ConsolidationAbstract;
            jolux:isRealizedBy ?expression;
            jolux:dateEntryInForce ?date.
        ?expression jolux:language <http://publications.europa.eu/resource/authority/language/${lang_code}>;
                    jolux:title ?title.
        OPTIONAL {
            ?consolidation jolux:classifiedByTaxonomyEntry ?taxonomy.
            ?taxonomy skos:prefLabel ?taxonomyLabel.
            FILTER(LANG(?taxonomyLabel) = "${language}")
        }
        FILTER(CONTAINS(LCASE(?title), "${keyword_lower}"))
    }
    ORDER BY ?title
    LIMIT ${limit}
  `;

  const rows = await _sparqlQuery(query);

  return rows.map((row) => {
    const uri = row.consolidation;
    const url = uri.replace("https://fedlex.data.admin.ch/eli/", `${FEDLEX_BASE}/eli/`);
    const sr_path = uri.replace("https://fedlex.data.admin.ch/eli/cc/", "");

    return {
      uri,
      title: row.title,
      sr_path,
      date_in_force: row.date || "",
      taxonomy: row.taxonomyLabel || "",
      url: `${url}/${language}`,
    };
  });
}

export async function get_law_metadata(args: { eli_uri: string; language?: string }) {
  const { eli_uri, language = "de" } = args;
  const lang_code = LANG_MAP[language] || "DEU";

  const query = `
    PREFIX jolux: <http://data.legilux.public.lu/resource/ontology/jolux#>
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    SELECT ?title ?abbreviation ?dateInForce ?dateNoLonger ?status ?statusLabel
           ?taxonomy ?taxonomyLabel ?docType ?docTypeLabel WHERE {
        <${eli_uri}> a jolux:ConsolidationAbstract;
            jolux:isRealizedBy ?expression.
        ?expression jolux:language <http://publications.europa.eu/resource/authority/language/${lang_code}>;
                    jolux:title ?title.
        OPTIONAL { ?expression jolux:titleShort ?abbreviation. }
        OPTIONAL { <${eli_uri}> jolux:dateEntryInForce ?dateInForce. }
        OPTIONAL { <${eli_uri}> jolux:dateNoLongerInForce ?dateNoLonger. }
        OPTIONAL {
            <${eli_uri}> jolux:inForceStatus ?status.
            ?status skos:prefLabel ?statusLabel.
            FILTER(LANG(?statusLabel) = "${language}")
        }
        OPTIONAL {
            <${eli_uri}> jolux:classifiedByTaxonomyEntry ?taxonomy.
            ?taxonomy skos:prefLabel ?taxonomyLabel.
            FILTER(LANG(?taxonomyLabel) = "${language}")
        }
        OPTIONAL {
            <${eli_uri}> jolux:typeDocument ?docType.
            ?docType skos:prefLabel ?docTypeLabel.
            FILTER(LANG(?docTypeLabel) = "${language}")
        }
    }
    LIMIT 1
  `;

  const rows = await _sparqlQuery(query);
  if (rows.length === 0) {
    return { error: `No law found for URI: ${eli_uri}` };
  }

  const row = rows[0];
  const url = eli_uri.replace("https://fedlex.data.admin.ch/eli/", `${FEDLEX_BASE}/eli/`);

  return {
    uri: eli_uri,
    title: row.title || "",
    abbreviation: row.abbreviation || "",
    date_in_force: row.dateInForce || "",
    date_no_longer_in_force: row.dateNoLonger || "",
    in_force_status: row.statusLabel || "",
    document_type: row.docTypeLabel || "",
    taxonomy: row.taxonomyLabel || "",
    url: `${url}/${language}`,
  };
}

export async function get_law_text_url(args: { eli_uri: string; language?: string; file_format?: string }) {
  const { eli_uri, language = "de", file_format = "HTML" } = args;
  const lang_code = LANG_MAP[language] || "DEU";
  const format_uri = `http://publications.europa.eu/resource/authority/file-type/${file_format}`;

  const query = `
    PREFIX jolux: <http://data.legilux.public.lu/resource/ontology/jolux#>
    SELECT ?url ?date WHERE {
        ?consolidation jolux:isMemberOf <${eli_uri}>;
            jolux:dateApplicability ?date;
            jolux:isRealizedBy ?expression.
        ?expression jolux:language <http://publications.europa.eu/resource/authority/language/${lang_code}>;
                    jolux:isEmbodiedBy ?manifestation.
        ?manifestation jolux:format <${format_uri}>;
                       jolux:isExemplifiedBy ?url.
    }
    ORDER BY DESC(?date)
    LIMIT 1
  `;

  const rows = await _sparqlQuery(query);
  if (rows.length > 0) {
    return { url: rows[0].url };
  }
  return { url: null };
}

export async function get_law_text(args: { eli_uri: string; language?: string; article_number?: string }) {
  const urlResult = await get_law_text_url(args);
  if (!urlResult.url) {
    return { error: "Could not find HTML text URL for the specified law." };
  }

  const response = await fetch(urlResult.url, {
    headers: { Accept: "text/html", "User-Agent": "FedlexMCP/1.0" },
  });

  if (!response.ok) {
    return { error: `Failed to fetch law text from ${urlResult.url}: ${response.statusText}` };
  }

  const html = await response.text();

  if (args.article_number) {
    const articleText = extract_article_from_html(html, args.article_number);
    if (articleText) {
      return { text: articleText };
    }
    return { error: `Article ${args.article_number} not found in the text.` };
  }

  // Without DOMParser (which might be heavy or block UI thread for huge HTML), 
  // just return text stripped of tags, or just truncate it, but typically we want article.
  // We'll strip HTML tags natively.
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = html;
  const text = tempDiv.textContent || tempDiv.innerText || "";
  return { text: text.substring(0, 15000) }; // truncate to avoid massive responses
}

function extract_article_from_html(html: string, article_number: string): string | null {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  
  const art_num = article_number.trim().replace(/\.$/, "");
  
  // Strategy 1: Look for id attributes
  const patterns = [`art_${art_num}`, `art${art_num}`, `a${art_num}`];
  for (const pattern of patterns) {
    let el = doc.getElementById(pattern) || doc.querySelector(`[data-article="${art_num}"]`);
    if (el) {
      return el.textContent?.trim() || null;
    }
  }

  // Fallback Regex
  const pattern = new RegExp(`(Art\\.?\\s*${art_num}\\b.*?)(?=Art\\.?\\s*\\d+\\b|$)`, "is");
  const match = html.match(pattern);
  if (match) {
    let text = match[1].replace(/<[^>]+>/g, " ");
    text = text.replace(/\\s+/g, " ").trim();
    return text.substring(0, 3000);
  }

  return null;
}

export async function list_amendments(args: { eli_uri: string; limit?: number }) {
  const { eli_uri, limit = 20 } = args;
  const query = `
    PREFIX jolux: <http://data.legilux.public.lu/resource/ontology/jolux#>
    SELECT ?consolidation ?dateApplicability ?publicationDate WHERE {
        ?consolidation jolux:isMemberOf <${eli_uri}>;
            jolux:dateApplicability ?dateApplicability.
        OPTIONAL { ?consolidation jolux:publicationDate ?publicationDate. }
    }
    ORDER BY DESC(?dateApplicability)
    LIMIT ${limit}
  `;

  const rows = await _sparqlQuery(query);
  return rows.map((row) => ({
    consolidation_uri: row.consolidation,
    date_applicable: row.dateApplicability,
    date_published: row.publicationDate || "",
  }));
}

export async function browse_taxonomy(args: { parent_uri?: string; language?: string }) {
  const { parent_uri, language = "de" } = args;

  let query = "";
  if (parent_uri) {
    query = `
      PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
      SELECT ?entry ?label ?notation WHERE {
          ?entry skos:broader <${parent_uri}>;
                 skos:prefLabel ?label.
          OPTIONAL { ?entry skos:notation ?notation. }
          FILTER(LANG(?label) = "${language}")
      }
      ORDER BY ?notation
    `;
  } else {
    query = `
      PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
      PREFIX jolux: <http://data.legilux.public.lu/resource/ontology/jolux#>
      SELECT ?entry ?label ?notation WHERE {
          ?entry a skos:Concept;
                 skos:inScheme <https://fedlex.data.admin.ch/vocabulary/legal-taxonomy>;
                 skos:prefLabel ?label.
          FILTER NOT EXISTS { ?entry skos:broader ?parent. }
          OPTIONAL { ?entry skos:notation ?notation. }
          FILTER(LANG(?label) = "${language}")
      }
      ORDER BY ?notation
    `;
  }

  const rows = await _sparqlQuery(query);
  return rows.map((row) => ({
    uri: row.entry,
    label: row.label,
    notation: row.notation || "",
  }));
}
