import {Pinecone} from "@pinecone-database/pinecone";
import {defineSecret} from "firebase-functions/params";

const pineconeKey = defineSecret("PINECONE_API_KEY");

export const getPineconeClient = () => {
  return new Pinecone({
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    apiKey: process.env.PINECONE_API_KEY!,
  });
};

export const getIndex = () => {
  const client = getPineconeClient();
  return client.index("messageai-conversations");
};

export const upsertVectors = async (vectors: Array<{
  id: string;
  values: number[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any>;
}>) => {
  const index = getIndex();
  return await index.upsert(vectors);
};

export const queryVectors = async (
  vector: number[],
  topK = 20,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filter?: Record<string, any>
) => {
  const index = getIndex();
  return await index.query({
    vector,
    topK,
    filter,
    includeMetadata: true,
  });
};

export {pineconeKey};

