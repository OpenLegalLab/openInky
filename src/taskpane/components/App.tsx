import * as React from "react";
import { DefaultButton, PrimaryButton, TextField, Spinner, Stack, Text, MessageBar, MessageBarType, Toggle, Dropdown, IDropdownOption } from "@fluentui/react";
import { fetchCompletion, LLMConfig } from "../../services/llmService";
import { computeWordDiff } from "../../services/diffService";
import { getTargetText, applyTrackedChanges } from "../../services/wordService";
import { Settings } from "./Settings";

const DEFAULT_CONFIG: LLMConfig = {
  baseUrl: "https://llm.endpoint.ch",
  apiKey: "",
  model: "gpt-5.2-chat",
  mcpServers: ["https://mcp.entscheidsuche.ch/mcp"],
};

export const App: React.FC = () => {
  const [config, setConfig] = React.useState<LLMConfig>(DEFAULT_CONFIG);
  const [prompt, setPrompt] = React.useState<string>("Diesen Text im Hinblick auf Klarheit und einen professionellen Tonfall verbessern.");
  const [isProcessing, setIsProcessing] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | undefined>();
  const [showSettings, setShowSettings] = React.useState<boolean>(false);
  const [toolLogs, setToolLogs] = React.useState<{name: string, args: string, result: string, source: string}[]>([]);
  const [enableFedlex, setEnableFedlex] = React.useState<boolean>(false);
  const [enableOnlinekommentar, setEnableOnlinekommentar] = React.useState<boolean>(false);
  const [enableMcpServers, setEnableMcpServers] = React.useState<boolean>(false);
  
  React.useEffect(() => {
    const savedConfig = localStorage.getItem("llmConfig");
    if (savedConfig) {
      try {
        setConfig(JSON.parse(savedConfig));
      } catch (e) {
        console.error("Failed to parse config", e);
      }
    }
  }, []);

  const handleSaveConfig = (newConfig: LLMConfig) => {
    setConfig(newConfig);
    localStorage.setItem("llmConfig", JSON.stringify(newConfig));
    setShowSettings(false);
  };

  const handleImproveText = async () => {
    if (!config.apiKey) {
      setError("Bitte konfigurieren Sie Ihren API-Schlüssel in den Einstellungen.");
      return;
    }

    setIsProcessing(true);
    setError(undefined);
    setToolLogs([]);

    try {
      const originalText = await getTargetText();
      
      if (!originalText || originalText.trim() === "") {
        setError("Kein Text ausgewählt oder im Dokument gefunden.");
        setIsProcessing(false);
        return;
      }

      const currentConfig = {
        ...config,
        enableFedlex,
        enableOnlinekommentar,
        mcpServers: enableMcpServers ? config.mcpServers : []
      };

      const modifiedText = await fetchCompletion(currentConfig, [
        { role: "system", content: "Du bist ein hilfreicher juristischer Assistent, der Texte basierend auf den Anweisungen des Benutzers verbessert. WICHTIG: Wenn du Tools verwendest, um nach Informationen zu suchen, und diese keine Ergebnisse liefern oder fehlschlagen, DARFST DU KEINE FAKTEN ERFINDEN. Du musst dem Benutzer mitteilen, dass keine Informationen gefunden wurden. Stütze dich ausschließlich auf die abgerufenen Fakten. Gib am Ende AUSSCHLIESSLICH den verbesserten Text aus, ohne Anführungszeichen oder Füllwörter." },
        { role: "user", content: `Anweisung: ${prompt}\n\nText:\n${originalText}` }
      ], (toolName, args, result, source) => {
        setToolLogs(prev => [...prev, { name: toolName, args, result, source }]);
      });

      const diffChunks = computeWordDiff(originalText, modifiedText);
      await applyTrackedChanges(diffChunks);

    } catch (err: any) {
      console.error("AI Assistant Error:", err);
      setError(err.message || "Ein unbekannter Fehler ist aufgetreten.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (showSettings) {
    return <Settings config={config} onSave={handleSaveConfig} onCancel={() => setShowSettings(false)} />;
  }

  return (
    <Stack tokens={{ childrenGap: 15 }} styles={{ root: { padding: 20 } }}>
      <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
        <Text variant="xLarge" styles={{ root: { fontWeight: "bold" } }}>OpenInky</Text>
        <DefaultButton text="Einstellungen" iconProps={{ iconName: "Settings" }} onClick={() => setShowSettings(true)} title="Einstellungen" />
      </Stack>

      <TextField 
        label="Anweisung" 
        multiline 
        rows={4} 
        value={prompt} 
        onChange={(_e, newValue) => setPrompt(newValue || "")} 
        placeholder="Hier kannst du deinen eigenen Prompt eingeben..."
      />

      <Stack tokens={{ childrenGap: 5 }}>
        <Text variant="mediumPlus" styles={{ root: { fontWeight: "bold" } }}>Datenquellen & APIs aktivieren</Text>
        <Stack horizontal wrap tokens={{ childrenGap: 20 }}>
          <Toggle 
            label="Fedlex API" 
            inlineLabel
            checked={enableFedlex} 
            onChange={(_e: any, checked?: boolean) => setEnableFedlex(!!checked)} 
          />
          <Toggle 
            label="Onlinekommentar API" 
            inlineLabel
            checked={enableOnlinekommentar} 
            onChange={(_e: any, checked?: boolean) => setEnableOnlinekommentar(!!checked)} 
          />
          <Toggle 
            label="Externe MCP Server" 
            inlineLabel
            checked={enableMcpServers} 
            onChange={(_e: any, checked?: boolean) => setEnableMcpServers(!!checked)} 
          />
        </Stack>
      </Stack>

      <Stack horizontal wrap tokens={{ childrenGap: 5 }}>
        <DefaultButton 
          styles={{ root: { fontSize: 12, height: 24 } }} 
          text="Für Nicht-Jurist:innen vereinfachen" 
          onClick={() => setPrompt("Vereinfachen diesen Text für Nicht-Jurist:innen.")} 
        />
        <DefaultButton 
          styles={{ root: { fontSize: 12, height: 24 } }} 
          text="Formeller formulieren" 
          onClick={() => setPrompt("Schreibe es um und mache den Tonfall formeller und professioneller.")} 
        />
        <DefaultButton 
          styles={{ root: { fontSize: 12, height: 24 } }} 
          text="Auf Rechtschreibung prüfen" 
          onClick={() => setPrompt("Bitte korrigiere die Grammatik und verbessern die Lesbarkeit. Vermeide Passiv-Konstruktionen und Schachtelsätze")} 
        />
        <DefaultButton 
          styles={{ root: { fontSize: 12, height: 24 } }} 
          text="Juristische Terminologie prüfen" 
          onClick={() => setPrompt("Stelle sicher, dass die juristische Terminologie konsistent ist.")} 
        />
      </Stack>

      {error && (
        <MessageBar messageBarType={MessageBarType.error} isMultiline={true} onDismiss={() => setError(undefined)}>
          {error}
        </MessageBar>
      )}

      {isProcessing ? (
        <Spinner label="OpenInky wurstelt..." />
      ) : (
        <PrimaryButton 
          text="Ausgewählten Text verbessern" 
          onClick={handleImproveText} 
          iconProps={{ iconName: "Robot" }}
        />
      )}

      {toolLogs.length > 0 && (
        <Stack tokens={{ childrenGap: 10 }} styles={{ root: { marginTop: 20, padding: 15, backgroundColor: "#f3f2f1" } }}>
          <Text variant="large" styles={{ root: { fontWeight: "bold" } }}>Verwendete Tools (Quellen):</Text>
          {toolLogs.map((log, i) => (
            <Stack key={i} tokens={{ childrenGap: 5 }} styles={{ root: { borderBottom: "1px solid #ccc", paddingBottom: 10 } }}>
              <Text variant="mediumPlus" styles={{ root: { fontWeight: "bold" } }}>{log.name} <span style={{ fontWeight: 'normal', color: '#666', fontSize: '0.8em' }}>({log.source})</span></Text>
              <Text variant="small" styles={{ root: { color: "#666" } }}>Argumente: {log.args}</Text>
              <Text variant="small" styles={{ root: { maxHeight: 250, overflowY: "auto", display: "block", backgroundColor: "#fff", padding: 5, border: "1px solid #ddd" } }}>
                {log.result}
              </Text>
            </Stack>
          ))}
        </Stack>
      )}
    </Stack>
  );
};
