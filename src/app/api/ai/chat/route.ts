import { NextRequest, NextResponse } from "next/server";
import { generateWithRetry } from "@/lib/ai/gemini-client";
import { getSearchImages } from '@/lib/ai/image-sources';
import { detectIntent, extractImageSearchKeywords, getIntentPromptHint } from "@/lib/ai/intent-detector";
import { planResponse, getVisualHints } from "@/lib/ai/response-planner";
import { createServerClient } from "@supabase/ssr";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const SYSTEM_PROMPT = `You are AuraAI ✨, an expert beauty advisor for CuraStyl — a premium salon marketplace in Mumbai, India.

Your job is to help users:
1. 💅 Find the best salons based on their needs (budget, location, service type, rating)
2. 💇 Recommend beauty treatments and services tailored to their needs
3. 👗 Give beauty tips and styling advice
4. 💍 Help with bridal and event styling queries
5. 🧴 Explain what treatments are best for specific hair/skin types

Available areas in Mumbai: Bandra, Andheri, Powai, Juhu, Versova, Malad, Borivali, Dadar, Worli, Lower Parel, Colaba, Santacruz, Vile Parle, Chembur.

Services available: Haircut, Hair Color, Facial, Makeup, Spa, Manicure, Pedicure, Waxing, Threading, Massage, Bridal Package, Hair Treatment, Nail Art.

🎯 CRITICAL: ALWAYS ASK FOR GENDER/PREFERENCES FIRST
- If user asks about hairstyles/makeup/beauty: FIRST ask "Are you looking for men's or women's styles?" or "What's your gender?"
- DO NOT give generic responses without understanding their needs
- Wait for clarification before providing recommendations
- This helps show MORE RELEVANT images and advice

When recommending salons, include:
- 📍 Salon name and area
- ⭐ Rating and price range  
- 💼 What they specialize in
- 🎯 A "Book Now" suggestion with the salon slug like: [Book at salon-name](/salons/salon-slug)

Always be warm, helpful, and specific with recommendations. Include pricing when relevant (Indian Rupees ₹). Keep responses concise but helpful.

Use relevant emojis naturally:
- 💇‍♀️💇‍♂️ for hairstyle/haircut queries
- 💄💋 for makeup queries
- 🧴✨ for skincare/glow queries
- 💅 for nails
- 👰💍 for bridal/wedding queries
- 📍🏪 for salon/location queries`;

// Additional guidance: use emojis naturally in text where relevant, prefer plain text (avoid visible Markdown like **bold**),
// make replies visually friendly and engaging, include helpful recommendations with images/styles.

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}

async function getUserContext() {
  try {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return "";

    // Fetch recent bookings for personalization
    const { data: bookings } = await supabase
      .from("bookings")
      .select("booking_date, service:services(name, category), salon:salons(name, area)")
      .eq("user_id", user.id)
      .order("booking_date", { ascending: false })
      .limit(5);

    // Fetch favorites
    const { data: favorites } = await supabase
      .from("favorites")
      .select("salon:salons(name, area)")
      .eq("user_id", user.id)
      .limit(5);

    let context = "\n\n--- USER CONTEXT (personalize your responses based on this) ---\n";

    if (bookings && bookings.length > 0) {
      context += "\nRecent bookings:\n";
      bookings.forEach((b: any) => {
        const serviceName = Array.isArray(b.service) ? b.service[0]?.name : b.service?.name;
        const salonName = Array.isArray(b.salon) ? b.salon[0]?.name : b.salon?.name;
        context += `- ${serviceName ?? "Unknown"} at ${salonName ?? "Unknown"} (${b.booking_date})\n`;
      });
    }

    if (favorites && favorites.length > 0) {
      context += "\nFavorited salons:\n";
      favorites.forEach((f: any) => {
        const salonName = Array.isArray(f.salon) ? f.salon[0]?.name : f.salon?.name;
        const salonArea = Array.isArray(f.salon) ? f.salon[0]?.area : f.salon?.area;
        context += `- ${salonName ?? "Unknown"} (${salonArea ?? ""})\n`;
      });
    }

    return context;
  } catch {
    return "";
  }
}

// Fetch stored memory for a user via Supabase service role key (best-effort)
async function getMemoryForUserId(userId: string) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return "";

    const svc = createServiceClient(url, key);
    const { data, error } = await svc
      .from('ai_memory')
      .select('memory')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) {
      console.warn('Memory fetch error:', error.message || error);
      return "";
    }
    if (!data || data.length === 0) return "";

    const mem = data[0]?.memory;
    if (!mem) return "";
    if (typeof mem === 'string') return mem;
    return mem.contextSummary || JSON.stringify(mem);
  } catch (err) {
    console.warn('Failed to fetch memory for user:', err);
    return "";
  }
}

