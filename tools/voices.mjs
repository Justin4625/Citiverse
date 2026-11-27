// Makes the read-aloud audio with ElevenLabs: one mp3 per fixed text, in audio/, plus
// audio/voices.json (normalised text -> file) that js/tts.js uses. Texts without an mp3 are
// read by the browser's own voice, so this only covers what fits in the free plan:
// the start screen, the stop screens (intro, Wist je dat?, secret) and the practice tips.
//
//   node tools/voices.mjs            # only makes what is missing
//   node tools/voices.mjs --dry      # lists the texts and the number of characters, no API calls
//
// The API key is read from ~/.config/elevenlabs.key (or ELEVENLABS_API_KEY). Never put it in
// this repo: the repo is public.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'audio');
const MODEL = 'eleven_multilingual_v2';
const dry = process.argv.includes('--dry');

// Three voices designed for Citiverse in ElevenLabs Voice Design (native Dutch; the free plan
// allows 3 own voices and no library voices via the API). The Buddies share them.
const DUTCH = {
  verteller: 'GhMrG79rpjH8K4yCKrgh', // calm young woman
  jongen: 'opqxmeRZVMzzr5UaqNGv', // upbeat young man
  vrolijk: 'hYSmWBg66wecVcXCj3iI', // cheerful young woman
};
const VOICES = {
  narrator: DUTCH.verteller, // start screen and practice tips
  centraal: DUTCH.jongen,
  markthal: DUTCH.vrolijk,
  kubuswoningen: DUTCH.jongen,
  erasmusbrug: DUTCH.jongen,
  rechtbank: DUTCH.verteller,
  euromast: DUTCH.vrolijk,
  hetpark: DUTCH.jongen,
  politiebureau: DUTCH.vrolijk,
  stadhuis: DUTCH.jongen,
  bibliotheek: DUTCH.vrolijk,
};

// Same key as js/tts.js: only letters and digits, lower case.
export const norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

const { STOPS } = await import(join(ROOT, 'js/stops.js'));

const items = [];
const add = (text, voice) => items.push({ text: text.replace(/\s+/g, ' ').trim(), voice });

// Start screen (index.html data-tts).
const splash = readFileSync(join(ROOT, 'index.html'), 'utf8').match(/<p data-tts="([^"]+)"/)[1];
add(splash, VOICES.narrator);

// Stop screens, in the Buddy's own voice. Same words as the blocks in js/stop.js.
for (const [id, s] of Object.entries(STOPS)) {
  const { name, role } = s.character;
  add(`Hoi, ik ben ${name}! Ik werk hier als ${role}. ${s.hook ?? s.problem}`, VOICES[id]);
  add(`Wist je dat? ${s.fact ?? s.facts[0]}`, VOICES[id]);
  add(`Het geheim van ${name}. ${s.secret}`, VOICES[id]);
}

// Practice tips: the `text` of every guide step (a line with `target:` in a game).
const gamesDir = join(ROOT, 'js/games');
for (const file of readdirSync(gamesDir)) {
  for (const line of readFileSync(join(gamesDir, file), 'utf8').split('\n')) {
    const m = line.includes('target:') && line.match(/text: (['"`])((?:\\.|(?!\1).)*)\1/);
    // Tips built from game data (`${...}`) differ per round: those stay on the browser voice.
    if (m && !m[2].includes('${')) add(m[2].replace(/\\(['"`])/g, '$1'), VOICES.narrator);
  }
}

// Duplicates (the same tip in two games) are made once.
const unique = [...new Map(items.map((i) => [norm(i.text), i])).values()];
const chars = unique.reduce((n, i) => n + i.text.length, 0);

const manifestPath = join(OUT, 'voices.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
const todo = unique.filter((i) => !manifest[norm(i.text)] || !existsSync(join(OUT, manifest[norm(i.text)])));
const todoChars = todo.reduce((n, i) => n + i.text.length, 0);
console.log(`${unique.length} texts, ${chars} characters; still to make: ${todo.length} (${todoChars} characters)`);
if (dry) {
  for (const i of todo) console.log(`- [${Object.keys(VOICES).find((k) => VOICES[k] === i.voice)}] ${i.text}`);
  process.exit(0);
}

const key = process.env.ELEVENLABS_API_KEY ?? readFileSync(join(homedir(), '.config/elevenlabs.key'), 'utf8').trim();
mkdirSync(OUT, { recursive: true });
for (const i of todo) {
  const file = `${createHash('sha1').update(`${i.voice}:${i.text}`).digest('hex').slice(0, 12)}.mp3`;
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${i.voice}?output_format=mp3_44100_64`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({
      text: i.text,
      model_id: MODEL,
      language_code: 'nl',
      voice_settings: { stability: 0.55, similarity_boost: 0.8, style: 0, use_speaker_boost: true },
    }),
  });
  if (!res.ok) {
    console.error(`Failed (${res.status}): ${await res.text()}`);
    break;
  }
  writeFileSync(join(OUT, file), Buffer.from(await res.arrayBuffer()));
  manifest[norm(i.text)] = file;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 1)}\n`);
  console.log(`ok ${file}  ${i.text.slice(0, 60)}`);
}
