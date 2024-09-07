import { Config } from ".";

async function generateText(
  prompt: string,
  systemPrompt: string,
  startCallback: () => void,
  tokenCallback: (text: string) => void,
  completedCallback: (context: number[]) => void,
  config: Config
) {
  const { host, model, abortSignal, context, modelSettings, useRag } = config;
  fetch(`${host}/api/generate`, {
    signal: abortSignal,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model,
      system: systemPrompt,
      prompt,
      context,
      useRag,
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
          function push() {
            reader.read().then(async ({ done, value }) => {
              if (done) {
                controller.close();
                return;
              }
              // Convert the Uint8Array to string and process the chunk
              const chunk = new TextDecoder("utf-8").decode(value);
              try {
                const lines = chunk.split("\n");
                for (let i = 0; i < lines.length - 1; i++) {
                  const line = lines[i];
                  if (line) {
                    const json = JSON.parse(line);
                    const response = json.response;
                    if (response) {
                      tokenCallback(response);
                    }
                  }
                }
              } catch (e) {
                console.log(e);
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
    .then(() => {
      completedCallback([]);
    })
    .catch((err) => console.error(err));
}

const getModels = (host: string) => async () => {
  const res = await fetch(`${host}/api/tags`);
  return res.json();
};

const getModelSettings = (host: string, model: string) => async () => {
  const res = await fetch(`${host}/api/show`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: model }),
  });
  return res.json();
};

export default { generateText, getModels, getModelSettings };
