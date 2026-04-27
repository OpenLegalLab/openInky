/**
 * Onlinekommentar API client.
 * Translated from Node index.ts to typescript for browser compatibility.
 */

const API_BASE_URL = "https://onlinekommentar.ch/api";

interface Commentary {
  id: string;
  title: string;
  language: string;
  date: string;
  legislative_act: {
    id: string;
    title: string;
  };
  legal_domain?: {
    id: string;
    name: string;
  };
  authors: {
    id: string;
    name: string;
  }[];
  editors?: {
    id: string;
    name: string;
  }[];
  html_link: string;
  content?: string;
}

export async function search_commentaries(args: { 
  search: string; 
  language?: "en" | "de" | "fr" | "it"; 
  legislative_act?: string; 
  sort?: "title" | "-title" | "date" | "-date"; 
  page?: number 
}) {
  const { search, language, legislative_act, sort, page } = args;
  const queryParams = new URLSearchParams();
  
  if (search) queryParams.append("search", search);
  if (language) queryParams.append("language", language);
  if (legislative_act) queryParams.append("legislative_act", legislative_act);
  if (sort) queryParams.append("sort", sort);
  if (page) queryParams.append("page", page.toString());

  try {
    const response = await fetch(`${API_BASE_URL}/commentaries?${queryParams.toString()}`, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = (await response.json()) as { data: Commentary[] };
    const commentaries = data.data;
    
    if (commentaries.length > 0) {
      return commentaries
        .map((c) => `ID: ${c.id}\nTitle: ${c.title}\nDate: ${c.date}\nURL: ${c.html_link}`)
        .join("\n\n");
    }
    
    return "No commentaries found for the given criteria.";
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return `Error searching commentaries: ${errorMessage}`;
  }
}

export async function get_commentary_by_id(args: { id: string }) {
  try {
    const response = await fetch(`${API_BASE_URL}/commentaries/${args.id}`, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return `Commentary with ID '${args.id}' not found.`;
      }
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = (await response.json()) as { data: Commentary };
    const commentary = data.data;

    const authors = commentary.authors.map((a) => a.name).join(", ");
    const editors = commentary.editors ? commentary.editors.map((e) => e.name).join(", ") : "None listed";
    
    const resultText = `
Title: ${commentary.title}
ID: ${commentary.id}
Language: ${commentary.language}
Publication Date: ${commentary.date}
Legislative Act: ${commentary.legislative_act.title}
Legal Domain: ${commentary.legal_domain?.name || "Not specified"}
Authors: ${authors}
Editors: ${editors}
URL: ${commentary.html_link}
Content:
${commentary.content || "Full content not available in summary."}
    `.trim();

    return resultText;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return `Error retrieving commentary: ${errorMessage}`;
  }
}
