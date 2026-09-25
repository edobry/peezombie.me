// The concept lexicon: every recurring concept the weave indexes, as a name, a
// regex over tweet text, and the trailhead theme it files under.
//
// Data only, no I/O, so it can be imported by concepts.ts (which runs the
// indexer over the corpus), by make-tags.ts (which types its theme keywords
// against THEMES), and by lexicon.test.ts in a fresh clone with no corpus.
//
// The theme is editorial: one concept, one theme, chosen by hand (mt#5222). The
// baseline was this file's own section comments; where the theme keyword lists
// in make-tags.ts spoke (buddhism, taoism, psychedelics and akrasia sit under
// mind & phenomenology there; entropy, ergodicity and natalism under
// transhumanism & mortality; abstraction and pedagogy under engineering
// culture), they were the tie-breaker, so a thread and the concepts in it tend
// to file under the same theme. Correct a line and rebuild.

/** The 15 trailhead themes, in the order make-tags.ts declares them. */
export const THEMES = [
  'memetics & egregores',
  'cybernetics & systems',
  'computation as lens',
  'mind & phenomenology',
  'autism & neurodivergence',
  'transhumanism & mortality',
  'networks vs institutions',
  'markets & political economy',
  'epistemics',
  'social dynamics',
  'gender & masculinity',
  'engineering culture',
  'AI',
  'embodiment & practice',
  'scene & meta',
] as const;
export type Theme = (typeof THEMES)[number];

export interface Concept {
  name: string;
  theme: Theme;
  re: RegExp;
}

