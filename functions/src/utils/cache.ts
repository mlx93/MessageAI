import * as admin from "firebase-admin";

export const withCache = async <T>(
  cacheKey: string,
  ttlMinutes: number,
  generatorFn: () => Promise<T>
): Promise<T> => {
  const db = admin.firestore();
  const cacheRef = db.collection("ai_cache").doc(cacheKey);

  try {
    const cached = await cacheRef.get();
    if (cached.exists) {
      const data = cached.data();
      if (data && data.expiresAt > Date.now()) {
        return data.value as T;
      }
    }
  } catch (error) {
    console.warn("Cache read error:", error);
  }

  const value = await generatorFn();

  try {
    await cacheRef.set({
      value,
      createdAt: Date.now(),
      expiresAt: Date.now() + (ttlMinutes * 60 * 1000),
    });
  } catch (error) {
    console.warn("Cache write error:", error);
  }

  return value;
};

export const generateCacheKey = (
  prefix: string,
  ...params: (string | number)[]
): string => {
  return `${prefix}_${params.join("_")}`;
};

