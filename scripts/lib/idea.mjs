export function formatIdea(text, now = new Date()) {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  return `- ${now.toISOString().slice(0, 10)} · ${clean}\n`;
}
