import fs from "node:fs";
import path from "node:path";

const PROJECT_ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  ".."
);

export function loadIdentity(): string {
  const soulPath = path.join(PROJECT_ROOT, "soul.md");
  const identityPath = path.join(PROJECT_ROOT, "identity.md");

  let soulContent = "";
  let identityContent = "";

  try {
    soulContent = fs.readFileSync(soulPath, "utf-8").trim();
  } catch {
    console.warn("Warning: soul.md not found, using fallback");
  }

  try {
    identityContent = fs.readFileSync(identityPath, "utf-8").trim();
  } catch {
    console.warn("Warning: identity.md not found, using fallback");
  }

  if (!soulContent && !identityContent) {
    return "You are a helpful assistant. Be concise and direct.";
  }

  const parts = [identityContent, soulContent].filter(Boolean);
  return parts.join("\n\n");
}
