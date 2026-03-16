const fs = require('fs');
const path = require('path');

const MEMORY_DIR = path.resolve(__dirname, '..', 'memory');
const LEGACY_MEMORY_PATH = path.resolve(__dirname, '..', 'memory.md');

function ensureMemoryDir() {
  if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
  }
}

function getMemoryPath(conversationId) {
  if (!conversationId) return LEGACY_MEMORY_PATH;
  ensureMemoryDir();
  const safeId = conversationId.replace(/[^a-zA-Z0-9-]/g, '');
  return path.join(MEMORY_DIR, `${safeId}.md`);
}

function loadMemory(maxEntries = 50, conversationId = null) {
  const memoryPath = getMemoryPath(conversationId);

  try {
    const content = fs.readFileSync(memoryPath, 'utf-8');
    if (!content.trim()) return [];

    const entries = content
      .split('---')
      .map(block => block.trim())
      .filter(Boolean);

    const recentEntries = entries.slice(-maxEntries);

    const messages = [];
    for (const entry of recentEntries) {
      const messageMatch = entry.match(/\*\*message:\*\*\s*([\s\S]*?)(?=\n\n\*\*reply:\*\*)/);
      const replyMatch = entry.match(/\*\*reply:\*\*\s*([\s\S]*?)$/);

      if (messageMatch && replyMatch) {
        messages.push({ role: 'user', content: messageMatch[1].trim() });
        messages.push({ role: 'assistant', content: replyMatch[1].trim() });
      }
    }

    return messages;
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

function appendMemory(sender, message, reply, conversationId = null) {
  const memoryPath = getMemoryPath(conversationId);
  const timestamp = new Date().toISOString();
  const entry = `## ${timestamp}\n**sender:** ${sender}\n**message:** ${message}\n\n**reply:** ${reply}\n\n---\n\n`;

  fs.appendFileSync(memoryPath, entry, 'utf-8');
}

module.exports = { loadMemory, appendMemory };