export const LEXICON: ReadonlyArray<Concept> = [
  // signature coinages (high precision)
  { name: 'greebling', theme: 'computation as lens', re: /greebl/i },
  { name: 'egregores', theme: 'memetics & egregores', re: /egregor/i },
  { name: 'tulpas', theme: 'memetics & egregores', re: /tulpa/i },
  { name: 'ergodicity', theme: 'transhumanism & mortality', re: /ergodic/i },
  { name: 'cognitohazards', theme: 'memetics & egregores', re: /cognitohazard|infohazard|memetic hazard/i },
  { name: 'memetics', theme: 'memetics & egregores', re: /memetic|memeplex|mind ?virus|antimeme|meme pool|noosphere|cordycep/i },
  { name: 'psyops', theme: 'memetics & egregores', re: /psyop|propaganda|astroturf|botnet/i },
  { name: 'irony poisoning', theme: 'memetics & egregores', re: /irony.poison|memetic vaccine|irony is/i },
  { name: 'hyperreality', theme: 'memetics & egregores', re: /hyperreal|simulacr|baudrillard/i },
  { name: 'semiotics', theme: 'memetics & egregores', re: /semiotic|signifier|sign system/i },
  { name: 'legibility', theme: 'networks vs institutions', re: /legib/i },
  { name: 'hyperobjects', theme: 'mind & phenomenology', re: /hyperobject/i },
  { name: 'causal parallax', theme: 'epistemics', re: /causal parallax/i },
  { name: 'wireheading', theme: 'mind & phenomenology', re: /wirehead|experience machine|reward hack/i },
  // systems / computation lenses
  { name: 'cybernetics', theme: 'cybernetics & systems', re: /cybernetic|control system|control theory|feedback loop|OODA|homeostas/i },
  { name: 'information theory', theme: 'computation as lens', re: /information theory|shannon|error.correct|entropy of|signal.to.noise|lossy|bandwidth/i },
  { name: 'kolmogorov & compression', theme: 'computation as lens', re: /kolmogorov|compress|incompressib|dimensionality reduction|dimensional reduction/i },
  { name: 'emergence', theme: 'cybernetics & systems', re: /emergen|self.organiz|convergent evolution|decentralized consensus/i },
  { name: 'complexity', theme: 'cybernetics & systems', re: /complex system|complexity|chaotic system|nonlinear/i },
  { name: 'fractals', theme: 'computation as lens', re: /fractal/i },
  { name: 'annealing', theme: 'computation as lens', re: /anneal/i },
  { name: 'explore/exploit', theme: 'cybernetics & systems', re: /explore.{0,3}exploit|exploit.{0,3}explore|optimal stopping/i },
  { name: 'concurrency', theme: 'computation as lens', re: /concurren|deadlock|thrashing|race condition|mutex/i },
  { name: 'abstraction', theme: 'engineering culture', re: /abstraction|leaky abstraction|abstraction height/i },
  { name: 'simulation', theme: 'computation as lens', re: /\bsimulat/i },
  { name: "maxwell's demon", theme: 'transhumanism & mortality', re: /maxwell'?s demon/i },
  { name: 'heat death', theme: 'transhumanism & mortality', re: /heat death|entropy|negentropy/i },
  { name: 'singularity', theme: 'cybernetics & systems', re: /singularit/i },
  { name: 'blockchains', theme: 'networks vs institutions', re: /blockchain|crypto|bitcoin|ethereum|\bDAO\b|NFT|web3|token|defi|fediverse/i },
  { name: 'AI', theme: 'AI', re: /\bAI\b|\bAGI\b|GPT|chatbot|LLM|machine learning|neural net|artificial intelligence|language model/i },
  { name: 'alignment & FOOM', theme: 'AI', re: /alignment|x.risk|\bFOOM\b|paperclip/i },
  // mind
  { name: 'consciousness', theme: 'mind & phenomenology', re: /consciousness|\bqualia\b|sentien|phenomenolog|cartesian/i },
  { name: 'dualism', theme: 'mind & phenomenology', re: /dualis|soul|platonic realm/i },
  { name: 'ego & self', theme: 'mind & phenomenology', re: /\bego\b|egoic|true self|illusion of self|selfhood|self.model|anatta|no.self/i },
  { name: 'buddhism', theme: 'mind & phenomenology', re: /buddhis|dharma|dukkha|non.attachment|meditat|jhana|equanimity|enlightenment/i },
  { name: 'taoism', theme: 'mind & phenomenology', re: /\btao\b|taois|wu.wei|nondoing|non.doing/i },
  { name: 'psychedelics', theme: 'mind & phenomenology', re: /psychedelic|dissociative|\blsd\b|psilocybin|ketamine|dxm|tripping/i },
  { name: 'determinism', theme: 'mind & phenomenology', re: /determinis|free will|retrocausal/i },
  { name: 'society of mind', theme: 'mind & phenomenology', re: /society of mind|subselves|subagent|internal family|parts work|superego/i },
  { name: 'metacognition', theme: 'mind & phenomenology', re: /metacogniti|introspect|self.talk|inner monologue|debugger access/i },
  { name: 'memory & cognition', theme: 'mind & phenomenology', re: /working memory|visual cortex|spatial reasoning|cached thought|pattern.match/i },
  { name: 'emotions as signals', theme: 'mind & phenomenology', re: /emotions? (are|as|get)|anger is|pain is a message|feelings? (are|as)/i },
  { name: 'trauma & healing', theme: 'mind & phenomenology', re: /trauma|healing|therapy|therapist|inner work|forgiveness/i },
  { name: 'akrasia', theme: 'mind & phenomenology', re: /akrasia|executive dysfunction|procrastinat|imp of the perverse/i },
  // neurodivergence
  { name: 'autism', theme: 'autism & neurodivergence', re: /autis|aspie|neurodivergen|neurotypical|normie simulation|masking/i },
  { name: 'ADHD', theme: 'autism & neurodivergence', re: /\badhd\b|attention deficit|hyperfocus|distractib/i },
  { name: 'sensory regulation', theme: 'autism & neurodivergence', re: /sensory|overstimulat|downregulat|overwhelm/i },
  // transhumanism
  { name: 'transhumanism', theme: 'transhumanism & mortality', re: /transhuman|posthuman|cyborg|bodymod|prosthetic/i },
  { name: 'uploading', theme: 'transhumanism & mortality', re: /\bupload/i },
  { name: 'longevity', theme: 'transhumanism & mortality', re: /senescence|anti.aging|longevity|immortal|defeat aging/i },
  { name: 'embodiment', theme: 'embodiment & practice', re: /embodi|somatic|proprioce|energy body|body.mind/i },
  // practice
  { name: 'yoga & tai chi', theme: 'embodiment & practice', re: /\byoga\b|asana|tai.chi|qi.gong|vinyasa/i },
  { name: 'tcm & qi', theme: 'embodiment & practice', re: /\bTCM\b|chinese medicine|acupuncture|herbalis|\bqi\b/i },
  { name: 'climbing & sport', theme: 'embodiment & practice', re: /bouldering|climbing|volleyball|lifeguard|swimming|gym\b/i },
  { name: 'music', theme: 'embodiment & practice', re: /\bmusic\b|concert|rave|techno|metal\b|dj\b/i },
  // society
  { name: 'networks vs institutions', theme: 'networks vs institutions', re: /institution|high modernis|network state|postmodern network|bureaucra/i },
  { name: 'markets', theme: 'markets & political economy', re: /\bmarkets?\b|price signal|capitalis|financializ|invisible hand/i },
  { name: 'incentives', theme: 'markets & political economy', re: /incentive|mechanism design|goodhart|moloch/i },
  { name: 'supply chains', theme: 'markets & political economy', re: /supply chain|logistics|globaliz|industrial civilization/i },
  { name: 'nuclear energy', theme: 'markets & political economy', re: /nuclear|reactor|fission|fusion power/i },
  { name: 'degrowth & climate', theme: 'markets & political economy', re: /degrowth|malthus|climate change|greenis|environmentalis/i },
  { name: 'class & status', theme: 'social dynamics', re: /status game|status hierarch|social status|\bclass\b|classis|noblesse/i },
  { name: 'urbanism', theme: 'markets & political economy', re: /urbanis|housing|homelessness|subway|transit|city planning/i },
  { name: 'geopolitics', theme: 'markets & political economy', re: /geopolit|ukraine|russia|soviet|singapore|\bchina\b/i },
  { name: 'immigration & america', theme: 'markets & political economy', re: /immigrant|america\b|american dream|assimilat/i },
  { name: 'education', theme: 'engineering culture', re: /public education|schooling|college|university|student loan|credentials/i },
  // epistemics
  { name: 'epistemics', theme: 'epistemics', re: /epistem|bayesian|priors\b|evidence|falsifiab/i },
  { name: 'rationalism & postrat', theme: 'epistemics', re: /rationalis|postrat|lesswrong|\bSSC\b|slate star|EA\b|effective altruis/i },
  { name: 'load-bearing beliefs', theme: 'epistemics', re: /load.bearing|axiom|foundational belief|first principles/i },
  { name: 'delusion & cope', theme: 'epistemics', re: /delusion|\bcope\b|self.deception|motivated reasoning/i },
  { name: 'heuristics', theme: 'epistemics', re: /heuristic|rule of thumb|intuition pump|toy model/i },
  { name: 'mysticism & woo', theme: 'epistemics', re: /mystic|\bwoo\b|occult|magick|ritual|esoteric|tarot/i },
  { name: 'gods & religion', theme: 'memetics & egregores', re: /\breligio|theolog|worship|prayer|sacred|divine|priest/i },
  { name: 'straussian reading', theme: 'epistemics', re: /straussian|esoteric reading|dogwhistle/i },
  { name: 'jargon & compression', theme: 'epistemics', re: /jargon|big words|technical language|terminolog|vocabulary/i },
  { name: 'antimemes & mu', theme: 'epistemics', re: /\bmu\b|not.even.wrong|category error|categorical error|ill.posed/i },
  // social dynamics
  { name: 'agency', theme: 'social dynamics', re: /\bagency\b|agentic|live player|npc\b/i },
  { name: 'counterparty simulation', theme: 'social dynamics', re: /counterparty|theory of mind|modeling (people|others|you)|other.model/i },
  { name: 'communication', theme: 'social dynamics', re: /communicat|conversation|discourse|dialogue/i },
  { name: 'confidence & attention', theme: 'social dynamics', re: /confidence|attention (is|econom)|being perceived|the gaze/i },
  { name: 'boundaries', theme: 'social dynamics', re: /boundar(y|ies)|consent|personal space/i },
  { name: 'friendship & community', theme: 'social dynamics', re: /friendship|community|belonging|mutuals|scene\b|scenius/i },
  { name: 'parasociality', theme: 'social dynamics', re: /parasocial|celebrity|micro.celeb/i },
  { name: 'cringe & embarrassment', theme: 'social dynamics', re: /cringe|embarrass|shame\b|humiliat/i },
  { name: 'bullying', theme: 'social dynamics', re: /bully|bullied|bullying/i },
  { name: 'masks & pseudonymity', theme: 'social dynamics', re: /pseudonym|anonymit|alt account|persona\b|self.mytholog/i },
  { name: 'gender', theme: 'gender & masculinity', re: /gender|masculin|feminin|\btrans\b|intersexual|chivalr/i },
  { name: 'dating & PUA', theme: 'gender & masculinity', re: /\bPUA\b|pickup|dating|courtship|flirt/i },
  { name: 'natalism', theme: 'transhumanism & mortality', re: /natalis|reproduce|descendants|ancestors|lineage/i },
  // engineering culture
  { name: 'software engineering', theme: 'engineering culture', re: /software|codebase|refactor|technical debt|debugging|deploy|infra\b/i },
  { name: 'hiring & interviews', theme: 'engineering culture', re: /hiring|interview|fizzbuzz|job listing|candidates/i },
  { name: 'observability', theme: 'computation as lens', re: /observab|logfile|logs\b|dashboard|metrics|number go up/i },
  { name: 'org dynamics', theme: 'engineering culture', re: /\borgs?\b|corporate|management|startup|CTO|engineering culture/i },
  // meta
  { name: 'twitter meta', theme: 'scene & meta', re: /twitter|tweet|thread|timeline|poast|shitpost|banger|quote.tweet|\bQT\b|ratio/i },
  { name: 'tpot & scene', theme: 'scene & meta', re: /tpot|ingroup|postrat twitter|vibecamp|reply guy/i },
  { name: 'writing & essays', theme: 'scene & meta', re: /essay|blog|writing|longform|wordcel|rotator/i },
];