async function getRealSalonData() {
  try {
    const supabase = await getSupabase();
    const { data: salons } = await supabase
      .from("salons")
      .select("name, slug, area, category, rating, review_count, starting_price, is_verified, cover_image")
      .eq("is_active", true)
      .order("rating", { ascending: false })
      .limit(20);

    if (salons && salons.length > 0) {
      let salonContext = "\n\n--- REAL SALON DATA (use this instead of hardcoded samples) ---\n";
      salons.forEach((s: { name: string; slug: string; area: string; category: string; rating: number; review_count: number; starting_price: number; is_verified: boolean; cover_image?: string }) => {
        salonContext += `- ${s.name} (${s.area}) — ${s.category}, ⭐${s.rating} (${s.review_count} reviews), from ₹${s.starting_price}${s.is_verified ? ', Verified' : ''}, slug: ${s.slug}${s.cover_image ? `, image: ${s.cover_image}` : ''}\n`;
      });
      return salonContext;
    }
  } catch {
    // Fallback to static data in system prompt
  }
  return "";
}

// Helper function to fetch salon images for recommended salons
async function getSalonImages(salonNames: string[]): Promise<{ name: string; image: string }[]> {
  const results: { name: string; image: string }[] = [];
  
  try {
    const supabase = await getSupabase();
    
    for (const name of salonNames) {
      const { data } = await supabase
        .from("salons")
        .select("name, cover_image")
        .ilike("name", `%${name}%`)
        .eq("is_active", true)
        .limit(1);
      
      if (data && data.length > 0 && data[0].cover_image) {
        results.push({ name: data[0].name, image: data[0].cover_image });
      }
    }
  } catch (err) {
    console.warn('[Salon Images Error]', err);
  }
  
  return results;
}

// Extract salon names from user query or AI response
function extractSalonNames(text: string): string[] {
  const salonKeywords = ['toni & guy', 'lakme', 'looks', 'juice', 'bblunt', 'loreal', 'matrix', 'schwarzkopf', 'wella', 'kerastase'];
  const found: string[] = [];
  
  const lowerText = text.toLowerCase();
  for (const keyword of salonKeywords) {
    if (lowerText.includes(keyword)) {
      found.push(keyword);
    }
  }
  
  // Also try to extract salon names that appear to be proper nouns (capitalized words)
  const properNouns = text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g) || [];
  for (const noun of properNouns) {
    if (noun.length > 2 && !found.includes(noun.toLowerCase())) {
      found.push(noun);
    }
  }
  
  return found.slice(0, 3); // Limit to 3 salon names
}

function classifyQuery(text: string) {
  const t = (text || "").toLowerCase().trim();
  if (!t) return { type: "simple", reason: "empty", score: 0 };

  const complexIndicators = [
    "how to",
    "step",
    "steps",
    "plan",
    "detailed",
    "compare",
    "vs",
    "versus",
    "best way",
    "recommendation",
    "bridal",
    "bridal package",
    "wedding",
    "routine",
    "regimen",
    "long-term",
  ];

  const indicatorScore = complexIndicators.reduce((acc, k) => acc + (t.includes(k) ? 1 : 0), 0);
  const sentenceCount = (t.match(/[\.\?\!]+/g) || []).length + 1;
  const lengthScore = Math.min(1, t.length / 120);
  const conjunctions = (t.match(/\band\b|\bor\b|,|;/g) || []).length;

  const score = Math.min(1, (indicatorScore * 0.5) + (sentenceCount > 1 ? 0.2 : 0) + Math.min(0.3, lengthScore) + Math.min(0.2, conjunctions * 0.05));

  const type = (indicatorScore > 0 || sentenceCount > 2 || t.length > 140 || conjunctions >= 2) ? "complex" : "simple";

  return { type, reason: indicatorScore > 0 ? "contains_complex_indicators" : sentenceCount > 2 ? "multiple_sentences" : t.length > 140 ? "long_text" : "short", score };
}

