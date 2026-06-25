export interface SearchImageResult {
  url: string;
  alt?: string;
  source?: 'duckduckgo' | 'google-cse' | 'bing' | 'pexels' | 'unsplash' | 'direct';
}

const COMMON_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'your', 'into', 'look', 'style', 'styles',
  'ideas', 'photos', 'images', 'image', 'hair', 'hairstyle', 'hairstyles', 'makeup', 'beauty',
  'popular', 'trending', 'different', 'best',
]);

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function cleanImageTitle(value: string | undefined, query: string): string {
  const fallback = query || 'Style inspiration';
  if (!value) return fallback;

  let title = decodeHtmlEntities(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  title = title
    .replace(/\b(stock photos?|royalty free|free photo|download|shutterstock|getty images|istock|pinterest)\b/gi, '')
    .replace(/\s+[|\-:]\s+(images?|photos?|picture|gallery).*$/i, '')
    .replace(/\s+[|\-:]\s+[A-Z][A-Za-z0-9 .&'-]{2,}$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!title || title.length < 4) return fallback;
  return title;
}

function getUrlKey(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url;
  }
}

function extractQueryTerms(query: string): string[] {
  return (query || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !COMMON_STOPWORDS.has(word));
}

function scoreImageCandidate(candidate: SearchImageResult, query: string): number {
  const title = cleanImageTitle(candidate.alt, query).toLowerCase();
  const terms = extractQueryTerms(query);

  let score = 0;
  for (const term of terms) {
    if (title.includes(term)) score += 4;
  }

  if (candidate.source === 'duckduckgo') score += 5;
  if (candidate.source === 'pexels') score += 3;
  if (candidate.source === 'google-cse') score += 2;

  if (/fade|undercut|crop|quiff|pompadour|bob|pixie|layers|wolf cut|butterfly|updo|braid/i.test(title)) {
    score += 4;
  }

  if (/salon interior|logo|banner|poster|template|cartoon|drawing|illustration/i.test(title)) {
    score -= 8;
  }

  return score;
}

function selectRelevantImages(candidates: SearchImageResult[], query: string, limit: number): SearchImageResult[] {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();

  return [...candidates]
    .sort((a, b) => scoreImageCandidate(b, query) - scoreImageCandidate(a, query))
    .filter((candidate) => {
      const url = candidate.url?.trim();
      if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) return false;

      const urlKey = getUrlKey(url);
      const titleKey = cleanImageTitle(candidate.alt, query).toLowerCase();
      if (seenUrls.has(urlKey) || seenTitles.has(titleKey)) return false;

      seenUrls.add(urlKey);
      seenTitles.add(titleKey);
      return true;
    })
    .slice(0, limit)
    .map((candidate) => ({
      ...candidate,
      alt: cleanImageTitle(candidate.alt, query),
    }));
}

function getRandomUnsplashId(index: number): string {
  const beautyPhotoIds = [
    '1595777707802-038daca6d617',
    '1562322140-8baeececf3df',
    '1560066984-138dadb4c035',
    '1522337660859-02fbefca4702',
    '1487412929920-4bfac01f4e1c',
    '1560869713-7d0a2994d2b6',
    '1519699047748-de8e457a634e',
    '1492105866014-42f3e6e0bbf1',
    '1521590832167-7bcbfaa6381f',
    '1562157873-8d943a674b19',
  ];
  return beautyPhotoIds[index % beautyPhotoIds.length];
}

async function extractDuckDuckGoVqd(query: string): Promise<string | null> {
  const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`;
  const response = await fetch(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://duckduckgo.com/',
      'DNT': '1',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    console.warn('[DuckDuckGo] Initial request failed:', response.status);
    return null;
  }

  const html = await response.text();
  const vqdPatterns = [
    /vqd=['"]([^'"]+)['"]/i,
    /"vqd"\s*:\s*"([^"]+)"/i,
    /vqd=([^&"'\\\s]+)/i,
    /data-vqd=['"]([^'"]+)['"]/i,
  ];

  for (const pattern of vqdPatterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

async function fetchDuckDuckGoImages(query: string, limit: number): Promise<SearchImageResult[]> {
  try {
    const vqd = await extractDuckDuckGoVqd(query);
    if (!vqd) {
      console.warn('[DuckDuckGo] Could not extract vqd token');
      return [];
    }

    const apiUrl = `https://duckduckgo.com/i.js?l=us-en&o=json&p=1&s=0&q=${encodeURIComponent(query)}&vqd=${encodeURIComponent(vqd)}&f=,,,%2C`;
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`,
        'X-Requested-With': 'XMLHttpRequest',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.warn('[DuckDuckGo] API request failed:', response.status);
      return [];
    }

    const data = await response.json();
    const results = Array.isArray(data?.results) ? data.results : [];

    return results.slice(0, Math.max(limit * 3, 18)).map((item: any) => ({
      url: item.image || item.thumbnail,
      alt: item.title || item.source || item.url || query,
      source: 'duckduckgo' as const,
    })).filter((item: SearchImageResult) => !!item.url && !String(item.url).includes('duckduckgo.com'));
  } catch (err) {
    console.warn('[DuckDuckGo Error]', String(err).slice(0, 150));
    return [];
  }
}

async function fetchGoogleCSE(query: string, limit: number): Promise<SearchImageResult[]> {
  try {
    const gKey = process.env.GOOGLE_CSE_KEY || 'AIzaSyBj0PG8Il4CG85kfGenpkr8VexmsxbRxDM';
    const gCx = process.env.GOOGLE_CSE_CX || '42662ccfb7ca74536';
    const url = `https://www.googleapis.com/customsearch/v1?key=${gKey}&cx=${gCx}&searchType=image&q=${encodeURIComponent(query)}&num=${Math.min(10, limit)}&safe=medium`;
    const response = await fetch(url, { cache: 'no-store' });

    if (!response.ok) {
      console.warn('[Google CSE] Failed with status:', response.status);
      return [];
    }

    const data = await response.json();
    return (data.items || []).slice(0, limit).map((item: any) => ({
      url: item.link || item.image?.thumbnailLink,
      alt: item.title || query,
      source: 'google-cse' as const,
    })).filter((item: SearchImageResult) => !!item.url);
  } catch (err) {
    console.warn('[Google CSE Error]', String(err).slice(0, 100));
    return [];
  }
}

