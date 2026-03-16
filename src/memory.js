const fs = require('fs');
const path = require('path');

const MEMORY_PATH = path.resolve(__dirname, '..', 'memory.md');

function loadMemory(maxEntries = 50) {
  try {
    const content = fs.readFileSync(MEMORY_PATH, 'utf-8');
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

function appendMemory(sender, message, reply) {
  const timestamp = new Date().toISOString();
  const entry = `## ${timestamp}\n**sender:** ${sender}\n**message:** ${message}\n\n**reply:** ${reply}\n\n---\n\n`;

  fs.appendFileSync(MEMORY_PATH, entry, 'utf-8');
}

module.exports = { loadMemory, appendMemory };
