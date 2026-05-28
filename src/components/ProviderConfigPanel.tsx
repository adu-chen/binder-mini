import { useState, type FormEvent } from "react";

/**
 * @GOV
 * codes: BR-AG-SEC-001
 * type: RB
 * chain: AG-SEND-MESSAGE
 * rules: BR-AG-SEC-001
 * boundary: in=apiKeyConfigured boolean from Rust backend and provider name string | out=ProviderConfigPanel API key input field (type=password) with configured status indicator; never exposes raw API key to frontend
 * term_ref: TERM-AG-002
 */

interface ProviderConfigPanelProps {
  provider: "openai" | "anthropic" | "deepseek";
  model: string;
  apiKeyConfigured: boolean;
  onProviderChange: (provider: "openai" | "anthropic" | "deepseek") => void;
  onModelChange: (model: string) => void;
  onSaveKey: (key: string) => Promise<void> | void;
}

const PROVIDER_OPTIONS: Array<{
  value: "openai" | "anthropic" | "deepseek";
  label: string;
}> = [
  { value: "anthropic", label: "Anthropic" },
  { value: "openai", label: "OpenAI" },
  { value: "deepseek", label: "DeepSeek" },
];

export function ProviderConfigPanel({
  provider,
  model,
  apiKeyConfigured,
  onProviderChange,
  onModelChange,
  onSaveKey,
}: ProviderConfigPanelProps) {
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.elements.namedItem("apiKey") as HTMLInputElement;
    const key = input.value.trim();
    if (!key || saveState === "saving") return;

    setSaveState("saving");
    setSaveError(null);
    try {
      await onSaveKey(key);
      input.value = "";
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1500);
    } catch (error) {
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <div
      style={{
        padding: "12px 10px",
        borderTop: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: apiKeyConfigured ? "var(--success)" : "var(--warning)",
            flexShrink: 0,
          }}
        />
        <span style={{ color: "var(--text-secondary)" }}>
          {provider}
          {apiKeyConfigured ? "（已配置）" : "（未配置）"}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 6 }}>
        <select
          value={provider}
          onChange={(e) =>
            onProviderChange(e.currentTarget.value as "openai" | "anthropic" | "deepseek")
          }
          style={{
            fontSize: 12,
            padding: "4px 8px",
            background: "var(--bg-elevated)",
            color: "var(--text-primary)",
            border: "1px solid var(--border)",
            borderRadius: 4,
          }}
        >
          {PROVIDER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <input
          value={model}
          onChange={(e) => onModelChange(e.currentTarget.value)}
          placeholder="模型名称"
          autoComplete="off"
          style={{ fontSize: 12, padding: "4px 8px" }}
        />
      </div>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 6 }}>
        <input
          name="apiKey"
          type="password"
          placeholder="粘贴 API Key…"
          autoComplete="off"
          style={{ flex: 1, fontSize: 12, padding: "4px 8px" }}
        />
        <button
          type="submit"
          className="btn btn-ghost"
          disabled={saveState === "saving"}
          style={{ fontSize: 12, padding: "4px 10px" }}
        >
          {saveState === "saving" ? "保存中" : saveState === "saved" ? "已保存" : "保存"}
        </button>
      </form>
      {saveState === "error" && saveError && (
        <div style={{ color: "var(--danger)", fontSize: 11 }}>
          {saveError}
        </div>
      )}
    </div>
  );
}
