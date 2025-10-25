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

/**
 * Calculate cosine similarity between two vectors
 * Returns a value between 0 (completely different) and 1 (identical)
 * @param {number[]} vecA - First vector
 * @param {number[]} vecB - Second vector
 * @return {number} Cosine similarity score between 0 and 1
 */
export const cosineSimilarity = (
  vecA: number[],
  vecB: number[]
): number => {
  if (vecA.length !== vecB.length) {
    throw new Error("Vectors must have the same length");
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
};

export {openaiKey};

