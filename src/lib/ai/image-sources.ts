// Helper to fetch image fallbacks from multiple public sources.
// Attempts Google CSE (via custom search), Bing Image Search fallback, and Unsplash guaranteed
// Returns array of { url, alt }
export async function getSearchImages(keywords: string, limit = 6) {
  const query = (keywords || "beauty hair style").trim();
  const final: { url: string; alt?: string }[] = [];
  const seen = new Set<string>();

  const pushUnique = (u?: string, alt?: string) => {
    if (!u) return;
    // Skip invalid URLs
    if (!u.startsWith('http://') && !u.startsWith('https://')) return;
    if (seen.has(u)) return;
    seen.add(u);
    final.push({ url: u, alt: alt || query });
  };

  // Primary: Google Custom Search Engine (has fallback hardcoded keys)
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

  // Secondary: Bing Image Search (public endpoint, more reliable than DuckDuckGo)
  const fetchBingImages = async () => {
    try {
      // Using Bing's search page to scrape image URLs
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
      // Extract image URLs from mimg src attributes
      const imgRegex = /src="([^"]*\.(jpg|jpeg|png|webp)[^"]*)"/gi;
      const matches = html.match(imgRegex) || [];
      
      const results = matches
        .slice(0, limit)
        .map(match => {
          const url = match.replace('src="', '').replace('"', '');
          // Filter out small thumbnails and tracking pixels
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

  // Secondary Alternative: DuckDuckGo Image Search (Simple direct scraping)
  const fetchDuckDuckGoImages = async () => {
    try {
      // Use DuckDuckGo's direct image search page
      const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`;
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        }
      });
      
      if (!response.ok) {
        console.warn('[DuckDuckGo] Failed with status:', response.status);
        return [];
      }
      
      const html = await response.text();
      const results: { url: string; alt: string }[] = [];
      const seenUrls = new Set<string>();
      
      // Extract image URLs from various patterns in the HTML
      // Pattern 1: Direct image URLs in thumbnail links
      const urlPattern = /https?:\/\/[^\s"'<>]+\.(jpg|jpeg|png|webp|gif)(?:\?[^\s"'<>]*)?/gi;
      const matches = html.match(urlPattern) || [];
      
      for (const url of matches) {
        // Skip DuckDuckGo's own assets and tiny images
        if (url.includes('duckduckgo.com') || 
            url.includes('icons.') || 
            url.includes('favicon') ||
            url.includes('logo') ||
            url.length < 40) {
          continue;
        }
        
        // Clean up the URL
        const cleanUrl = url.split(/[\s"'<>]/)[0];
        
        if (!seenUrls.has(cleanUrl) && cleanUrl.startsWith('http')) {
          seenUrls.add(cleanUrl);
          results.push({ url: cleanUrl, alt: query });
          
          if (results.length >= limit) break;
        }
      }
      
      console.log('[DuckDuckGo Images] Extracted:', results.length, 'unique images');
      return results;
    } catch (err) {
      console.warn('[DuckDuckGo Images Error]', String(err).slice(0, 150));
      return [];
    }
  };

  // Tertiary: Unsplash (using official API for reliability)
  const fetchUnsplash = async () => {
    try {
      // Use Unsplash's official source API with random parameter to get different images
      const out: { url: string; alt?: string }[] = [];
      for (let i = 1; out.length < limit && i <= limit * 3; i++) {
        // Use images.unsplash.com which is more reliable than source.unsplash.com
        const url = `https://images.unsplash.com/photo-${getRandomUnsplashId(i)}?w=800&h=600&fit=crop&sig=${Date.now() + i}`;
        out.push({ url, alt: query });
      }
      console.log('[Unsplash] Generated:', out.length);
      return out.slice(0, limit);
    } catch (err) {
      console.warn('[Unsplash Error]', String(err).slice(0, 100));
      return [];
    }
  };

  // Helper to generate random Unsplash photo IDs for beauty/hair related images
  function getRandomUnsplashId(index: number): string {
    // Predefined list of Unsplash photo IDs for beauty/hair related images
    const beautyPhotoIds = [
      '1595777707802-038daca6d617', // Hair styling
      '1562322140-8baeececf3df', // Beauty salon
      '1560066984-138dadb4c035', // Hair cut
      '1522337660859-02fbefca4702', // Makeup
      '1487412929920-4bfac01f4e1c', // Beauty
      '1560869713-7d0a2994d2b6', // Hair care
      '1519699047748-de8e457a634e', // Styling
      '1492105866014-42f3e6e0bbf1', // Salon
      '1521590832167-7bcbfaa6381f', // Hair
      '1562157873-8d943a674b19', // Beauty treatment
    ];
    return beautyPhotoIds[index % beautyPhotoIds.length];
  }

  // Fallback: Direct image search using alternative method
  const fetchDirectImageSearch = async () => {
    try {
      // Using a public image API endpoint
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

  // Execute all fetches in parallel
  console.log('[Image Sources] Starting fetch for query:', query);
  const settled = await Promise.allSettled([
    fetchGoogleCSE(),
    fetchBingImages(),
    fetchDuckDuckGoImages(),
    fetchDirectImageSearch(),
    fetchUnsplash(), // Always run as final fallback
  ]);

  const arrays: { url: string; alt?: string }[][] = settled.map((s) => 
    s.status === 'fulfilled' && Array.isArray(s.value) ? s.value : []
  );

  // Interleave results from all sources to balance diversity
  let idx = 0;
  while (final.length < limit) {
    let added = false;
    for (let i = 0; i < arrays.length; i++) {
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

  console.log('[Image Sources] Final result:', {
    query,
    requested: limit,
    fetched: final.length,
    sources: {
      googleCSE: arrays[0]?.length || 0,
      bing: arrays[1]?.length || 0,
      duckDuckGo: arrays[2]?.length || 0,
      directSearch: arrays[3]?.length || 0,
      unsplash: arrays[4]?.length || 0,
    }
  });

  return final.slice(0, limit);
}
