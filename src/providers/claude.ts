import Anthropic from "@anthropic-ai/sdk";
import { Config } from ".";

const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_KEY, // defaults to process.env["ANTHROPIC_API_KEY"]
  defaultHeaders: {},
});

async function generateText(
  prompt: string,
  tokenCallback: (text: string) => void,
  completedCallback: (context: number[]) => void,
  config: Config
) {
  console.log("generating text with claude");
  if (!config.model) {
    return;
  }
  await anthropic.messages
    .stream({
      model: "claude-3-haiku-20240307",
      max_tokens: 1000,
      temperature: 0,
      system:
        "You are a writing assistant. When provided with a prompt you generate text to satisfy that prompt.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      ],
    })
    .on("text", tokenCallback);

  completedCallback([]);
}

const getModels = () => async () => {
  // Return a mock promise that returns an array of models
  return { models: [{ name: "claude-3-haiku-20240307" }] };
};

const getModelSettings = () => async () => {
  return {};
};

export default { generateText, getModels, getModelSettings };
