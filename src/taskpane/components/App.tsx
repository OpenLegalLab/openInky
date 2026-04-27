import * as React from "react";
import { DefaultButton, PrimaryButton, TextField, Spinner, Stack, Text, MessageBar, MessageBarType, Dropdown, IDropdownOption } from "@fluentui/react";
import { fetchCompletion, LLMConfig } from "../../services/llmService";
import { computeWordDiff } from "../../services/diffService";
import { getTargetText, applyTrackedChanges } from "../../services/wordService";
import { Settings } from "./Settings";

const DEFAULT_CONFIG: LLMConfig = {
  baseUrl: "https://llm.endpoint.ch",
  apiKey: "",
  model: "gpt-5.2-chat",
};

export const App: React.FC = () => {
  const [config, setConfig] = React.useState<LLMConfig>(DEFAULT_CONFIG);
  const [prompt, setPrompt] = React.useState<string>("Diesen Text im Hinblick auf Klarheit und einen professionellen Tonfall verbessern.");
  const [isProcessing, setIsProcessing] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | undefined>();
  const [showSettings, setShowSettings] = React.useState<boolean>(false);
  
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

    try {
      const originalText = await getTargetText();
      
      if (!originalText || originalText.trim() === "") {
        setError("Kein Text ausgewählt oder im Dokument gefunden.");
        setIsProcessing(false);
        return;
      }

      const modifiedText = await fetchCompletion(config, [
        { role: "system", content: "Du bist ein hilfreicher juristischer Assistent, der Texte basierend auf den Anweisungen des Benutzers verbessert. Gib AUSSCHLIESSLICH den verbesserten Text aus, ohne Anführungszeichen oder Füllwörter." },
        { role: "user", content: `Anweisung: ${prompt}\n\nText:\n${originalText}` }
      ]);

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
    </Stack>
  );
};