// Calculate dynamic token limit based on query complexity and intent
function calculateDynamicTokens(queryText: string, queryIntent: any): number {
  const complexity = classifyQuery(queryText);
  let baseTokens = 1200;

  // Adjust based on query complexity
  if (complexity.type === "complex") {
    baseTokens = 2000; // More tokens for complex, multi-part queries
  } else if (complexity.score > 0.6) {
    baseTokens = 1800;
  }

  // Adjust based on intent type
  switch (queryIntent.type) {
    case "hairstyle":
    case "makeup":
      baseTokens = Math.max(baseTokens, 1500); // Need detailed recommendations
      break;
    case "skincare":
      baseTokens = Math.max(baseTokens, 1400);
      break;
    case "salon_search":
      baseTokens = Math.max(baseTokens, 1300); // Salon info takes less tokens
      break;
    case "beauty_general":
      baseTokens = Math.max(baseTokens, 1200);
      break;
    default:
      baseTokens = Math.max(baseTokens, 1000);
  }

  return Math.min(baseTokens, 2500); // Cap at 2500 for safety
}

// Generate descriptive titles for images based on query intent and gender
function generateImageTitles(queryIntent: any, imageCount: number, detectedGender?: 'male' | 'female' | null, userQuery?: string): string[] {
  const titles: string[] = [];
  
  if (queryIntent.type === 'hairstyle') {
    // Determine gender-specific hairstyle titles
    const isMale = detectedGender === 'male' || (userQuery && (
      userQuery.toLowerCase().includes('men') || 
      userQuery.toLowerCase().includes('male') || 
      userQuery.toLowerCase().includes('guy') ||
      userQuery.toLowerCase().includes('barber') ||
      userQuery.toLowerCase().includes('gentleman')
    ));
    
    const mensHairstyles = [
      'Classic Taper Fade',
      'Textured Crop Style',
      'Modern Undercut',
      'Slicked Back Pompadour',
      'Low Fade with Texture',
      'Messy Quiff Look',
      'Side Part Gentleman Cut',
      'High and Tight Military',
      'French Crop Modern',
      'Mid Fade with Volume',
      'Comb Over Fade Style',
      'Faux Hawk Design',
      'Long Top Short Sides',
      'Spiky Textured Hair',
      'Buzz Cut with Line Up',
      'Crew Cut Variation',
      'Caesar Cut Classic',
      'Ivy League Style',
      'Brush Up with Fade',
      'Man Bun with Fade',
      'Mohawk Fade Style',
      'Angular Fringe Cut',
      'Disconnected Undercut',
      'Slick Back Fade',
      'Wavy Textured Style',
    ];
    
    const womensHairstyles = [
      'Layered Waves with Volume',
      'Sleek Bob Haircut',
      'Modern Pixie Cut',
      'Long Flowing Layers',
      'Textured Shag Style',
      'Bouncy Curly Look',
      'Side-Swept Bangs Style',
      'Beach Waves Hair',
      'Blunt Cut with Fringe',
      'Balayage Highlights',
      'Soft Romantic Curls',
      'Asymmetric Bob Cut',
      'Natural Texture Style',
      'Voluminous Blowout',
      'Braided Crown Look',
      'Butterfly Haircut',
      'Wolf Cut Layers',
      'Curtain Bangs Style',
      'Lob with Waves',
      'Sleek Straight Hair',
      'Messy Bun Updo',
      'Half-Up Half-Down',
      'French Twist Elegant',
      'Fishtail Braid Style',
      'Top Knot Modern',
    ];
    
    const selectedTitles = isMale ? mensHairstyles : womensHairstyles;
    
    // Shuffle for variety and freshness
    const shuffled = [...selectedTitles].sort(() => Math.random() - 0.5);
    const finalTitles = shuffled.slice(0, Math.min(imageCount, shuffled.length));
    
    console.log(`[Image Titles] Generated ${finalTitles.length} ${isMale ? 'mens' : 'womens'} hairstyle titles`);
    return finalTitles;
  }
  
  if (queryIntent.type === 'makeup') {
    const makeupTitles = [
      'Everyday Natural Makeup',
      'Bold Eye Makeup Look',
      'Contouring Technique',
      'Glamorous Evening Makeup',
      'Smokey Eye Tutorial',
      'Bridal Makeup Style',
      'Fresh Dewy Glow',
      'Cat Eye Perfection',
      'Nude Glam Makeup',
      'Festive Party Makeup',
      'Soft Romantic Look',
      'Dramatic Red Lip',
      'Colorful Creative Look',
      'Minimal Chic Makeup',
      'Bronze Goddess Glow',
      'Korean Glass Skin',
      'Vintage Glam Style',
      'Sunset Eye Makeup',
      'Winged Liner Perfection',
      'Highlighted Glow Up',
    ];
    const shuffled = [...makeupTitles].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(imageCount, shuffled.length));
  }
  
  if (queryIntent.type === 'skincare') {
    const skincareTitles = [
      'Glowing Skin Result',
      'Clear Skin Treatment',
      'Hydration Routine',
      'Anti-Aging Skincare',
      'Brightening Facial',
      'Acne Treatment Progress',
      'Dark Circle Treatment',
      'Radiant Complexion',
      'Skin Rejuvenation',
      'Even Skin Tone',
    ];
    return skincareTitles.slice(0, imageCount);
  }
  
  // Fallback titles with variation
  for (let i = 1; i <= imageCount; i++) {
    titles.push(`Style Option ${i}`);
  }
  return titles;
}

