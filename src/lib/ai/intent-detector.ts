/**
 * 🎯 INTENT DETECTOR
 * 
 * Detects user query intent for proper response orchestration.
 * Identifies: hairstyle queries, image analysis needs, virtual try-on eligibility, etc.
 */

export interface QueryIntent {
  type: 'hairstyle' | 'makeup' | 'skincare' | 'salon_search' | 'beauty_general' | 'off_topic';
  subtype?: string;
  confidence: number; // 0-1
  needsImages: boolean;
  needsFaceAnalysis: boolean;
  eligibleForVirtualTryOn: boolean;
  keywords: string[];
  details: Record<string, any>;
}

// Keywords mapped to intent types
const INTENT_KEYWORDS = {
  hairstyle: [
    'hairstyle', 'haircut', 'hair cut', 'hair style', 'style', 'look',
    'layers', 'bangs', 'bob', 'fade', 'undercut', 'buzz', 'pixie',
    'mohawk', 'dreads', 'braids', 'bun', 'ponytail', 'french',
    'what suits me', 'which hairstyle', 'best cut', 'hair recommendations',
    'recommend a hairstyle', 'face shape', 'face analysis', 'which cut',
    'flattering', 'flatters', 'suits my face', 'good for my face',
    'bad for my face', 'my face type', 'hair texture', 'curly', 'straight',
    'wavy', 'coily', 'afro', 'thick hair', 'thin hair', 'fine hair',
    'dense hair', 'hair density', 'volume', 'volumizing', 'thinning',
  ],
  makeup: [
    'makeup', 'makeup look', 'eye makeup', 'makeup tips', 'makeup tutorial',
    'bridal makeup', 'party makeup', 'wedding makeup', 'engagement makeup',
    'makeup for', 'how to apply', 'makeup technique', 'contouring',
    'blending', 'eyeshadow', 'eyeliner', 'lipstick', 'foundation',
    'concealer', 'blush', 'bronzer', 'highlighter', 'primer',
    'makeup artist', 'makeup brand', 'makeup product', 'makeup kit',
  ],
  skincare: [
    'skincare', 'skin care', 'facial', 'face treatment', 'acne',
    'pimples', 'pimple', 'skin texture', 'glowing skin', 'skin glow',
    'dark circles', 'wrinkles', 'anti-aging', 'dark spots', 'pigmentation',
    'skin brightening', 'skin whitening', 'hyperpigmentation', 'melasma',
    'dermatologist', 'skin specialist', 'facial treatment', 'skincare routine',
    'serum', 'moisturizer', 'sunscreen', 'face mask', 'face pack',
    'hydrating', 'hydration', 'oily skin', 'dry skin', 'combination skin',
    'sensitive skin', 'skin type', 'skin concern',
  ],
  salon_search: [
    'salon', 'best salon', 'salon near', 'salon in', 'find salon',
    'salon recommendations', 'recommended salon', 'salon booking',
    'salon appointment', 'salon price', 'salon cost', 'salon package',
    'salon expert', 'salon review', 'salon rating', 'top salon',
    'verified salon', 'salon service', 'what salon', 'which salon',
  ],
};

const FACE_ANALYSIS_KEYWORDS = [
  'face shape', 'face analysis', 'my face', 'my forehead', 'my jawline',
  'my cheekbones', 'my chin', 'my nose', 'my lips', 'my eyes',
  'analyze my face', 'analyze my features', 'what suits my face',
  'good for my face', 'bad for my face', 'my face type',
  'face shape analysis', 'facial features', 'face structure',
  'oval face', 'round face', 'square face', 'heart face', 'diamond face',
  'oblong face', 'triangle face', 'pear face', 'inverted triangle',
];

const VIRTUAL_TRYON_KEYWORDS = [
  'try', 'try on', 'try it', 'preview', 'see how', 'show me',
  'what do i look like', 'how would i look', 'how would i look with',
  'visualize', 'virtual', 'ar', 'augmented reality', 'filter',
];

/**
 * Detect intent from user query
 */
