import { ModelSettings } from "../store";
import ollama from "./ollama";
import claude from "./claude";

type Model = {
  name: string;
};

type ModelList = Model[];

type ResponseData = {
  models: ModelList;
};

export type Config = {
  host: string;
  model: string;
  abortSignal: AbortSignal;
  context: number[];
  modelSettings: ModelSettings;
  useRag?: boolean;
};
type Provider = {
  generateText: (
    prompt: string,
    startCallback: () => void,
    tokenCallback: (text: string) => void,
    completedCallback: (context: number[]) => void,
    config: Config
  ) => void;
  getModels: (host: string) => () => Promise<ResponseData>;
  getModelSettings: (
    host: string,
    model: string
  ) => () => Promise<ModelSettings>;
};

type ProviderMap = {
  [key: string]: Provider;
};

export const providers: ProviderMap = {
  ollama,
  claude,
};
