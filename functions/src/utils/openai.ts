import OpenAI from "openai";
import {defineSecret} from "firebase-functions/params";

const openaiKey = defineSecret("OPENAI_API_KEY");

export const getOpenAIClient = () => {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
};

export const generateEmbedding = async (text: string): Promise<number[]> => {
  const client = getOpenAIClient();
  const response = await client.embeddings.create({
    model: "text-embedding-3-large",
    input: text,
  });
  return response.data[0].embedding;
};

export const generateText = async (
  model: "gpt-4o" | "gpt-4o-mini",
  prompt: string,
  maxTokens?: number
): Promise<string> => {
  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model,
    messages: [{role: "user", content: prompt}],
    max_tokens: maxTokens || 1000,
    temperature: 0.1,
  });
  return response.choices[0]?.message?.content || "";
};

export {openaiKey};

