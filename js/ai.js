// Talks to a local Ollama model. Everything that uses AI must keep working when it is off:
// callers get `null` back and fall back to built-in content.
//
// Configure with URL params (remembered on this device):
//   ?ai=http://localhost:11434   where Ollama runs (default)
//   ?model=mistral               which model to use (default)
//   ?ai=off                      play without AI

const KEY = 'stamprally.ai.v1';
const DEFAULTS = { url: 'http://localhost:11434', model: 'mistral' };

function loadConfig() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(KEY)) ?? {};
  } catch {}
  const params = new URLSearchParams(location.search);
  const config = { ...DEFAULTS, ...saved };
  if (params.has('ai')) config.url = params.get('ai');
  if (params.has('model')) config.model = params.get('model');
  try {
    localStorage.setItem(KEY, JSON.stringify(config));
  } catch {}
  return config;
}

const config = loadConfig();
let availability = null;

// Resolves to true when the model answers. Checked once per page load.
export function isAvailable() {
  if (config.url === 'off') return Promise.resolve(false);
  availability ??= fetch(`${config.url}/api/tags`, { signal: AbortSignal.timeout(2000) })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => Boolean(data?.models?.some((m) => m.name.split(':')[0] === config.model.split(':')[0])))
    .catch(() => false);
  return availability;
}

export function modelName() {
  return config.model;
}

// messages: [{ role: 'system' | 'user' | 'assistant', content }]. Returns the reply text, or null.
export async function chat(messages, { json = false, temperature = 0.6, maxTokens = 220, timeoutMs = 45000 } = {}) {
  if (!(await isAvailable())) return null;
  try {
    const res = await fetch(`${config.url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        model: config.model,
        messages,
        stream: false,
        ...(json ? { format: 'json' } : {}),
        options: { temperature, num_predict: maxTokens },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

// Personal details a child might type. Removed before anything reaches the model.
const PERSONAL = [
  /\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, // e-mail
  /(?:\+31|0031|\b0)[\s-]?6[\s-]?(?:\d[\s-]?){8}\b/g, // mobile number
  /\b0\d{1,3}[\s-]?\d{6,7}\b/g, // landline
  /\b\d{4}\s?[A-Za-z]{2}\b/g, // postcode
];

// Returns { text, removed } where removed is true when something was taken out.
export function stripPersonal(text) {
  let removed = false;
  let clean = text;
  for (const pattern of PERSONAL) {
    clean = clean.replace(pattern, () => {
      removed = true;
      return '[weggehaald]';
    });
  }
  return { text: clean, removed };
}
