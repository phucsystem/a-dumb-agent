import { InMemoryStore } from "@langchain/langgraph";

let storeInstance: InMemoryStore | null = null;

export function getStore(): InMemoryStore {
  if (!storeInstance) {
    storeInstance = new InMemoryStore();
  }
  return storeInstance;
}

export async function storeUserFact(
  store: InMemoryStore,
  senderId: string,
  fact: string
): Promise<void> {
  const key = `fact_${Date.now()}`;
  await store.put([senderId, "facts"], key, {
    text: fact,
    source: "chat",
    timestamp: new Date().toISOString(),
  });
}

export async function getUserFacts(
  store: InMemoryStore,
  senderId: string,
  limit = 5
): Promise<string[]> {
  const items = await store.search([senderId, "facts"], { limit });
  return items.map((item) => (item.value as { text: string }).text);
}
