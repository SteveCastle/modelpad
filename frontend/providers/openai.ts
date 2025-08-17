import { Config } from ".";
import type { ModelSettings } from "../store";

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY as
  | string
  | undefined;

async function generateText(
  prompt: string,
  systemPrompt: string,
  startCallback: () => void,
  tokenCallback: (text: string) => void,
  completedCallback: (context: number[]) => void,
  config: Config
) {
  const { host, model, abortSignal, modelSettings } = config;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  if (OPENAI_API_KEY) headers["Authorization"] = `Bearer ${OPENAI_API_KEY}`;

  const body = {
    model,
    stream: true,
    messages: [
      { role: "system", content: systemPrompt || "" },
      { role: "user", content: prompt || "" },
    ],
    // Map common settings when possible
    temperature: modelSettings?.temperature,
    top_p: modelSettings?.top_p,
    stop: modelSettings?.stop,
    max_tokens: modelSettings?.num_predict,
  } as Record<string, unknown>;

  const resp = await fetch(`${host}/v1/chat/completions`, {
    signal: abortSignal,
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!resp.ok || !resp.body) {
    throw new Error(`OpenAI-compatible endpoint not available: ${resp.status}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  startCallback();
  try {
    let doneReading = false;
    while (!doneReading) {
      const { done, value } = await reader.read();
      if (done) {
        doneReading = true;
        break;
      }
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // keep incomplete line

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith(":")) continue;

        // SSE format: data: {json}
        if (line.startsWith("data:")) {
          const data = line.slice(5).trim();
          if (data === "[DONE]") {
            completedCallback([]);
            return; // end stream
          }
          try {
            const json = JSON.parse(data);
            const choices = json.choices || [];
            for (const choice of choices) {
              const delta = choice.delta ?? choice;
              const textChunk =
                (typeof delta?.content === "string" && delta.content) ||
                (typeof choice?.text === "string" && choice.text) ||
                "";
              if (textChunk) tokenCallback(textChunk);
            }
          } catch {
            // ignore malformed lines
          }
        } else {
          // Some servers send newline-delimited JSON without SSE prefix
          try {
            const json = JSON.parse(line);
            const choices = json.choices || [];
            for (const choice of choices) {
              const delta = choice.delta ?? choice;
              const textChunk =
                (typeof delta?.content === "string" && delta.content) ||
                (typeof choice?.text === "string" && choice.text) ||
                "";
              if (textChunk) tokenCallback(textChunk);
            }
          } catch {
            // ignore
          }
        }
      }
    }
  } finally {
    completedCallback([]);
  }
}

const getModels = (host: string) => async () => {
  const res = await fetch(`${host}/v1/models`);
  if (!res.ok) throw new Error(`Failed to list models: ${res.status}`);
  const data = await res.json();
  const models = Array.isArray(data?.data)
    ? data.data.map((m: { id: string }) => ({ name: m.id }))
    : [];
  return { models };
};

const getModelSettings = (_host: string, _model: string) => async () => {
  // OpenAI-compatible APIs generally don't expose per-model settings
  return {} as ModelSettings;
};

export default { generateText, getModels, getModelSettings };
