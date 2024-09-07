import { Config } from ".";

async function generateText(
  prompt: string,
  systemPrompt: string,
  startCallback: () => void,
  tokenCallback: (text: string) => void,
  completedCallback: (context: number[]) => void,
  config: Config
) {
  const { host, model, abortSignal, context, modelSettings } = config;
  fetch(`${host}/api/generate`, {
    signal: abortSignal,
    method: "POST",
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
          function push() {
            reader.read().then(({ done, value }) => {
              if (done) {
                controller.close();
                return;
              }
              // Convert the Uint8Array to string and process the chunk
              const chunk = new TextDecoder("utf-8").decode(value);
              try {
                const json = JSON.parse(chunk);
                const response = json.response;
                if (response) {
                  tokenCallback(response);
                }

                if (json.context) {
                  completedCallback(json.context);
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
    .then(() => {})
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
