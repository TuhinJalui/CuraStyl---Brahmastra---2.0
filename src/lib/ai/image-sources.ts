import fs from 'fs';
import path from 'path';

// Helper to extract DuckDuckGo vqd token
async function extractDuckDuckGoVqd(query: string): Promise<string | null> {
  try {
    const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`;
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://duckduckgo.com/',
        'DNT': '1',
      },
      cache: 'no-store',
    });

    if (!response.ok) return null;

    const html = await response.text();
    const vqdPatterns = [
      /vqd=['"]([^'"]+)['"]/i,
      /"vqd"\s*:\s*"([^"]+)"/i,
      /vqd=([^&"'\\\s]+)/i,
      /data-vqd=['"]([^'"]+)['"]/i,
    ];

    for (const pattern of vqdPatterns) {
      const match = html.match(pattern);
      if (match?.[1]) return match[1];
    }
  } catch (err) {
    console.warn('[DuckDuckGo vqd] Failed to extract vqd token:', err);
  }
  return null;
}

// Main image fetch function
export async function getSearchImages(keywords: string, limit = 6) {
  const query = (keywords || "beauty hair style").trim();
  const final: { url: string; alt?: string }[] = [];
  const seen = new Set<string>();

  const pushUnique = (u?: string, alt?: string) => {
    if (!u) return;
    if (!u.startsWith('http://') && !u.startsWith('https://')) return;
    if (seen.has(u)) return;
    seen.add(u);
    final.push({ url: u, alt: alt || query });
  };

  // Primary: Google Custom Search Engine
  const fetchGoogleCSE = async () => {
    try {
      const gKey = process.env.GOOGLE_CSE_KEY || "AIzaSyBj0PG8Il4CG85kfGenpkr8VexmsxbRxDM";
      const gCx = process.env.GOOGLE_CSE_CX || "42662ccfb7ca74536";
      
      const url = `https://www.googleapis.com/customsearch/v1?key=${gKey}&cx=${gCx}&searchType=image&q=${encodeURIComponent(query)}&num=${Math.min(10, limit)}&safe=medium`;
      const r = await fetch(url);
      if (!r.ok) {
        console.warn('[Google CSE] Failed with status:', r.status);
        return [];
      }
      const j = await r.json();
      const results = (j.items || []).slice(0, limit).map((it: any) => {
        const imageUrl = it.link || (it.image && it.image.thumbnailLink);
        return { 
          url: imageUrl, 
          alt: it.title || query 
        };
      }).filter((img: any) => img.url);
      console.log('[Google CSE] Fetched:', results.length);
      return results;
    } catch (err) {
      console.warn('[Google CSE Error]', String(err).slice(0, 100));
      return [];
    }
  };

  // Secondary: Bing Image Search Scraper
  const fetchBingImages = async () => {
    try {
      const searchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}`;
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (!response.ok) {
        console.warn('[Bing Images] Failed with status:', response.status);
        return [];
      }
      
      const html = await response.text();
      const imgRegex = /src="([^"]*\.(jpg|jpeg|png|webp)[^"]*)"/gi;
      const matches = html.match(imgRegex) || [];
      
      const results = matches
        .slice(0, limit)
        .map(match => {
          const url = match.replace('src="', '').replace('"', '');
          if (url.length < 50 || url.includes('1x1') || url.includes('pixel')) return null;
          return { url, alt: query };
        })
        .filter(Boolean);
      
      console.log('[Bing Images] Fetched:', results.length);
      return results;
    } catch (err) {
      console.warn('[Bing Images Error]', String(err).slice(0, 100));
      return [];
    }
  };

  // Tertiary: DuckDuckGo API (vqd + i.js endpoint - highly reliable)
  const fetchDuckDuckGoImages = async () => {
    try {
      const vqd = await extractDuckDuckGoVqd(query);
      if (!vqd) {
        console.warn('[DuckDuckGo] Could not extract vqd token');
        return [];
      }

      const apiUrl = `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}&f=,,,&p=1`;
      const response = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': `https://duckduckgo.com/`,
          'X-Requested-With': 'XMLHttpRequest',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        console.warn('[DuckDuckGo API] Request failed:', response.status);
        return [];
      }

      const data = await response.json();
      const results: { url: string; alt: string }[] = [];
      const dataResults = Array.isArray(data?.results) ? data.results : [];

      for (const item of dataResults) {
        if (results.length >= limit) break;
        const imageUrl = item.image || item.thumbnail || item.url;
        const title = item.title || item.source || query;
        if (imageUrl && imageUrl.startsWith('http') && !imageUrl.includes('duckduckgo.com')) {
          results.push({ url: imageUrl, alt: title });
        }
      }

      console.log('[DuckDuckGo API] Fetched:', results.length);
      return results;
    } catch (err) {
      console.warn('[DuckDuckGo API Error]', String(err).slice(0, 150));
      return [];
    }
  };

  // Quaternary: Direct Search (Unsplash search API)
  const fetchDirectImageSearch = async () => {
    try {
      const searchUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${Math.min(10, limit)}&client_id=k-cYMnCKj4EBjPfFqaXp7uy4iyIkqbCUqhEVvSS4qr0`;
      const r = await fetch(searchUrl);
      if (!r.ok) return [];
      const j = await r.json();
      const results = (j.results || []).slice(0, limit).map((photo: any) => ({
        url: photo.urls?.regular || photo.urls?.small,
        alt: photo.alt_description || query
      })).filter((img: any) => img.url);
      console.log('[Direct Image Search] Fetched:', results.length);
      return results;
    } catch (err) {
      console.warn('[Direct Image Search Error]', String(err).slice(0, 100));
      return [];
    }
  };

  // Quinary: Unsplash Hardcoded Fallback (Guaranteed to resolve if searches fail)
  const fetchUnsplash = async () => {
    try {
      const isHairQuery = /hair|cut|fade|undercut|shag|style|bob|pixie|braid|color/i.test(query);
      const isMakeupQuery = /makeup|lash|liner|lipstick|eyebrow/i.test(query);

      // Dedicated hairstyle fallbacks (strict no salon interiors)
      const hairPhotoIds = [
        '1595777707802-038daca6d617', // Hair styling
        '1560066984-138dadb4c035', // Hair cut
        '1560869713-7d0a2994d2b6', // Hair care
        '1521590832167-7bcbfaa6381f', // Hair model
        '1519699047748-de8e457a634e', // Styling hair
        '1605497746444-ac9f564704f1', // Hairstyle close up
      ];

      // Dedicated makeup fallbacks
      const makeupPhotoIds = [
        '1522337660859-02fbefca4702', // Makeup application
        '1487412929920-4bfac01f4e1c', // Beauty model
        '1515688594390-b649af70d282', // Eye makeup close up
        '1526047932273-341f2a7631f9', // Cosmetics
      ];

      // Generic fallback (only salon searches will get salon interiors)
      const genericPhotoIds = [
        '1562322140-8baeececf3df', // Beauty salon interior
        '1492105866014-42f3e6e0bbf1', // Salon setup
        '1562157873-8d943a674b19', // Treatment room
      ];

      let targetIds = genericPhotoIds;
      if (isHairQuery) {
        targetIds = hairPhotoIds;
      } else if (isMakeupQuery) {
        targetIds = makeupPhotoIds;
      }

      const out: { url: string; alt?: string }[] = [];
      for (let i = 1; out.length < limit && i <= limit * 3; i++) {
        const photoId = targetIds[(i - 1) % targetIds.length];
        const url = `https://images.unsplash.com/photo-${photoId}?w=800&h=600&fit=crop&sig=${Date.now() + i}`;
        out.push({ url, alt: query });
      }
      console.log('[Unsplash Fallback] Generated:', out.length);
      return out;
    } catch (err) {
      console.warn('[Unsplash Fallback Error]', String(err).slice(0, 100));
      return [];
    }
  };

  // Execute all active searches & fallbacks in parallel
  console.log('[Image Sources] Starting fetch for query:', query);
  const settled = await Promise.allSettled([
    fetchGoogleCSE(),
    fetchBingImages(),
    fetchDuckDuckGoImages(),
    fetchDirectImageSearch(),
    fetchUnsplash(),
  ]);

  const arrays: { url: string; alt?: string }[][] = settled.map((s) => 
    s.status === 'fulfilled' && Array.isArray(s.value) ? s.value : []
  );

  // Interleave active search sources first (indexes 0, 1, 2, 3) to balance diversity
  let idx = 0;
  while (final.length < limit) {
    let added = false;
    for (let i = 0; i < 4; i++) {
      const item = arrays[i][idx];
      if (item) {
        pushUnique(item.url, item.alt);
        added = true;
        if (final.length >= limit) break;
      }
    }
    if (!added) break;
    idx++;
  }

  // Only if we don't have enough images, fall back to hardcoded Unsplash IDs (index 4)
  if (final.length < limit) {
    let uIdx = 0;
    while (final.length < limit && uIdx < arrays[4].length) {
      const item = arrays[4][uIdx];
      if (item) {
        pushUnique(item.url, item.alt);
      }
      uIdx++;
    }
  }

  console.log('[Image Sources] Final result:', {
    query,
    requested: limit,
    fetched: final.length,
    sources: {
      googleCSE: arrays[0]?.length || 0,
      bing: arrays[1]?.length || 0,
      duckDuckGo: arrays[2]?.length || 0,
      directSearch: arrays[3]?.length || 0,
      unsplashFallback: arrays[4]?.length || 0,
    }
  });

  return final.slice(0, limit);
}