export function detectIntent(query: string): QueryIntent {
  if (!query) {
    return {
      type: 'beauty_general',
      confidence: 0,
      needsImages: false,
      needsFaceAnalysis: false,
      eligibleForVirtualTryOn: false,
      keywords: [],
      details: {},
    };
  }

  const normalized = query.toLowerCase().trim();
  const words = normalized.split(/\s+/);

  // Check for each intent type
  let bestMatch: { type: keyof typeof INTENT_KEYWORDS; matches: number } | null = null;
  let bestScore = 0;

  for (const [type, keywords] of Object.entries(INTENT_KEYWORDS)) {
    const matches = keywords.filter((k) => normalized.includes(k)).length;
    const score = matches / keywords.length; // Percentage of keywords that matched

    if (matches > 0 && matches > bestScore) {
      bestMatch = { type: type as keyof typeof INTENT_KEYWORDS, matches };
      bestScore = score;
    }
  }

  // Determine if face analysis is needed
  const hasFaceAnalysisKeywords = FACE_ANALYSIS_KEYWORDS.some((k) => normalized.includes(k));
  const needsFaceAnalysis = hasFaceAnalysisKeywords || bestMatch?.type === 'hairstyle';

  // Determine if virtual try-on is eligible
  const hasVirtualTryOnKeywords = VIRTUAL_TRYON_KEYWORDS.some((k) => normalized.includes(k));
  const eligibleForVirtualTryOn = (bestMatch?.type === 'hairstyle' || bestMatch?.type === 'makeup') && hasVirtualTryOnKeywords;

  // Determine if images are needed
  const needsImages = bestMatch?.type === 'hairstyle' || bestMatch?.type === 'makeup';

  // Fallback type
  const type: QueryIntent['type'] = bestMatch ? (bestMatch.type === 'salon_search' ? 'salon_search' : bestMatch.type as QueryIntent['type']) : 'beauty_general';

  return {
    type,
    confidence: bestMatch ? Math.min(1, bestScore + (bestMatch.matches > 3 ? 0.2 : 0)) : 0.3,
    needsImages,
    needsFaceAnalysis,
    eligibleForVirtualTryOn,
    keywords: bestMatch ? INTENT_KEYWORDS[bestMatch.type] : [],
    details: {
      hasFaceAnalysisKeywords,
      hasVirtualTryOnKeywords,
      wordCount: words.length,
      detectedKeywords: FACE_ANALYSIS_KEYWORDS.filter((k) => normalized.includes(k)),
    },
  };
}

/**
 * Get image search keywords from query
 */