export async function POST(req: NextRequest) {
  try {
    const { messages, language, mode } = await req.json();
    
    // Handle simple navigation requests from MiniChatWidget first
    if (mode === "simple") {
      try {
        // Use a simpler system prompt focused only on navigation
        const simpleSystemPrompt = messages[0]?.content?.includes("[SYSTEM]:") 
          ? messages[0].content 
          : "You are GlamBot, a friendly navigation assistant for Mumbai GlamHub. Help users find pages and navigate the app with links.";
        
        // Build conversation without all the extra processing
        const conversation = messages.map((m: any) => ({
          role: m.role,
          content: m.content
        }));
        
        const reply = await generateWithRetry("gemini-1.5-flash", 
          `${simpleSystemPrompt}\n\nConversation:\n${conversation.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join("\n")}\n\nAssistant:`, 
          { maxTokens: 300, temperature: 0.7 }
        );
        
        return NextResponse.json({ reply, visualElements: null });
      } catch (err) {
        return NextResponse.json({ 
          reply: "I'm here to help! Visit our [Salons](/salons) page or [AI Assistant](/ai-assistant) for advanced help.", 
          visualElements: null 
        });
      }
    }

    // Ensure at least one Gemini API key is configured
    const hasGeminiKey = !!(
      process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY_3 ||
      process.env.GEMINI_API_KEY_4 || process.env.GEMINI_API_KEY_5 || process.env.GEMINI_API_KEY_6 ||
      process.env.GEMINI_API_KEY_7 || process.env.GEMINI_API_KEY_8 || process.env.GEMINI_API_KEY_9 ||
      process.env.GEMINI_API_KEY_10
    );

    if (!hasGeminiKey) {
      console.error("Gemini API key not configured");
      return NextResponse.json(
        {
          reply: "⚠️ AI features are currently unavailable. The Gemini API key needs to be configured by the administrator. In the meantime, browse our salons at /salons!",
          error: "Gemini API key not configured",
        },
        { status: 200 }
      );
    }

    // Fetch user context and real salon data for personalized responses
    const [userContext, salonData] = await Promise.all([
      getUserContext(),
      getRealSalonData(),
    ]);

    // ============================================================
    // 🎯 ORCHESTRATION LAYER: Intent Detection & Response Planning
    // ============================================================
    const lastUserMessage = Array.isArray(messages)
      ? messages.slice().reverse().find((m: any) => m.role === 'user')
      : null;
    const lastContent = lastUserMessage?.content || '';

    // Extract gender from image analysis if present in messages
    let detectedGender: 'male' | 'female' | null = null;
    try {
      const imageAnalysisMsg = messages.find((m: any) => 
        m.role === 'system' && m.content && m.content.includes('Image analysis:')
      );
      if (imageAnalysisMsg) {
        const genderMatch = imageAnalysisMsg.content.match(/gender:\s*(male|female)/i);
        if (genderMatch) {
          detectedGender = genderMatch[1].toLowerCase() as 'male' | 'female';
          console.log('[Gender Detection] Detected from image:', detectedGender);
        }
      }
    } catch (e) {
      console.warn('[Gender Detection] Failed to extract:', e);
    }

    // Detect user intent
    const queryIntent = detectIntent(lastContent);
    console.log('[Intent Detection]', {
      type: queryIntent.type,
      confidence: queryIntent.confidence,
      needsImages: queryIntent.needsImages,
      eligibleForVirtualTryOn: queryIntent.eligibleForVirtualTryOn,
      detectedGender,
    });

    // Plan the response structure
    const responsePlan = planResponse(queryIntent, lastContent, detectedGender);
    console.log('[Response Plan]', {
      shouldFetchImages: responsePlan.shouldFetchImages,
      imageCount: responsePlan.imageCount,
      ctaType: responsePlan.ctaType,
      template: responsePlan.responseTemplate,
      detectedGender: responsePlan.detectedGender,
    });

    // Initialize image arrays at function level for scope accessibility
    let proactiveImages: any[] = [];
    let salonImages: any[] = [];

    // Proactively fetch images if needed (BEFORE AI call)
    // Only fetch images for queries that actually need visual content
    if (responsePlan.shouldFetchImages && responsePlan.imageCount > 0) {
      try {
        const keywords = responsePlan.imageKeywords || extractImageSearchKeywords(lastContent, queryIntent.type);
        
        // Skip image fetching for non-visual queries like "what can you do", "hello", etc.
        const nonVisualKeywords = ['what can you', 'who are you', 'hello', 'hi', 'help', 'how are you', 'thanks', 'thank you'];
        const isNonVisualQuery = nonVisualKeywords.some(k => lastContent.toLowerCase().includes(k));
        
        if (!isNonVisualQuery && keywords && keywords.length > 3) {
          console.log(`[Proactive Images] Fetching ${responsePlan.imageCount} images for keywords: "${keywords}"`);
          console.log(`[Proactive Images] Query Intent: ${queryIntent.type}, Gender: ${detectedGender || 'not detected'}`);
          
          const rawImages = await getSearchImages(keywords, responsePlan.imageCount);
          console.log(`[Proactive Images] Received ${rawImages.length} raw images from search`);
          
          const titles = generateImageTitles(queryIntent, rawImages.length, detectedGender, lastContent);
          console.log(`[Proactive Images] Generated ${titles.length} titles`);
          
          // Merge titles with images
          proactiveImages = rawImages.map((img: any, idx: number) => ({
            url: img.url,
            alt: titles[idx] || img.alt || `Image ${idx + 1}`
          }));
          
          console.log(`[Proactive Images] SUCCESS: Prepared ${proactiveImages.length} images with titles`);
          console.log(`[Proactive Images] Sample titles:`, titles.slice(0, 3));
          console.log(`[Proactive Images] Sample URLs:`, proactiveImages.slice(0, 2).map(i => i.url.slice(0, 60)));
        } else {
          console.log(`[Proactive Images] Skipped - Reason: ${isNonVisualQuery ? 'non-visual query' : 'keywords too short'}`);
        }
      } catch (err) {
        console.error('[Proactive Images Error]', err);
      }
    } else {
      console.log(`[Proactive Images] Skipped - shouldFetch: ${responsePlan.shouldFetchImages}, count: ${responsePlan.imageCount}`);
    }

    // Fetch salon images if this is a salon-related query
    if (queryIntent.type === 'salon_search' || lastContent.toLowerCase().includes('salon')) {
      try {
        // Extract potential salon names from the query or use top salons
        const salonNames = extractSalonNames(lastContent) || [];
        if (salonNames.length > 0) {
          salonImages = await getSalonImages(salonNames);
          console.log(`[Salon Images] Fetched ${salonImages.length} salon images`);
        }
      } catch (err) {
        console.warn('[Salon Images Error]', err);
      }
    }

    let fullSystemPrompt = SYSTEM_PROMPT + salonData + userContext;

    // Attach saved memory for logged-in users (best-effort)
    try {
      const supabase = await getSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const savedMemory = await getMemoryForUserId(user.id);
        if (savedMemory && savedMemory.trim()) {
          fullSystemPrompt += `\n\n--- USER MEMORY ---\n${savedMemory}\n`;
        }
      }
    } catch (err) {
      // ignore memory failures
    }

    // If the client requests a specific language, instruct the model to reply in that language
    if (language && typeof language === 'string' && language.toLowerCase() !== 'auto') {
      const langMap: Record<string, string> = {
        en: 'English',
        english: 'English',
        hi: 'Hindi',
        hindi: 'Hindi',
        mr: 'Marathi',
        marathi: 'Marathi',
        gu: 'Gujarati',
        gujarati: 'Gujarati',
        bn: 'Bengali',
        bengali: 'Bengali',
        ta: 'Tamil',
        tamil: 'Tamil',
        te: 'Telugu',
        telugu: 'Telugu',
        kn: 'Kannada',
        kannada: 'Kannada',
        ml: 'Malayalam',
        malayalam: 'Malayalam',
        pa: 'Punjabi',
        punjabi: 'Punjabi',
        ur: 'Urdu',
        urdu: 'Urdu',
      };
      const requested = langMap[language.toLowerCase()] || language;
      fullSystemPrompt += `\n\nRespond in ${requested}.`;
    }

    // Strong response-formatting requirements — MUST follow for every human-readable reply
    fullSystemPrompt += `

RESPONSE FORMAT - MUST FOLLOW EXACTLY:

Step 1: Write your friendly, helpful response text using short paragraphs and bullet points.

Step 2: ALWAYS include a JSON block at the very end.
Use these exact marks: \`\`\`json 
Then the JSON object
Then close with: \`\`\`

Example JSON structure:
\`\`\`json
{
  "visualElements": {
    "images": [],
    "primaryCTA": null,
    "suggestions": []
  }
}
\`\`\`

Important:
- ALWAYS include the JSON block, even if some fields are empty
- Use proper spacing in your text response  
- Keep text concise and well-formatted
- JSON must be valid (no trailing commas)
- Nothing should appear after the JSON block`;

    // ============================================================
    // 🧠 ADD INTENT-SPECIFIC GUIDANCE
    // ============================================================
    fullSystemPrompt += `\n\n--- QUERY CONTEXT ---\n`;
    fullSystemPrompt += `Detected Query Type: ${queryIntent.type} (${(queryIntent.confidence * 100).toFixed(0)}% confident)\n`;
    if (detectedGender) {
      fullSystemPrompt += `Detected Gender from Image: ${detectedGender === 'male' ? 'Male' : 'Female'}\n`;
      fullSystemPrompt += `IMPORTANT: Provide ${detectedGender === 'male' ? "men's" : "women's"} style recommendations based on the detected gender.\n`;
    }
    fullSystemPrompt += `${getIntentPromptHint(queryIntent)}\n`;
    
    if (proactiveImages.length > 0) {
      fullSystemPrompt += `\nNote: Reference images (${proactiveImages.length}) have been prepared for visual inspiration. Include them in your response.\n`;
    }

    // Add CTA instructions for hairstyle and makeup queries
    if (queryIntent.type === 'hairstyle' || queryIntent.type === 'makeup') {
      // Use detected gender from image analysis first, then fall back to text detection
      let ctaUrl = '/virtual-tryon/women'; // default
      
      if (detectedGender === 'male') {
        ctaUrl = '/virtual-tryon/men';
      } else if (detectedGender === 'female') {
        ctaUrl = '/virtual-tryon/women';
      } else {
        // Fall back to text-based gender detection
        const isMen = lastContent.toLowerCase().includes('men') || 
                     lastContent.toLowerCase().includes('male') || 
                     lastContent.toLowerCase().includes('guy') ||
                     lastContent.toLowerCase().includes('barber');
        ctaUrl = isMen ? '/virtual-tryon/men' : '/virtual-tryon/women';
      }
      
      console.log('[CTA URL] Determined:', ctaUrl, '(detectedGender:', detectedGender, ')');
      
      fullSystemPrompt += `\n⭐ MANDATORY FOR THIS QUERY:
You MUST end your response with a Virtual Try-On CTA button.
After your main advice and recommendations, add EXACTLY this at the very end:

<cta>
Try this look and see how it suits you! Analyze perfectly with our Virtual Try-On 💇‍♀️
Link: ${ctaUrl}
</cta>

This must appear BEFORE any JSON block.`;
    }

    // Build a plain-text conversation prompt for Gemini
    // Allow client to pass personality or memoryContext inside messages as special system fields
    const convo = (messages || [])
      .map((m: any) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n");

    const prompt = `${fullSystemPrompt}\n\nConversation:\n${convo}\n\nAssistant:`;

    // Log prompt details for debugging
    console.log('[Prompt Debug]', {
      systemPromptLength: fullSystemPrompt.length,
      totalPromptLength: prompt.length,
      userMessagePreview: lastContent.slice(0, 100),
      intentType: queryIntent.type,
      proactiveImagesCount: proactiveImages.length,
    });

    // Calculate dynamic token limit based on complexity
    const dynamicTokens = calculateDynamicTokens(lastContent, queryIntent);
    console.log(`[Dynamic Tokens] Calculated ${dynamicTokens} tokens for ${queryIntent.type} query (complexity: ${classifyQuery(lastContent).type})`);

    // Call Gemini via our wrapper (with retries/key rotation)
    let replyText = await generateWithRetry("gemini-1.5-flash", prompt, { maxTokens: dynamicTokens, temperature: 0.7 });

    // Log a short preview for diagnostics
    try { 
      console.log('[AI Reply Raw]', replyText.slice(0, 200)); 
      console.log('[AI Reply Length]', replyText.length, 'chars');
    } catch {}

    // Attempt to extract a structured JSON block the assistant may have included
    let structured: any = null;
    try {
      // Look for ```json blocks first
      const jsonBlockMatch = replyText.match(/```json\s*([\s\S]*?)\s*```/i);
      let candidate = jsonBlockMatch ? jsonBlockMatch[1] : null;

      // Fallback: try to find a top-level JSON object
      if (!candidate) {
        const objMatch = replyText.match(/(\{[\s\S]*\})/);
        candidate = objMatch ? objMatch[1] : null;
      }

      if (candidate) {
        // Try parsing; tolerate trailing commas by removing them
        const cleaned = candidate.replace(/,\s*}/g, "}").replace(/,\s*\]/g, "]");
        structured = JSON.parse(cleaned);
        console.log('[Structured Response Found]', {
          hasImages: structured?.visualElements?.images?.length || 0,
          hasCTA: !!structured?.visualElements?.primaryCTA,
        });

        // Remove the JSON block from the visible reply so users don't see raw JSON
        if (jsonBlockMatch) {
          replyText = replyText.replace(jsonBlockMatch[0], "").trim();
        } else if (candidate) {
          replyText = replyText.replace(candidate, "").trim();
        }
      } else {
        console.log('[No Structured JSON Found] - Will merge proactive images');
      }
    } catch (err) {
      console.warn("Failed to parse structured JSON from AI reply:", String(err));
      structured = null;
    }

    console.log('[Final Reply Text] Before formatting:', replyText.slice(0, 150));

      // Classify the user's query (simple vs complex) and ensure visualElements skeleton
      try {
        const lastUser = Array.isArray(messages) ? messages.slice().reverse().find((m: any) => m.role === 'user') : null;
        const lastContent = lastUser?.content || (Array.isArray(messages) && messages.length ? messages[messages.length - 1]?.content : '') || '';
        const classification = classifyQuery(lastContent || '');

        if (!structured) structured = { visualElements: { images: [] } };
        if (!structured.visualElements) structured.visualElements = { images: [] };

        structured.visualElements.queryType = classification.type;
        structured.visualElements.queryClassifier = classification;
      } catch (err) {
        // ignore classification errors
      }

    // If the assistant did not provide images, generate safe Unsplash fallbacks
    try {
      const hasImages = structured?.visualElements?.images && Array.isArray(structured.visualElements.images) && structured.visualElements.images.length > 0;
      
      // Use proactive images if available, otherwise fetch fallback
      let imagesToUse = proactiveImages;
      
      if (!imagesToUse || imagesToUse.length === 0) {
        // Fallback: build simple keywords from last user message and query multiple image sources
        const stopwords = new Set(['the','and','a','an','in','on','for','to','of','is','are','what','which','that','this','with','my','i','me']);
        const words = (lastContent || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean).filter((w:any)=>!stopwords.has(w));
        const keywords = (words.length ? words.slice(0,4).join(' ') : 'beauty hair style');
        imagesToUse = await getSearchImages(keywords, 6);
      }
      
      // Apply images to structured response
      if (!hasImages && imagesToUse.length > 0) {
        if (!structured) structured = { visualElements: { images: imagesToUse } };
        else if (!structured.visualElements) structured.visualElements = { images: imagesToUse };
        else structured.visualElements.images = imagesToUse;
      } else if (!hasImages && proactiveImages.length > 0) {
        // Ensure proactive images are in the response
        if (!structured) structured = { visualElements: { images: proactiveImages } };
        else if (!structured.visualElements) structured.visualElements = { images: proactiveImages };
        else if (!structured.visualElements.images || structured.visualElements.images.length === 0) {
          structured.visualElements.images = proactiveImages;
        }
      }

      // Add salon images to the response if available
      if (salonImages.length > 0) {
        if (!structured) structured = { visualElements: {} };
        if (!structured.visualElements) structured.visualElements = {};
        if (!structured.visualElements.salonImages) structured.visualElements.salonImages = salonImages;
        
        // Also add salon images to the main images array for display
        const salonImageUrls = salonImages.map(si => ({ url: si.image, alt: `${si.name} - Salon` }));
        if (!structured.visualElements.images) structured.visualElements.images = [];
        structured.visualElements.images = [...structured.visualElements.images, ...salonImageUrls];
        
        console.log('[Added Salon Images]', salonImages.length);
      }
    } catch (err) {
      // ignore image fallback errors
      console.warn('Image fallback error', err);
    }

    // Ensure visualElements has friendly defaults for the UI
    try {
      if (!structured) structured = { visualElements: {} };
      if (!structured.visualElements) structured.visualElements = {};

      // Ensure images array
      if (!Array.isArray(structured.visualElements.images)) structured.visualElements.images = structured.visualElements.images ? [structured.visualElements.images] : [];

      // Ensure at least one card for visual rendering
      if (!Array.isArray(structured.visualElements.cards) || structured.visualElements.cards.length === 0) {
        const primaryImage = structured.visualElements.images && structured.visualElements.images.length ? structured.visualElements.images[0]?.url || structured.visualElements.images[0] : null;
        structured.visualElements.cards = [
          {
            title: replyText ? replyText.split('\n')[0].slice(0, 120) : 'Suggestion',
            subtitle: replyText ? replyText.slice(0, 320) : '',
            image: primaryImage,
            cta: { label: 'Open AI Assistant', url: '/ai-assistant' }
          }
        ];
      }

      // Provide default suggested actions
      if (!Array.isArray(structured.visualElements.suggestions) || structured.visualElements.suggestions.length === 0) {
        structured.visualElements.suggestions = [
          { label: 'View salons', action: '/salons' },
          { label: 'Book now', action: '/salons' },
          { label: 'Ask follow-up', action: 'follow_up' }
        ];
      }

      // ============================================================
      // 🎬 ADD INTENT-SPECIFIC CTAs
      // ============================================================
      // Add Virtual Try-On CTA if applicable
      if (responsePlan.shouldShowCTA && responsePlan.ctaType !== 'none') {
        const cta = {
          label: responsePlan.ctaLabel,
          url: responsePlan.ctaUrl,
          type: responsePlan.ctaType,
          icon: responsePlan.ctaType === 'virtual-tryon' ? '✨' : '🏪',
        };

        // Add as primary CTA in structured response
        if (!structured.visualElements.primaryCTA) {
          structured.visualElements.primaryCTA = cta;
        }

        // Also add to suggestions if not already there
        if (!Array.isArray(structured.visualElements.suggestions)) {
          structured.visualElements.suggestions = [];
        }

        const ctaExists = structured.visualElements.suggestions.some(
          (s: any) => s.url === responsePlan.ctaUrl
        );

        if (!ctaExists) {
          structured.visualElements.suggestions.unshift({
            label: responsePlan.ctaLabel,
            action: responsePlan.ctaUrl,
          });
        }
      }

      // Store intent info for debugging and analytics
      structured.visualElements.intentAnalysis = {
        type: queryIntent.type,
        confidence: queryIntent.confidence,
        needsImages: queryIntent.needsImages,
        eligibleForVirtualTryOn: queryIntent.eligibleForVirtualTryOn,
      };

      // Log final structured response for debugging
      console.log('[Final Structured Response]', {
        hasImages: structured?.visualElements?.images?.length || 0,
        imagesCount: structured?.visualElements?.images?.length || 0,
        hasCTA: !!structured?.visualElements?.primaryCTA,
        cardCount: structured?.visualElements?.cards?.length || 0,
      });
    } catch (e) {
      // ignore
      console.warn('[Structured Response Build Error]', String(e));
    }

    console.log('[Response Before Send]', {
      replyLength: replyText.length,
      visualElementsImages: structured?.visualElements?.images?.length || 0,
    });

    return NextResponse.json({ reply: replyText, structured, visualElements: structured?.visualElements ?? null });

  } catch (error: any) {
    console.error("AI chat error:", error);
    const errorMessage =
      typeof error === "string"
        ? error
        : (error as any)?.message || JSON.stringify(error) || "Unknown error";

    const isQuotaError = /quota|exceed|429|rate limit|exhaust/i.test(errorMessage) || (error as any)?.code === "insufficient_quota";

    const reply = isQuotaError
      ? "⚠️ The Gemini API returned a quota or billing error. Please check your Gemini billing/keys and ensure server environment variables are set. Restart the dev server after updating `.env.local`."
      : `Sorry, I encountered an error: ${errorMessage}. Please try again in a moment.`;

    return NextResponse.json(
      {
        reply,
        error: errorMessage,
      },
      { status: 200 }
    );
  }
}
