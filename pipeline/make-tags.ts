#!/usr/bin/env bun
// Parse catalog.md -> tags.json with normalized theme vocabulary.
import fs from "node:fs";
import path from "node:path";
import type { CatalogTag } from "./types";
const DIR = import.meta.dir;

// canonical themes (seeded from Eugene's own 2020 index thread + agent clusters)
const THEMES: Record<string, string[]> = {
  'memetics & egregores': ['memetic', 'egregore', 'cognitohazard', 'infohazard', 'irony', 'propaganda', 'tulpa', 'religion', 'meme', 'antimeme', 'hyperreality', 'simulacra', 'semiotics', 'psyop', 'spectacle'],
  'cybernetics & systems': ['cybernetic', 'control theory', 'feedback', 'systems thinking', 'complexity', 'emergence', 'chaos', 'dynamical', 'singularity', 'antifragility', 'resilience', 'mechanism-design', 'forecasting', 'biology', 'optimization'],
  'computation as lens': ['computational', 'information-theory', 'information theory', 'kolmogorov', 'greebling', 'concurrency', 'annealing', 'compression', 'computer science', 'machine learning', 'simulation', 'observability', 'programming', 'debugger', 'formal joke', 'physics'],
  'mind & phenomenology': ['phenomenolog', 'consciousness', 'ego', 'selfhood', 'buddhis', 'taoism', 'tao', 'meditation', 'psychedelic', 'forgiveness', 'introspection', 'metacognition', 'philosophy of mind', 'philosophy-of-mind', 'free will', 'determinism', 'qualia', 'subselves', 'society of mind', 'process ontology', 'akrasia', 'psychology', 'psychodynamics', 'emotion', 'anger', 'self-compassion', 'self-love', 'moral philosophy', 'quality'],
  'autism & neurodivergence': ['autism', 'autist', 'adhd', 'neurodivergen', 'masking', 'executive function', 'executive-function', 'sensory'],
  'transhumanism & mortality': ['transhumanis', 'uploading', 'entropy', 'heat death', 'ergodicity', 'aging', 'mortality', 'death', 'immortality', 'legacy', 'bioethics', 'genetics', 'natalism', 'senescence', 'disability'],
  'networks vs institutions': ['decentraliz', 'crypto', 'blockchain', 'network', 'institution', 'legibility', 'high-modernism', 'high modernism', 'dao', 'fediverse', 'web3', 'coordination', 'digital-sovereignty', 'distributed-systems', 'foss'],
  'markets & political economy': ['market', 'economics', 'political economy', 'class', 'capitalism', 'financializ', 'policy', 'urbanism', 'homelessness', 'degrowth', 'energy', 'nuclear', 'automation', 'geopolitics', 'immigration', 'america', 'supply chain', 'progress', 'civilization'],
  'epistemics': ['epistem', 'rationalism', 'postrat', 'rationality', 'heuristic', 'load-bearing', 'delusion', 'belief', 'faith', 'axiom', 'covid', 'media', 'fact check', 'discourse', 'reasoning', 'analogies', 'intuition', 'straussian', 'decoupling', 'language', 'representation', 'rhetoric', 'metaphysics', 'tcm'],
  'social dynamics': ['status', 'confidence', 'social', 'communication', 'relationship', 'boundaries', 'boundary', 'parasocial', 'friendship', 'community', 'attention', 'advertising', 'signaling', 'goodhart', 'polarization', 'norms', 'taboo', 'empathy', 'curiosity', 'agency', 'self-presentation', 'atomization'],
  'gender & masculinity': ['masculin', 'gender', 'pua', 'chivalry', 'intersexual'],
  'engineering culture': ['software', 'engineering', 'hiring', 'work', 'management', 'orgs', 'organizational', 'education critique', 'pedagogy', 'abstraction', 'ai capabilities', 'ai interfaces', 'tech critique', 'tech criticism', 'industry'],
  'AI': [' ai', 'ai,', 'ai-', 'agi', 'alignment', 'foom', 'personhood', 'chatgpt', 'conversational'],
  'embodiment & practice': ['embodiment', 'yoga', 'tai chi', 'climbing', 'breathwork', 'music', 'sport', 'volleyball', 'pain', 'travel', 'habit', 'practice', 'extended cognition', 'learning', 'spiritual practice', 'wu wei'],
  'scene & meta': ['tpot', 'twitter', 'meta-twitter', 'meta-curation', 'self-index', 'live-event', 'games', 'milestone', 'vibecamp', 'voice', 'humor', 'banter', 'shitpost', 'wordplay', 'anime', 'reviews', 'birds', 'photography'],
};

const catalogPath = fs.existsSync(path.join(DIR, 'catalog.md'))
  ? path.join(DIR, 'catalog.md')
  : path.join(DIR, '..', 'analysis', 'corpus-catalog.md');
const raw = fs.readFileSync(catalogPath, 'utf8');
const tags: Record<string, CatalogTag> = {};
let count = 0;
for (const line of raw.split('\n')) {
  const m = line.match(/^(\d{15,20}) \| (.+?) \| (.+?) \| (\w+) \| (\d) \| (.+)$/);
  if (!m) continue;
  const [, id, title, freeTags, type, grade, gist] = m;
  const hay = (freeTags + ' ' + title).toLowerCase();
  const themes: string[] = [];
  for (const [theme, kws] of Object.entries(THEMES)) {
    if (kws.some(k => hay.includes(k))) themes.push(theme);
  }
  tags[id!] = { title: title!, tags: themes.slice(0, 3), type: type!, grade: +grade!, gist: gist! };
  count++;
}
fs.writeFileSync(path.join(DIR, 'tags.json'), JSON.stringify(tags, null, 1));
// distribution
const dist: Record<string, number> = {};
for (const t of Object.values(tags)) for (const th of t.tags) dist[th] = (dist[th] || 0) + 1;
console.log('tagged threads:', count);
console.log('theme distribution:', JSON.stringify(dist, null, 1));
const untagged = Object.entries(tags).filter(([, v]) => !v.tags.length).map(([k, v]) => k + ' ' + v.title);
console.log('untagged:', untagged.length, untagged.slice(0, 10));
