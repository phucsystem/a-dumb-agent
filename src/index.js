require('dotenv').config();

const crypto = require('crypto');
const express = require('express');
const { loadIdentity } = require('./identity');
const { loadMemory, appendMemory } = require('./memory');
const { chat } = require('./llm');

const AUTH_TOKEN = process.env.AUTH_TOKEN;
if (!AUTH_TOKEN) {
  console.error('FATAL: AUTH_TOKEN is not set. Exiting.');
  process.exit(1);
}
if (!process.env.LLM_API_KEY) {
  console.error('FATAL: LLM_API_KEY is not set. Exiting.');
  process.exit(1);
}

const app = express();
app.use(express.json());

const MAX_MEMORY_ENTRIES = parseInt(process.env.MAX_MEMORY_ENTRIES || '50', 10);
const PORT = parseInt(process.env.PORT || '3000', 10);
const startTime = Date.now();

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.slice(7);
  const tokenBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(AUTH_TOKEN);
  if (tokenBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(tokenBuffer, expectedBuffer)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.use(authMiddleware);

app.post('/chat', async (req, res) => {
  const { message, sender } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  try {
    const systemPrompt = loadIdentity();
    const history = loadMemory(MAX_MEMORY_ENTRIES);
    const reply = await chat(systemPrompt, history, message);
    const timestamp = new Date().toISOString();

    appendMemory(sender || 'unknown', message, reply);

    console.log(`[${timestamp}] sender=${sender || 'unknown'} message="${message.substring(0, 80)}"`);

    return res.json({ reply, agent: 'dumb-agent', timestamp });
  } catch (error) {
    console.error('Chat error:', error.message);
    return res.status(500).json({ error: 'LLM request failed' });
  }
});

app.get('/health', (req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  return res.json({
    status: 'ok',
    agent: 'dumb-agent',
    provider: process.env.LLM_PROVIDER || 'deepseek',
    uptime: uptimeSeconds,
  });
});

app.listen(PORT, () => {
  console.log(`Dumb Agent listening on port ${PORT}`);
  console.log(`Provider: ${process.env.LLM_PROVIDER || 'deepseek'}`);
  console.log(`Model: ${process.env.LLM_MODEL || 'deepseek-chat'}`);
});