export function extractImageSearchKeywords(query: string, intentType: QueryIntent['type']): string {
  const normalized = query.toLowerCase().trim();

  // Detect gender for better targeting
  const isMen = normalized.includes('men') || normalized.includes('male') || normalized.includes('man') || 
                normalized.includes('boy') || normalized.includes('guy') || normalized.includes('beard') ||
                normalized.includes('mustache') || normalized.includes('barber');
  
  const genderPrefix = isMen ? 'men' : 'women';

  // Map intent types to default search keywords
  const defaults: Record<QueryIntent['type'], string> = {
    hairstyle: `${genderPrefix} hairstyle`,
    makeup: `${genderPrefix} makeup looks`,
    skincare: 'skincare facial treatment',
    salon_search: 'salon interior',
    beauty_general: 'beauty tips',
    off_topic: 'beauty',
  };

  // Extract specific keywords for hairstyle queries
  if (intentType === 'hairstyle') {
    // Check for "types of" queries
    if (normalized.includes('types') || normalized.includes('different') || normalized.includes('various')) {
      return `different types of ${genderPrefix} hairstyles`;
    }

    // Extract specific hairstyle names
    const hairstyleNames = [
      'bob', 'pixie', 'fade', 'undercut', 'buzz', 'crew cut', 'pompadour', 
      'quiff', 'layers', 'bangs', 'fringe', 'shag', 'mullet', 'mohawk',
      'braids', 'dreads', 'locs', 'afro', 'cornrows',
    ];
    
    const foundStyles = hairstyleNames.filter((name) => normalized.includes(name));
    if (foundStyles.length > 0) {
      return `${genderPrefix} ${foundStyles.slice(0, 2).join(' ')} hairstyle`;
    }

    // Extract hair characteristics
    if (normalized.includes('curly') || normalized.includes('wavy')) return `${genderPrefix} curly hairstyles`;
    if (normalized.includes('straight')) return `${genderPrefix} straight hairstyles`;
    if (normalized.includes('thick')) return `${genderPrefix} thick hair hairstyles`;
    if (normalized.includes('thin') || normalized.includes('fine')) return `${genderPrefix} thin hair hairstyles`;
    if (normalized.includes('long')) return `${genderPrefix} long hairstyles`;
    if (normalized.includes('short')) return `${genderPrefix} short hairstyles`;
    if (normalized.includes('medium')) return `${genderPrefix} medium hairstyles`;
    
    // Extract face shape
    if (normalized.includes('oval face')) return `${genderPrefix} hairstyles oval face`;
    if (normalized.includes('round face')) return `${genderPrefix} hairstyles round face`;
    if (normalized.includes('square face')) return `${genderPrefix} hairstyles square face`;
    if (normalized.includes('heart face')) return `${genderPrefix} hairstyles heart face`;
    
    // Hair color related
    if (normalized.includes('color') || normalized.includes('dye')) return `${genderPrefix} hair color styles`;
    
    return `${genderPrefix} hairstyle ideas`;
  }

  // Extract specific keywords for makeup queries
  if (intentType === 'makeup') {
    if (normalized.includes('bridal')) return 'bridal makeup looks';
    if (normalized.includes('party')) return 'party makeup looks';
    if (normalized.includes('natural')) return 'natural makeup tutorial';
    if (normalized.includes('smokey')) return 'smokey eye makeup';
    if (normalized.includes('bold')) return 'bold makeup looks';
    return `${genderPrefix} makeup inspiration`;
  }

  // Extract meaningful keywords from query
  const stopwords = new Set([
    'the', 'a', 'an', 'in', 'on', 'for', 'to', 'of', 'is', 'are', 'i', 'me', 'my', 'you', 'and', 'or',
    'that', 'this', 'what', 'which', 'who', 'why', 'how', 'when', 'where', 'with', 'without',
    'do', 'does', 'did', 'can', 'could', 'should', 'would', 'will', 'shall', 'have', 'has', 'had',
    'be', 'being', 'am', 'been', 'by', 'from', 'at', 'as', 'but', 'about', 'so', 'if', 'than', 'just',
  ]);

  const words = normalized
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopwords.has(w))
    .slice(0, 5);

  if (words.length > 0) {
    return words.join(' ');
  }

  return defaults[intentType];
}

/**
 * Determine if AI should be prompted to include images
 */
export function shouldIncludeImages(intent: QueryIntent): boolean {
  return intent.needsImages || intent.needsFaceAnalysis;
}

/**
 * Determine which CTA to show
 */
export function getCTAForIntent(intent: QueryIntent): { label: string; url: string } | null {
  if (intent.eligibleForVirtualTryOn && intent.type === 'hairstyle') {
    return {
      label: '✨ Try Virtual Try-On',
      url: '/virtual-tryon/women',
    };
  }

  if (intent.eligibleForVirtualTryOn && intent.type === 'makeup') {
    return {
      label: '💄 Virtual Makeup Try-On',
      url: '/virtual-tryon/women',
    };
  }

  if (intent.type === 'salon_search') {
    return {
      label: '🏪 Browse Salons',
      url: '/salons',
    };
  }

  return null;
}

/**
 * Generate AI prompt hint based on intent
 */
export function getIntentPromptHint(intent: QueryIntent): string {
  const hints: Record<QueryIntent['type'], string> = {
    hairstyle: `The user is asking about hairstyles. Be specific about face shapes, hair types, textures, and suitability. If they seem interested in trying styles, suggest the Virtual Try-On feature in your response.`,
    makeup: `The user is asking about makeup looks or techniques. Provide specific product recommendations and application tips. Suggest Virtual Try-On if they express interest in seeing themselves with makeup.`,
    skincare: `The user is asking about skincare or facial treatments. Provide product recommendations, treatment suggestions, and salon recommendations that offer these services.`,
    salon_search: `The user is looking for salon recommendations. Use the salon data provided to give specific salon names, areas, pricing, and why they'd be a good fit.`,
    beauty_general: `The user is asking a general beauty question. Provide comprehensive, structured advice using the response template.`,
    off_topic: `This query is off-topic. Politely redirect the user to beauty-related topics.`,
  };

  return hints[intent.type];
}