async function fetchBingImages(query: string, limit: number): Promise<SearchImageResult[]> {
  try {
    const searchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}`;
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.warn('[Bing Images] Failed with status:', response.status);
      return [];
    }

    const html = await response.text();
    const matches = [...html.matchAll(/m='({[^']+})'/g)];
    const results: SearchImageResult[] = [];

    for (const match of matches) {
      try {
        const payload = JSON.parse(match[1]);
        const imageUrl = payload.murl || payload.turl;
        const title = payload.t || payload.desc || query;
        if (imageUrl) {
          results.push({ url: imageUrl, alt: title, source: 'bing' });
        }
      } catch {
        // Ignore malformed embedded JSON.
      }

      if (results.length >= limit) break;
    }

    return results;
  } catch (err) {
    console.warn('[Bing Images Error]', String(err).slice(0, 100));
    return [];
  }
}

async function fetchPexelsImages(query: string, limit: number): Promise<SearchImageResult[]> {
  try {
    const apiKey = process.env.PEXELS_API_KEY || 'Xbgcfm3qLZEI9OXBnN4Nt9wZGXlGBj1xd3aOI5pBP8lQOsSwHhSm0Oqj';
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${Math.min(15, limit)}&orientation=portrait`;
    const response = await fetch(url, {
      headers: {
        Authorization: apiKey,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.warn('[Pexels] Failed with status:', response.status);
      return [];
    }

    const data = await response.json();
    return (data.photos || []).slice(0, limit).map((photo: any) => ({
      url: photo.src?.large || photo.src?.medium || photo.src?.original,
      alt: photo.alt || query,
      source: 'pexels' as const,
    })).filter((item: SearchImageResult) => !!item.url);
  } catch (err) {
    console.warn('[Pexels Error]', String(err).slice(0, 100));
    return [];
  }
}

async function fetchDirectImageSearch(query: string, limit: number): Promise<SearchImageResult[]> {
  try {
    const searchUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${Math.min(10, limit)}&client_id=k-cYMnCKj4EBjPfFqaXp7uy4iyIkqbCUqhEVvSS4qr0`;
    const response = await fetch(searchUrl, { cache: 'no-store' });
    if (!response.ok) return [];

    const data = await response.json();
    return (data.results || []).slice(0, limit).map((photo: any) => ({
      url: photo.urls?.regular || photo.urls?.small,
      alt: photo.alt_description || query,
      source: 'direct' as const,
    })).filter((item: SearchImageResult) => !!item.url);
  } catch (err) {
    console.warn('[Direct Image Search Error]', String(err).slice(0, 100));
    return [];
  }
}

async function fetchUnsplash(query: string, limit: number): Promise<SearchImageResult[]> {
  try {
    const results: SearchImageResult[] = [];
    for (let index = 1; results.length < limit; index += 1) {
      results.push({
        url: `https://images.unsplash.com/photo-${getRandomUnsplashId(index)}?w=800&h=900&fit=crop&sig=${Date.now() + index}`,
        alt: query,
        source: 'unsplash',
      });
    }
    return results;
  } catch (err) {
    console.warn('[Unsplash Error]', String(err).slice(0, 100));
    return [];
  }
}

export async function getSearchImages(keywords: string, limit = 6): Promise<SearchImageResult[]> {
  const query = (keywords || 'beauty hair style').trim();
  console.log('[Image Sources] Starting fetch for query:', query);

  const settled = await Promise.allSettled([
    fetchDuckDuckGoImages(query, limit),
    fetchPexelsImages(query, limit),
    fetchGoogleCSE(query, limit),
    fetchBingImages(query, limit),
    fetchDirectImageSearch(query, limit),
    fetchUnsplash(query, limit),
  ]);

  const arrays: SearchImageResult[][] = settled.map((result) =>
    result.status === 'fulfilled' && Array.isArray(result.value) ? result.value : []
  );

  const combined = arrays.flat();
  const final = selectRelevantImages(combined, query, limit);

  console.log('[Image Sources] Final result:', {
    query,
    requested: limit,
    fetched: final.length,
    sources: {
      duckDuckGo: arrays[0]?.length || 0,
      pexels: arrays[1]?.length || 0,
      googleCSE: arrays[2]?.length || 0,
      bing: arrays[3]?.length || 0,
      directSearch: arrays[4]?.length || 0,
      unsplash: arrays[5]?.length || 0,
    },
  });

  return final;
}
