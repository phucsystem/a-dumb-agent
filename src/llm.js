const OpenAI = require('openai');

const client = new OpenAI({
  apiKey: process.env.LLM_API_KEY,
  baseURL: process.env.LLM_BASE_URL || 'https://api.deepseek.com/v1',
});

async function chat(systemPrompt, historyMessages, userMessage) {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...historyMessages,
    { role: 'user', content: userMessage },
  ];

  const model = process.env.LLM_MODEL || 'deepseek-chat';

  const response = await client.chat.completions.create({
    model,
    messages,
  });

  const reply = response.choices?.[0]?.message?.content;
  if (!reply) {
    throw new Error('LLM returned empty response');
  }
  return reply;
}

module.exports = { chat };
