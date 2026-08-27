#!/usr/bin/env bun
// Concept indexer: lexical extraction of pz's recurring concepts across ALL own tweets.
// His coinage-heavy style makes this work — the vocabulary is self-indexing.
import fs from "node:fs";
import path from "node:path";
import type { Tweet } from "./types";
const DIR = import.meta.dir;

const CONCEPTS: Array<[string, RegExp]> = [
  // signature coinages (high precision)
  ['greebling', /greebl/i],
  ['egregores', /egregor/i],
  ['tulpas', /tulpa/i],
  ['ergodicity', /ergodic/i],
  ['cognitohazards', /cognitohazard|infohazard|memetic hazard/i],
  ['memetics', /memetic|memeplex|mind ?virus|antimeme|meme pool|noosphere|cordycep/i],
  ['psyops', /psyop|propaganda|astroturf|botnet/i],
  ['irony poisoning', /irony.poison|memetic vaccine|irony is/i],
  ['hyperreality', /hyperreal|simulacr|baudrillard/i],
  ['semiotics', /semiotic|signifier|sign system/i],
  ['legibility', /legib/i],
  ['hyperobjects', /hyperobject/i],
  ['causal parallax', /causal parallax/i],
  ['wireheading', /wirehead|experience machine|reward hack/i],
  // systems / computation lenses
  ['cybernetics', /cybernetic|control system|control theory|feedback loop|OODA|homeostas/i],
  ['information theory', /information theory|shannon|error.correct|entropy of|signal.to.noise|lossy|bandwidth/i],
  ['kolmogorov & compression', /kolmogorov|compress|incompressib|dimensionality reduction|dimensional reduction/i],
  ['emergence', /emergen|self.organiz|convergent evolution|decentralized consensus/i],
  ['complexity', /complex system|complexity|chaotic system|nonlinear/i],
  ['fractals', /fractal/i],
  ['annealing', /anneal/i],
  ['explore/exploit', /explore.{0,3}exploit|exploit.{0,3}explore|optimal stopping/i],
  ['concurrency', /concurren|deadlock|thrashing|race condition|mutex/i],
  ['abstraction', /abstraction|leaky abstraction|abstraction height/i],
  ['simulation', /\bsimulat/i],
  ['maxwell\'s demon', /maxwell'?s demon/i],
  ['heat death', /heat death|entropy|negentropy/i],
  ['singularity', /singularit/i],
  ['blockchains', /blockchain|crypto|bitcoin|ethereum|\bDAO\b|NFT|web3|token|defi|fediverse/i],
  ['AI', /\bAI\b|\bAGI\b|GPT|chatbot|LLM|machine learning|neural net|artificial intelligence|language model/i],
  ['alignment & FOOM', /alignment|x.risk|\bFOOM\b|paperclip/i],
  // mind
  ['consciousness', /consciousness|\bqualia\b|sentien|phenomenolog|cartesian/i],
  ['dualism', /dualis|soul|platonic realm/i],
  ['ego & self', /\bego\b|egoic|true self|illusion of self|selfhood|self.model|anatta|no.self/i],
  ['buddhism', /buddhis|dharma|dukkha|non.attachment|meditat|jhana|equanimity|enlightenment/i],
  ['taoism', /\btao\b|taois|wu.wei|nondoing|non.doing/i],
  ['psychedelics', /psychedelic|dissociative|\blsd\b|psilocybin|ketamine|dxm|tripping/i],
  ['determinism', /determinis|free will|retrocausal/i],
  ['society of mind', /society of mind|subselves|subagent|internal family|parts work|superego/i],
  ['metacognition', /metacogniti|introspect|self.talk|inner monologue|debugger access/i],
  ['memory & cognition', /working memory|visual cortex|spatial reasoning|cached thought|pattern.match/i],
  ['emotions as signals', /emotions? (are|as|get)|anger is|pain is a message|feelings? (are|as)/i],
  ['trauma & healing', /trauma|healing|therapy|therapist|inner work|forgiveness/i],
  ['akrasia', /akrasia|executive dysfunction|procrastinat|imp of the perverse/i],
  // neurodivergence
  ['autism', /autis|aspie|neurodivergen|neurotypical|normie simulation|masking/i],
  ['ADHD', /\badhd\b|attention deficit|hyperfocus|distractib/i],
  ['sensory regulation', /sensory|overstimulat|downregulat|overwhelm/i],
  // transhumanism
  ['transhumanism', /transhuman|posthuman|cyborg|bodymod|prosthetic/i],
  ['uploading', /\bupload/i],
  ['longevity', /senescence|anti.aging|longevity|immortal|defeat aging/i],
  ['embodiment', /embodi|somatic|proprioce|energy body|body.mind/i],
  // practice
  ['yoga & tai chi', /\byoga\b|asana|tai.chi|qi.gong|vinyasa/i],
  ['tcm & qi', /\bTCM\b|chinese medicine|acupuncture|herbalis|\bqi\b/i],
  ['climbing & sport', /bouldering|climbing|volleyball|lifeguard|swimming|gym\b/i],
  ['music', /\bmusic\b|concert|rave|techno|metal\b|dj\b/i],
  // society
  ['networks vs institutions', /institution|high modernis|network state|postmodern network|bureaucra/i],
  ['markets', /\bmarkets?\b|price signal|capitalis|financializ|invisible hand/i],
  ['incentives', /incentive|mechanism design|goodhart|moloch/i],
  ['supply chains', /supply chain|logistics|globaliz|industrial civilization/i],
  ['nuclear energy', /nuclear|reactor|fission|fusion power/i],
  ['degrowth & climate', /degrowth|malthus|climate change|greenis|environmentalis/i],
  ['class & status', /status game|status hierarch|social status|\bclass\b|classis|noblesse/i],
  ['urbanism', /urbanis|housing|homelessness|subway|transit|city planning/i],
  ['geopolitics', /geopolit|ukraine|russia|soviet|singapore|\bchina\b/i],
  ['immigration & america', /immigrant|america\b|american dream|assimilat/i],
  ['education', /public education|schooling|college|university|student loan|credentials/i],
  // epistemics
  ['epistemics', /epistem|bayesian|priors\b|evidence|falsifiab/i],
  ['rationalism & postrat', /rationalis|postrat|lesswrong|\bSSC\b|slate star|EA\b|effective altruis/i],
  ['load-bearing beliefs', /load.bearing|axiom|foundational belief|first principles/i],
  ['delusion & cope', /delusion|\bcope\b|self.deception|motivated reasoning/i],
  ['heuristics', /heuristic|rule of thumb|intuition pump|toy model/i],
  ['mysticism & woo', /mystic|\bwoo\b|occult|magick|ritual|esoteric|tarot/i],
  ['gods & religion', /\breligio|theolog|worship|prayer|sacred|divine|priest/i],
  ['straussian reading', /straussian|esoteric reading|dogwhistle/i],
  ['jargon & compression', /jargon|big words|technical language|terminolog|vocabulary/i],
  ['antimemes & mu', /\bmu\b|not.even.wrong|category error|categorical error|ill.posed/i],
  // social dynamics
  ['agency', /\bagency\b|agentic|live player|npc\b/i],
  ['counterparty simulation', /counterparty|theory of mind|modeling (people|others|you)|other.model/i],
  ['communication', /communicat|conversation|discourse|dialogue/i],
  ['confidence & attention', /confidence|attention (is|econom)|being perceived|the gaze/i],
  ['boundaries', /boundar(y|ies)|consent|personal space/i],
  ['friendship & community', /friendship|community|belonging|mutuals|scene\b|scenius/i],
  ['parasociality', /parasocial|celebrity|micro.celeb/i],
  ['cringe & embarrassment', /cringe|embarrass|shame\b|humiliat/i],
  ['bullying', /bully|bullied|bullying/i],
  ['masks & pseudonymity', /pseudonym|anonymit|alt account|persona\b|self.mytholog/i],
  ['gender', /gender|masculin|feminin|\btrans\b|intersexual|chivalr/i],
  ['dating & PUA', /\bPUA\b|pickup|dating|courtship|flirt/i],
  ['natalism', /natalis|reproduce|descendants|ancestors|lineage/i],
  // engineering culture
  ['software engineering', /software|codebase|refactor|technical debt|debugging|deploy|infra\b/i],
  ['hiring & interviews', /hiring|interview|fizzbuzz|job listing|candidates/i],
  ['observability', /observab|logfile|logs\b|dashboard|metrics|number go up/i],
  ['org dynamics', /\borgs?\b|corporate|management|startup|CTO|engineering culture/i],
  // meta
  ['twitter meta', /twitter|tweet|thread|timeline|poast|shitpost|banger|quote.tweet|\bQT\b|ratio/i],
  ['tpot & scene', /tpot|ingroup|postrat twitter|vibecamp|reply guy/i],
  ['writing & essays', /essay|blog|writing|longform|wordcel|rotator/i],
];

const tweets: Tweet[] = JSON.parse(fs.readFileSync(path.join(DIR, 'tweets.json'), 'utf8'));
const own = tweets.filter(t => !t.isRT);
const counts = new Map<string, number>(CONCEPTS.map(([k]) => [k, 0]));
const perTweet = new Map<string, number[]>();
for (const t of own) {
  const found: number[] = [];
  for (let i = 0; i < CONCEPTS.length; i++) {
    if (CONCEPTS[i][1].test(t.text)) { found.push(i); counts.set(CONCEPTS[i][0], (counts.get(CONCEPTS[i][0]) ?? 0) + 1); }
  }
  if (found.length) perTweet.set(t.id, found);
}
const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
console.log('own tweets:', own.length, '| tweets matching >=1 concept:', perTweet.size);
console.log('\nconcept counts:');
for (const [k, c] of sorted) console.log(String(c).padStart(6), k);
fs.writeFileSync(path.join(DIR, 'concept-index.json'), JSON.stringify({
  concepts: CONCEPTS.map(([k]) => k),
  perTweet: Object.fromEntries(perTweet),
}));
