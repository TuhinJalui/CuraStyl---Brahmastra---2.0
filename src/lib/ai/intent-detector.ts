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
export function extractImageSearchKeywords(query: string, intentType: QueryIntent['type'], detectedGender?: 'male' | 'female' | null): string {
  const normalized = query.toLowerCase().trim();

  // Detect gender for better targeting
  // Priority 1: Use detected gender from image analysis
  let isMen = false;
  if (detectedGender === 'male') {
    isMen = true;
    console.log('[Keyword Extraction] Using detected gender: male');
  } else if (detectedGender === 'female') {
    isMen = false;
    console.log('[Keyword Extraction] Using detected gender: female');
  } else {
    // Priority 2: Detect from text
    const maleIndicators = ['men', 'male', 'man', 'boy', 'guy', 'beard', 'mustache', 'barber', 'gentlemen', 'him', 'his'];
    const femaleIndicators = ['women', 'woman', 'female', 'girl', 'lady', 'her', 'she'];
    
    const maleCount = maleIndicators.filter(w => normalized.includes(w)).length;
    const femaleCount = femaleIndicators.filter(w => normalized.includes(w)).length;
    
    if (maleCount > femaleCount) {
      isMen = true;
      console.log('[Keyword Extraction] Detected from text: male');
    } else if (femaleCount > 0) {
      isMen = false;
      console.log('[Keyword Extraction] Detected from text: female');
    } else {
      // Default to women for beauty queries
      isMen = false;
      console.log('[Keyword Extraction] No gender detected, defaulting to: female');
    }
  }
  
  const genderPrefix = isMen ? 'men' : 'women';
  const genderSuffix = isMen ? 'mens' : 'womens';

  // Map intent types to default search keywords
  const defaults: Record<QueryIntent['type'], string> = {
    hairstyle: `${genderPrefix} hairstyle ideas professional`,
    makeup: `${genderPrefix} makeup looks beautiful`,
    skincare: 'skincare facial treatment results',
    salon_search: 'salon interior professional',
    beauty_general: 'beauty styling professional',
    off_topic: 'beauty',
  };

  // Extract specific keywords for hairstyle queries
  if (intentType === 'hairstyle') {
    // Check for "types of" queries - these need maximum variety
    if (normalized.includes('types') || normalized.includes('different') || normalized.includes('various') || 
        normalized.includes('variety') || normalized.includes('many') || normalized.includes('all kinds')) {
      return `different types of ${genderPrefix} hairstyles popular trending ${new Date().getFullYear()}`;
    }

    // Extract specific hairstyle names
    const hairstyleNames = isMen ? [
      'fade', 'undercut', 'buzz cut', 'crew cut', 'pompadour', 'quiff', 'comb over', 'taper',
      'side part', 'slick back', 'mohawk', 'faux hawk', 'french crop', 'textured crop', 'mullet',
      'caesar cut', 'ivy league', 'brush up', 'spiky', 'messy', 'man bun', 'top knot',
    ] : [
      'bob', 'pixie', 'layers', 'bangs', 'shag', 'lob', 'blunt', 'textured',
      'fringe', 'curtain bangs', 'butterfly', 'wolf cut', 'mullet', 'shaggy', 'beachy waves',
      'sleek', 'voluminous', 'braids', 'updo', 'ponytail', 'half up', 'bun',
    ];
    
    const foundStyles = hairstyleNames.filter((name) => normalized.includes(name));
    if (foundStyles.length > 0) {
      return `${genderPrefix} ${foundStyles.slice(0, 2).join(' ')} hairstyle professional ${genderSuffix}`;
    }

    // Extract hair characteristics
    if (normalized.includes('curly') || normalized.includes('wavy') || normalized.includes('coily')) {
      return `${genderPrefix} curly hairstyles beautiful natural texture ${genderSuffix}`;
    }
    if (normalized.includes('straight')) {
      return `${genderPrefix} straight hairstyles sleek modern ${genderSuffix}`;
    }
    if (normalized.includes('thick') || normalized.includes('dense')) {
      return `${genderPrefix} thick hair hairstyles voluminous styling ${genderSuffix}`;
    }
    if (normalized.includes('thin') || normalized.includes('fine')) {
      return `${genderPrefix} thin fine hair hairstyles flattering volume ${genderSuffix}`;
    }
    if (normalized.includes('long')) {
      return `${genderPrefix} long hairstyles beautiful flowing ${genderSuffix}`;
    }
    if (normalized.includes('short')) {
      return `${genderPrefix} short hairstyles stylish modern ${genderSuffix}`;
    }
    if (normalized.includes('medium') || normalized.includes('shoulder length')) {
      return `${genderPrefix} medium length hairstyles versatile ${genderSuffix}`;
    }
    
    // Extract face shape - very important for good recommendations
    if (normalized.includes('oval')) return `${genderPrefix} hairstyles oval face flattering ${genderSuffix}`;
    if (normalized.includes('round')) return `${genderPrefix} hairstyles round face slimming ${genderSuffix}`;
    if (normalized.includes('square')) return `${genderPrefix} hairstyles square face softening ${genderSuffix}`;
    if (normalized.includes('heart')) return `${genderPrefix} hairstyles heart face balancing ${genderSuffix}`;
    if (normalized.includes('diamond')) return `${genderPrefix} hairstyles diamond face elegant ${genderSuffix}`;
    if (normalized.includes('oblong') || normalized.includes('long face')) {
      return `${genderPrefix} hairstyles oblong face width ${genderSuffix}`;
    }
    
    // Hair color related
    if (normalized.includes('color') || normalized.includes('dye') || normalized.includes('highlight') || 
        normalized.includes('balayage') || normalized.includes('ombre')) {
      return `${genderPrefix} hair color styles trendy beautiful ${genderSuffix}`;
    }
    
    // Age-specific
    if (normalized.includes('teen') || normalized.includes('young')) {
      return `young ${genderPrefix} hairstyles trendy modern ${genderSuffix}`;
    }
    if (normalized.includes('mature') || normalized.includes('older') || normalized.includes('50') || 
        normalized.includes('60')) {
      return `elegant ${genderPrefix} hairstyles mature sophisticated ${genderSuffix}`;
    }
    
    // Event-specific
    if (normalized.includes('wedding') || normalized.includes('bridal')) {
      return `${genderPrefix} wedding hairstyles elegant bridal ${genderSuffix}`;
    }
    if (normalized.includes('party') || normalized.includes('event')) {
      return `${genderPrefix} party hairstyles glamorous ${genderSuffix}`;
    }
    if (normalized.includes('casual') || normalized.includes('everyday')) {
      return `${genderPrefix} everyday hairstyles easy simple ${genderSuffix}`;
    }
    
    return `${genderPrefix} hairstyle ideas trending inspiration professional ${genderSuffix}`;
  }

  // Extract specific keywords for makeup queries
  if (intentType === 'makeup') {
    if (normalized.includes('types') || normalized.includes('different') || normalized.includes('various')) {
      return 'different types of makeup looks styles trending';
    }
    if (normalized.includes('bridal') || normalized.includes('wedding')) {
      return 'bridal makeup looks stunning elegant wedding';
    }
    if (normalized.includes('party') || normalized.includes('night out')) {
      return 'party makeup looks glamorous dramatic evening';
    }
    if (normalized.includes('natural') || normalized.includes('everyday') || normalized.includes('simple')) {
      return 'natural makeup tutorial simple everyday fresh';
    }
    if (normalized.includes('smokey') || normalized.includes('smoky')) {
      return 'smokey eye makeup dramatic sultry';
    }
    if (normalized.includes('bold') || normalized.includes('colorful') || normalized.includes('bright')) {
      return 'bold makeup looks colorful creative artistic';
    }
    if (normalized.includes('nude') || normalized.includes('minimal')) {
      return 'nude makeup minimal natural beauty';
    }
    if (normalized.includes('glam') || normalized.includes('glamorous')) {
      return 'glam makeup looks glamorous hollywood';
    }
    if (normalized.includes('eye')) {
      return 'eye makeup looks beautiful creative';
    }
    if (normalized.includes('lip')) {
      return 'lip makeup looks lipstick styles';
    }
    if (normalized.includes('contour')) {
      return 'contouring makeup techniques sculpted';
    }
    
    return `${genderPrefix} makeup inspiration beautiful professional looks`;
  }

  // Extract meaningful keywords from query
  const stopwords = new Set([
    'the', 'a', 'an', 'in', 'on', 'for', 'to', 'of', 'is', 'are', 'i', 'me', 'my', 'you', 'and', 'or',
    'that', 'this', 'what', 'which', 'who', 'why', 'how', 'when', 'where', 'with', 'without',
    'do', 'does', 'did', 'can', 'could', 'should', 'would', 'will', 'shall', 'have', 'has', 'had',
    'be', 'being', 'am', 'been', 'by', 'from', 'at', 'as', 'but', 'about', 'so', 'if', 'than', 'just',
    'want', 'need', 'find', 'show', 'tell', 'give', 'get', 'make', 'look', 'see', 'know', 'think',
  ]);

  const words = normalized
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopwords.has(w))
    .slice(0, 5);

  if (words.length > 0) {
    return words.join(' ') + ` ${genderPrefix} style professional`;
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
