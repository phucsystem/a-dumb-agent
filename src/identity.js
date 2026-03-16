const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');

function loadIdentity() {
  const soulPath = path.join(PROJECT_ROOT, 'soul.md');
  const identityPath = path.join(PROJECT_ROOT, 'identity.md');

  let soulContent = '';
  let identityContent = '';

  try {
    soulContent = fs.readFileSync(soulPath, 'utf-8').trim();
  } catch (error) {
    console.warn('Warning: soul.md not found, using fallback');
  }

  try {
    identityContent = fs.readFileSync(identityPath, 'utf-8').trim();
  } catch (error) {
    console.warn('Warning: identity.md not found, using fallback');
  }

  if (!soulContent && !identityContent) {
    return 'You are a helpful assistant. Be concise and direct.';
  }

  const parts = [identityContent, soulContent].filter(Boolean);
  return parts.join('\n\n');
}

module.exports = { loadIdentity };
