import { Config } from ".";

const buildUrl = (host: string, path: string): string => {
  try {
    // During local dev, detect browser running on localhost and route via Vite proxy to avoid CORS
    if (typeof window !== "undefined") {
      const browserHost = window.location?.hostname;
      if (browserHost === "localhost" || browserHost === "127.0.0.1") {
        return `/ollama${path}`;
      }
    }
  } catch (e) {
    // ignore environment issues
  }
  return `${host}${path}`;
};

async function generateText(
  prompt: string,
  systemPrompt: string,
  startCallback: () => void,
  tokenCallback: (text: string) => void,
  completedCallback: (context: number[]) => void,
  config: Config
) {
  const { host, model, abortSignal, context, modelSettings } = config;
  fetch(buildUrl(host, "/api/generate"), {
    signal: abortSignal,
    method: "POST",
    credentials: "omit",

    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model,
      prompt,
      system: systemPrompt,
      context,
      options: modelSettings,
    }),
  })
    .then((response) => {
      if (!response || !response.body) {
        throw new Error("Invalid response");
      }
      const reader = response.body.getReader();
      startCallback();
      return new ReadableStream({
        start(controller) {
          const decoder = new TextDecoder("utf-8");
          let buffer = "";
          let lastContext: number[] | undefined;
          function push() {
            reader.read().then(({ done, value }) => {
              if (done) {
                controller.close();
                // Attempt to parse any residual buffered line
                const residual = buffer.trim();
                if (residual) {
                  try {
                    const json = JSON.parse(residual);
                    const response = json.response;
                    if (response) {
                      tokenCallback(response);
                    }
                    if (json.context) {
                      lastContext = json.context as number[];
                    }
                  } catch {
                    // ignore incomplete tail
                  }
                }
                // Finalize with last known context
                completedCallback(lastContext ?? []);
                return;
              }
              // Convert the Uint8Array to string and process as newline-delimited JSON
              const chunk = decoder.decode(value, { stream: true });
              buffer += chunk;
              // Process complete lines
              let newlineIndex = buffer.indexOf("\n");
              while (newlineIndex !== -1) {
                const line = buffer.slice(0, newlineIndex).trim();
                buffer = buffer.slice(newlineIndex + 1);
                if (line) {
                  try {
                    const json = JSON.parse(line);
                    const response = json.response;
                    if (response) {
                      tokenCallback(response);
                    }
                    if (json.context) {
                      lastContext = json.context as number[];
                    }
                  } catch (e) {
                    // ignore malformed lines
                  }
                }
                newlineIndex = buffer.indexOf("\n");
              }
              // Push the chunk to the stream
              controller.enqueue(value);
              push();
            });
          }
          push();
        },
      });
    })
    .then((stream) => new Response(stream))
    .then((response) => response.text())
    .then(() => {})
    .catch((err) => console.error(err));
}

const getModels = (host: string) => async () => {
  const res = await fetch(buildUrl(host, "/api/tags"), {
    credentials: "omit",
  });
  return res.json();
};

const getModelSettings = (host: string, model: string) => async () => {
  const res = await fetch(buildUrl(host, "/api/show"), {
    method: "POST",
    credentials: "omit",

    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: model }),
  });
  return res.json();
};

export default { generateText, getModels, getModelSettings };
