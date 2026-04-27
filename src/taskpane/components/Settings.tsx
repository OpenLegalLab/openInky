import * as React from "react";
import { DefaultButton, PrimaryButton, TextField, Stack, Text } from "@fluentui/react";
import { LLMConfig } from "../../services/llmService";

interface SettingsProps {
  config: LLMConfig;
  onSave: (config: LLMConfig) => void;
  onCancel: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ config, onSave, onCancel }) => {
  const [baseUrl, setBaseUrl] = React.useState(config.baseUrl);
  const [apiKey, setApiKey] = React.useState(config.apiKey);
  const [model, setModel] = React.useState(config.model);

  const handleSave = () => {
    onSave({ baseUrl, apiKey, model });
  };

  return (
    <Stack tokens={{ childrenGap: 15 }} styles={{ root: { padding: 20 } }}>
      <Text variant="xLarge" styles={{ root: { fontWeight: "bold" } }}>Einstellungen</Text>
      
      <TextField 
        label="API Basis-URL" 
        value={baseUrl} 
        onChange={(_e, newValue) => setBaseUrl(newValue || "")} 
      />
      
      <TextField 
        label="API-Schlüssel" 
        type="password"
        canRevealPassword
        value={apiKey} 
        onChange={(_e, newValue) => setApiKey(newValue || "")} 
        placeholder="sk-..."
      />

      <TextField 
        label="Modellname" 
        value={model} 
        onChange={(_e, newValue) => setModel(newValue || "")} 
      />

      <Stack horizontal tokens={{ childrenGap: 10 }} styles={{ root: { marginTop: 20 } }}>
        <PrimaryButton text="Speichern" onClick={handleSave} />
        <DefaultButton text="Abbrechen" onClick={onCancel} />
      </Stack>
    </Stack>
  );
};
