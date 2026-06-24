"use client";

import React, { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
const GoogleCSE = dynamic(() => import('@/components/ai/GoogleCSE'), { ssr: false });
import { Send, Sparkles, Wand2, RefreshCw, User, Mic, Camera, MessageSquare, Search, Pin, Clock, LogIn, LogOut, Volume2, Pause, Copy, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth/useAuth";
import { Button } from "@/components/ui/button";
import { useRouter } from 'next/navigation';
import AIFeatureShowcase from "@/components/ai/AIFeatureShowcase";
import { loadMemory, saveMemory, extractMemoryUpdates } from "@/lib/ai/memory-system";
// AIFeatureShowcase intentionally not imported here (file is commented out);
// render a lightweight placeholder instead to avoid runtime errors.
import Tier3Cards from "@/components/ai/Tier3Cards";
import { StyleIdentityCard, TransformationRoadmap, ConfidenceScoreCard, SalonMatchCard, PerceptionImpactCard, RegretPreventionCard, HiddenPotentialCard } from "@/components/ai/VisualResponseCards";
import { parseAIResponse } from "@/lib/ai/response-parser";
import type { ParsedResponse } from "@/lib/ai/response-parser";
import { useAIAnalytics } from "@/lib/ai/analytics";
import { cn } from "@/lib/utils";
import type { AIMessage } from "@/types";

// Image Carousel Component - Compact inline display
function ImageCarousel({ images }: { images: any[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  if (!images || images.length === 0) return null;
  
  const currentImage = images[currentIndex];
  const imageTitle = currentImage.alt || `Image ${currentIndex + 1}`;
  
  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };
  
  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };
  
  return (
    <div className="w-full">
      <div className="flex flex-col items-center gap-3 p-4">
        {/* Image Display */}
        <div className="w-full max-w-sm aspect-square rounded-lg overflow-hidden bg-white/5 border border-white/10 shadow-md">
          <img
            src={currentImage.url}
            alt={imageTitle}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1595777707802-038daca6d617?w=600&h=600&fit=crop';
            }}
          />
        </div>
        
        {/* Image Title */}
        <p className="text-white/70 text-sm font-medium text-center">
          {imageTitle}
        </p>
        
        {/* Navigation */}
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrev}
            className="px-3 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white font-medium"
          >
            â† Prev
          </button>
          <div className="text-white/50 text-xs font-medium min-w-[40px] text-center">
            {currentIndex + 1} / {images.length}
          </div>
          <button
            onClick={handleNext}
            className="px-3 py-1.5 text-xs rounded-lg bg-gradient-to-r from-purple-600 to-pink-500 hover:shadow-lg hover:shadow-purple-500/50 transition-all duration-300 text-white font-medium"
          >
            Next â†’
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper function to extract CTA from content and remove JSON blocks
function extractCTA(content: string): { text: string; cta?: { label: string; link: string } } {
  let workingContent = content;
  
  // Remove ALL JSON-like patterns to prevent leaking base64 data
  // Remove ```json...``` code blocks
  workingContent = workingContent.replace(/```json[\s\S]*?```/gi, '').trim();
  // Remove ```code blocks with any content
  workingContent = workingContent.replace(/```[\s\S]*?```/gi, '').trim();
  // Remove standalone JSON objects with visualElements
  workingContent = workingContent.replace(/\{[\s\S]*?"visualElements"[\s\S]*?\}/gi, '').trim();
  // Remove any remaining JSON-like objects starting with { and containing "
  workingContent = workingContent.replace(/\{[^}]*"[^}]*\}/g, '').trim();
  // Remove base64 image data patterns (data:image/...)
  workingContent = workingContent.replace(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/gi, '[Image Data]').trim();
  // Clean up excess whitespace
  workingContent = workingContent.replace(/\s+/g, ' ').trim();
  
  const ctaRegex = /<cta>([\s\S]*?)<\/cta>/i;
  const match = workingContent.match(ctaRegex);
  
  if (!match) {
    return { text: workingContent };
  }
  
  const ctaContent = match[1].trim();
  const textWithoutCTA = workingContent.replace(ctaRegex, '').trim();
  
  // Parse CTA content to extract label and link
  const linkMatch = ctaContent.match(/Link:\s*(.+?)(?:\n|$)/);
  const labelMatch = ctaContent.match(/^(.+?)(?:\nLink:|$)/);
  
  return {
    text: textWithoutCTA,
    cta: linkMatch ? {
      label: labelMatch ? labelMatch[1].trim() : 'Try This Look ðŸ’‡â€â™€ï¸',
      link: linkMatch[1].trim(),
    } : undefined,
  };
}

function escapeHtml(str: string) {
  if (!str) return "";
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Convert a few markdown patterns into safe HTML for display
function formatContent(content: string) {
  if (!content) return "";
  return content
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^\*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-purple-300 hover:text-purple-200 underline font-medium">$1</a>');
}

// Fix common run-on formatting issues from the AI reply so it reads naturally.
function formatAssistantReply(text: string) {
  if (!text) return text;
  // Preserve HTML tags by splitting on them and only formatting text nodes
  const parts = text.split(/(<[^>]+>)/g);
  const formatted = parts.map((part) => {
    // leave tags as-is
    if (/^<[^>]+>$/.test(part)) return part;
    let s = part;
    // collapse whitespace
    s = s.replace(/\s+/g, ' ');
    // ensure space after common sentence punctuation
    s = s.replace(/([.!?])([A-Za-z0-9"'â€œâ€˜`\(\[])/g, '$1 $2');
    s = s.replace(/([,:;])([A-Za-z0-9"'â€œâ€˜`\(\[])/g, '$1 $2');
    // put spaces around em-dash if missing
    s = s.replace(/([^\s])â€”([^\s])/g, '$1 â€” $2');
    // separate lowercase->Uppercase joins (e.g. "I'mGlamAI" -> "I'm Glam AI")
    s = s.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
    // collapse repeated spaces again and trim
    s = s.replace(/\s+/g, ' ').trim();
    // add paragraph breaks after sentence end to improve readability
    s = s.replace(/([.!?])\s+([A-Z])/g, '$1\n\n$2');
    // If there are very long runs without spaces, try to split using common tokens
    const maxChunk = Math.max(...s.split(/\s+/).map(p => p.length));
    if (maxChunk > 20) {
        // Don't try token-based splitting - it destroys properly formatted text
        // Just apply the CamelCase fix if no spaces exist
        if (!/ /.test(s)) {
          s = s.replace(/([a-z])([A-Z])/g, '$1 $2');
          s = s.replace(/\s+/g, ' ').trim();
        }
    }
    return s;
  });
  return formatted.join('');
}

const WELCOME: AIMessage = {
  role: "assistant",
  content: "Hi! I'm AuraAI â€” your personal beauty advisor for Mumbai. Ask me anything.",
  timestamp: new Date(),
};

const SUGGESTIONS = [
  "Suggest bridal makeup salons under â‚¹5000 near Bandra",
  "Best haircut for curly hair in Andheri?",
  "Recommend a spa package with 4.8+ rating",
  "What is the best treatment for damaged hair?",
];

export default function AIAssistantClient() {
  const [messages, setMessages] = useState<AIMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [parsed, setParsed] = useState<ParsedResponse | null>(null);
  const [geminiOk, setGeminiOk] = useState(false);
  const [geminiKeysCount, setGeminiKeysCount] = useState(0);
  const [supportedModelName, setSupportedModelName] = useState<string | null>(null);
  const [voiceFeaturesArr, setVoiceFeaturesArr] = useState<string[]>([]);
  const [serverTtsAvailable, setServerTtsAvailable] = useState(false);
  const [language, setLanguage] = useState("auto");
  const [showFeatures, setShowFeatures] = useState(false);
  const [personality, setPersonality] = useState("professional");
  const [contextMemoryEnabled, setContextMemoryEnabled] = useState(true);
  const [conversations, setConversations] = useState<any[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const router = useRouter();
  const [messagesByLanguage, setMessagesByLanguage] = useState<Record<string, AIMessage[]>>({});
  const [isTranslating, setIsTranslating] = useState(false);
  const [showGoogleSearch, setShowGoogleSearch] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const analytics = useAIAnalytics();
  const [mounted, setMounted] = useState(false);

  // Attached image for the draft message (do NOT auto-submit)
  const [attachedImage, setAttachedImage] = useState<string | null>(null);

  // TTS / speaking state
  const speechUtteranceRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [speakingProgress, setSpeakingProgress] = useState<number>(0);
  const speechTimerRef = useRef<number | null>(null);

  // Chat search in sidebar
  const [chatSearch, setChatSearch] = useState("");
  // Word boundaries + per-word highlighting
  const wordBoundariesRef = useRef<number[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState<number>(-1);
  const [inConversationSearch, setInConversationSearch] = useState('');
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  const { profile, isLoggedIn, isLoading: authLoading, signOut } = useAuth();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch recent saved conversations (best-effort). Use sessionStorage for non-auth users.
  const fetchConversations = async () => {
    try {
      if (!isLoggedIn) {
        const s = sessionStorage.getItem('ai_conversations');
        if (s) setConversations(JSON.parse(s));
        else setConversations([]);
        return;
      }

      const res = await fetch('/api/ai/conversations?limit=50');
      const d = await res.json();
      if (d?.ok) setConversations(Array.isArray(d.data) ? d.data : []);
      else setConversations([]);
    } catch (e) {
      // fallback to server failure: try sessionStorage then localStorage
      const s = sessionStorage.getItem('ai_conversations');
      if (s) { try { setConversations(JSON.parse(s)); return; } catch {} }
      const local = localStorage.getItem('ai_conversations');
      if (local) {
        try { setConversations(JSON.parse(local)); } catch { setConversations([]); }
      }
    }
  };

  useEffect(() => { fetchConversations(); }, [isLoggedIn]);

  // In-conversation search: scroll to first matching message
  useEffect(() => {
    if (!inConversationSearch || !inConversationSearch.trim()) return;
    const q = inConversationSearch.toLowerCase();
    const idx = messages.findIndex((m) => (m.content || '').toLowerCase().includes(q));
    if (idx >= 0) {
      const el = document.getElementById(`msg-${idx}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [inConversationSearch, messages]);

  // Chat search helpers
  const matchesSearch = (c: any) => {
    if (!chatSearch || chatSearch.trim() === '') return true;
    const q = chatSearch.toLowerCase();
    if ((c.title || '').toLowerCase().includes(q)) return true;
    if ((c.preview || '').toLowerCase().includes(q)) return true;
    if (Array.isArray(c.messages) && c.messages.some((m: any) => (m.content || '').toLowerCase().includes(q))) return true;
    return false;
  };
  const pinnedConversations = conversations.filter((c:any) => c.pinned && matchesSearch(c));
  const filteredConversations = conversations.filter((c:any) => matchesSearch(c));

  // Suggestion chips shown under assistant messages
  const SuggestionChips = ({ suggestions = SUGGESTIONS }: { suggestions?: string[] }) => (
    <div className="mt-3 flex flex-wrap gap-2">
      {suggestions.map((s, i) => (
        <button
          key={i}
          onClick={() => sendMessage(s)}
          className="text-xs px-3 py-1.5 rounded-full bg-white/6 border border-white/8 text-white/80 hover:bg-white/10 transition"
        >
          {s}
        </button>
      ))}
    </div>
  );

  const saveConversation = async () => {
    const payload = {
      userId: undefined,
      sessionId: undefined,
      title: (messages.find(m=>m.role==='user')?.content || '').slice(0,120) || 'Chat',
      language,
      messages,
      preview: messages[messages.length-1]?.content || '',
      pinned: false,
    };

    try {
      if (!isLoggedIn) {
        const s = sessionStorage.getItem('ai_conversations');
        const arr = s ? JSON.parse(s) : [];
        arr.unshift({ id: `session_${Date.now()}`, ...payload, created_at: new Date().toISOString() });
        sessionStorage.setItem('ai_conversations', JSON.stringify(arr.slice(0,200)));
        setConversations(arr.slice(0,200));
        return;
      }

      const res = await fetch('/api/ai/conversations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) {
        // save locally as fallback
        const local = localStorage.getItem('ai_conversations');
        const arr = local ? JSON.parse(local) : [];
        arr.unshift({ id: `local_${Date.now()}`, ...payload, created_at: new Date().toISOString() });
        localStorage.setItem('ai_conversations', JSON.stringify(arr.slice(0, 200)));
        setConversations(arr.slice(0, 200));
      } else {
        await fetchConversations();
      }
    } catch (e) {
      const local = localStorage.getItem('ai_conversations');
      const arr = local ? JSON.parse(local) : [];
      arr.unshift({ id: `local_${Date.now()}`, title: (messages.find(m=>m.role==='user')?.content || '').slice(0,120) || 'Chat', language, messages, preview: messages[messages.length-1]?.content || '', pinned: false, created_at: new Date().toISOString() });
      localStorage.setItem('ai_conversations', JSON.stringify(arr.slice(0,200)));
      setConversations(arr.slice(0,200));
    }
  };

  const deleteConversation = async (c: any) => {
    if (!c) return;
    try {
      if (isLoggedIn && c.id && !String(c.id).startsWith('session_') && !String(c.id).startsWith('local_')) {
        await fetch(`/api/ai/conversations/${c.id}`, { method: 'DELETE' });
        await fetchConversations();
        return;
      }

      // Non-auth or local/session items
      const session = sessionStorage.getItem('ai_conversations');
      if (session) {
        try {
          const arr = JSON.parse(session);
          const filtered = arr.filter((x:any) => x.id !== c.id);
          sessionStorage.setItem('ai_conversations', JSON.stringify(filtered));
          setConversations(prev => prev.filter((x:any) => x.id !== c.id));
          return;
        } catch (e) {}
      }

      const local = localStorage.getItem('ai_conversations');
      if (local) {
        try {
          const arr = JSON.parse(local);
          const filtered = arr.filter((x:any) => x.id !== c.id);
          localStorage.setItem('ai_conversations', JSON.stringify(filtered));
          setConversations(prev => prev.filter((x:any) => x.id !== c.id));
          return;
        } catch (e) {}
      }
    } catch (e) {
      console.error('deleteConversation', e);
    }
  };

  const handleNewChat = async () => {
    try {
      if (contextMemoryEnabled && messages && messages.length > 1) await saveConversation();
    } catch (e) {}
    setMessages([WELCOME]);
  };

  // Keep a per-language cache of messages. Update cache whenever messages change for current language.
  useEffect(() => {
    setMessagesByLanguage(prev => ({ ...prev, [language]: messages }));
  }, [messages, language]);

  const handleLanguageChange = async (newLang: string) => {
    if (!newLang) return;
    if (newLang === language) return;
    // If we already have a cached version for this language, use it
    if (messagesByLanguage[newLang]) {
      setMessages(messagesByLanguage[newLang]);
      setLanguage(newLang);
      return;
    }

    // Otherwise request translation from server
    try {
      setIsTranslating(true);
      const res = await fetch('/api/ai/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: messagesByLanguage[language] || messages, targetLanguage: newLang }) });
      const d = await res.json();
      if (d?.ok && Array.isArray(d.data)) {
          const translated = d.data.map((m: any) => ({ role: m.role, content: m.content, timestamp: m.timestamp ? new Date(m.timestamp) : new Date() }));
          setMessages(translated);
          setMessagesByLanguage(prev => ({ ...prev, [newLang]: translated }));
          setLanguage(newLang);
        } else {
        console.warn('Translation failed', d);
      }
    } catch (err) {
      console.error('Language change failed', err);
    } finally {
      setIsTranslating(false);
    }
  };

  // Check server-side AI feature availability (Gemini keys, voice TTS/STT)
  useEffect(() => {
    let mounted = true;
    async function fetchStatus() {
      try {
        const res = await fetch('/api/ai/gemini-status');
        const d = await res.json();
        if (!mounted) return;
        const status = d?.status || {};
        setGeminiKeysCount(status?.totalKeys ?? 0);
        setGeminiOk(!!(status?.totalKeys && status.totalKeys > 0));
        setSupportedModelName(d?.supportedModel ?? null);
      } catch (err) {
        // ignore
      }

      try {
        const vs = await fetch('/api/ai/voice');
        const vd = await vs.json();
        if (!mounted) return;
        setVoiceFeaturesArr(vd?.features || []);
        setServerTtsAvailable(!!vd?.serverTtsAvailable);
      } catch (err) {
        // ignore
      }
    }

    fetchStatus();
    return () => { mounted = false; };
  }, []);

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    // allow sending when there's only an attached image
    if (!content && !attachedImage) return;
    setInput("");

    // Build message content including attached image HTML (so UI + server receive it)
    let userContent = content;
    if (attachedImage) {
      userContent = (userContent ? `${userContent}<br/>` : "") + `<img src="${attachedImage}" alt="user-image" class="rounded-md max-w-xs" />`;
    }

    const userMsg: AIMessage = { role: "user", content: userContent, timestamp: new Date() };
    setMessages((m) => [...m, userMsg]);
    setIsLoading(true);

    try {
      // Prepare payload messages (include current messages + this user message)
      const baseMessages = [...messages, userMsg].map((x) => ({ role: x.role, content: x.content }));

      // If an image is attached, call server image-analyze first and include its summary in the prompt
      const payloadMessages: any[] = [...baseMessages];
      if (attachedImage) {
        try {
          const ir = await fetch('/api/ai/image-analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: attachedImage, purpose: 'face' }) });
          const id = await ir.json();
          // Set parsed visuals for immediate UI feedback if available
          if (id?.analysis) {
            try { setParsed({ visualElements: { styleIdentity: id.analysis, confidenceScores: id.analysis.confidence } } as any); } catch {}
          }

          // Build a short human-readable summary from the analysis object
          let analysisSummary = '';
          try {
            if (id?.analysis) {
              if (typeof id.analysis === 'string') analysisSummary = id.analysis;
              else if (typeof id.analysis === 'object') {
                const parts: string[] = [];
                for (const k of Object.keys(id.analysis)) {
                  try {
                    const v = id.analysis[k];
                    if (v === null || v === undefined) continue;
                    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') parts.push(`${k}: ${v}`);
                    else parts.push(`${k}: ${JSON.stringify(v)}`);
                  } catch (e) {}
                }
                analysisSummary = parts.join('; ');
              }
            } else if (id?.text) analysisSummary = id.text;
          } catch (e) { analysisSummary = '';
          }

          if (analysisSummary) {
            payloadMessages.push({ role: 'system', content: `Image analysis: ${analysisSummary}` });
          }
        } catch (e) {
          console.warn('Image analyze failed', e);
        }
      }

      const payload: any = { messages: payloadMessages };
      if (language && language !== "auto") payload.language = language;
      if (!contextMemoryEnabled) payload.noMemory = true;
      if (personality) payload.personality = personality;

      const res = await fetch("/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      const aiRaw = data.reply || "Sorry, I couldn't process that.";
      const aiContent = formatAssistantReply(aiRaw);
      setMessages((m) => [...m, { role: "assistant", content: aiContent, timestamp: new Date() }]);

      // attempt to set parsed visuals
      if (data?.visualElements) setParsed(data.visualElements as any);
      else if (data?.structured) setParsed(data.structured.visualElements ?? data.structured);
      else {
        try {
          // parse using raw content so structured JSON blocks are preserved
          const parsedResp = parseAIResponse(aiRaw);
          setParsed(parsedResp as any);
        } catch {}
      }

      try {
        const msgLen = content ? content.length : (attachedImage ? 1 : 0);
        analytics.trackMessageSent("text", msgLen);
      } catch {}

      // Persist memory updates (best-effort) when memory toggle is enabled
      try {
        if (contextMemoryEnabled) {
          const currentMemory = loadMemory(undefined);
          const memUpdates = extractMemoryUpdates(userMsg.content, aiContent, currentMemory);
          if (memUpdates && Object.keys(memUpdates).length > 0) {
            // Save locally and attempt server-side persist
            saveMemory({ ...currentMemory, ...memUpdates }, undefined);
            fetch('/api/ai/memory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: undefined, sessionId: undefined, memory: memUpdates }) }).catch(()=>{});
          }
        }
      } catch (e) { /* ignore */ }
    } catch (err) {
      console.error(err);
      setMessages((m) => [...m, { role: "assistant", content: "Error contacting AI", timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
      // clear attached image after attempting to send
      setAttachedImage(null);
    }
  };

  const handleImageSelect = async (e: any) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // Attach image to draft (do NOT auto-submit). Show preview and include image when user sends message.
      setAttachedImage(dataUrl);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startStopRecording = async () => {
    try {
      if (!navigator.mediaDevices) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (ev) => { if (ev.data && ev.data.size) chunks.push(ev.data); };
      mr.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const buffer = await blob.arrayBuffer();
        const b64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        const dataUrl = `data:audio/webm;base64,${b64}`;
        setIsLoading(true);
        try {
          const res = await fetch('/api/ai/voice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'stt', audio: dataUrl }) });
          const d = await res.json();
          const text = d?.text || d?.transcript || '';
            if (text) await sendMessage(text);
                else setMessages((m) => [...m, { role: 'assistant', content: 'Could not transcribe', timestamp: new Date() }]);
        } catch (e) { console.error(e); }
        setIsLoading(false);
      };
      mr.start();
      setTimeout(() => mr.stop(), 4000);
    } catch (e) { console.error(e); }
  };

  const stopSpeech = () => {
    try {
      if (speechUtteranceRef.current && typeof window !== 'undefined' && (window as any).speechSynthesis) {
        (window as any).speechSynthesis.cancel();
      }
      if (audioRef.current) {
        try { audioRef.current.pause(); audioRef.current.currentTime = 0; } catch {}
        audioRef.current = null;
      }
      if (speechTimerRef.current) {
        try { window.clearInterval(speechTimerRef.current); } catch {}
        speechTimerRef.current = null;
      }
    } catch (e) {}
    speechUtteranceRef.current = null;
    setSpeakingIndex(null);
    setSpeakingProgress(0);
    setCurrentWordIndex(-1);
  };

  const playMessageSpeech = async (message: any, idx: number) => {
    if (!message || !message.content) return;
    stopSpeech();
    const text = (message.content || '').toString();
    setSpeakingIndex(idx);
    setSpeakingProgress(0);

    // prepare word boundaries for highlighting
    const wordsArr = text.replace(/\s+/g, ' ').trim().length ? text.replace(/\s+/g, ' ').trim().split(' ') : [];
    const boundaries: number[] = [];
    let pos = 0;
    for (const w of wordsArr) {
      boundaries.push(pos);
      pos += w.length + 1;
    }
    wordBoundariesRef.current = boundaries;
    setCurrentWordIndex(0);

    // Prefer browser SpeechSynthesis when available
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        const utter = new SpeechSynthesisUtterance(text);
        // map a few known language codes, fallback to en-IN for auto
        const langMap: Record<string,string> = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' };
        utter.lang = (language && language !== 'auto' ? (langMap[language] || language) : 'en-IN');
        utter.rate = 1;
        utter.pitch = 1;

        utter.onboundary = (e: any) => {
          try {
            const charIndex = typeof e.charIndex === 'number' ? e.charIndex : 0;
            setSpeakingProgress(Math.min(1, charIndex / Math.max(1, text.length)));
            // map charIndex to word index
            const b = wordBoundariesRef.current || [];
            let wi = 0;
            for (let k = b.length - 1; k >= 0; k--) {
              if (charIndex >= b[k]) { wi = k; break; }
            }
            setCurrentWordIndex(wi);
          } catch (er) {}
        };

        utter.onend = () => {
          setSpeakingProgress(1);
          setCurrentWordIndex(-1);
          setTimeout(() => stopSpeech(), 120);
        };

        speechUtteranceRef.current = utter;
        try { (window as any).speechSynthesis.speak(utter); } catch (e) { console.error(e); }
        return;
      } catch (e) {
        console.warn('SpeechSynthesis failed, falling back to server TTS', e);
      }
    }

    // Fallback: ask server for tts audio (if available)
    if (serverTtsAvailable) {
      try {
        const res = await fetch('/api/ai/voice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'tts', text }) });
        const d = await res.json();
        let audioUrl = d?.url || d?.audio || d?.base64 ? (d.base64 ? `data:audio/mpeg;base64,${d.base64}` : undefined) : undefined;
        if (!audioUrl && d?.base64) audioUrl = `data:audio/mpeg;base64,${d.base64}`;
        if (!audioUrl && d?.audioUrl) audioUrl = d.audioUrl;
        if (!audioUrl) return;
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audio.ontimeupdate = () => {
          if (audio.duration) {
            const progress = Math.min(1, audio.currentTime / audio.duration);
            setSpeakingProgress(progress);
            // approximate char index by progress
            const approxChar = Math.floor(progress * text.length);
            const b = wordBoundariesRef.current || [];
            let wi = 0;
            for (let k = b.length - 1; k >= 0; k--) {
              if (approxChar >= b[k]) { wi = k; break; }
            }
            setCurrentWordIndex(wi);
          }
        };
        audio.onended = () => { setCurrentWordIndex(-1); stopSpeech(); };
        await audio.play();
        return;
      } catch (e) {
        console.error('Server TTS failed', e);
      }
    }

    // Nothing available: clear state
    setTimeout(() => stopSpeech(), 100);
  };

  return (
    <div className="min-h-screen gradient-hero pt-16 flex flex-col">
      {/* Top bar */}
      <div className="border-b border-white/10 bg-[#0a0a0f]/80 backdrop-blur-xl sticky top-16 z-50">
        <div className="max-w-full px-3 sm:px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden ring-2 ring-purple-500/30 shrink-0">
              <img src="/images/aura-avatar.jpg" alt="Aura" className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-white text-sm sm:text-base truncate">Aura - GlamBot</p>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-white/50">AI</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative hidden sm:block">
              <button
                onClick={() => setShowFeatures((s) => !s)}
                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white/90 px-3 py-2 rounded-lg text-sm transition-colors"
              >
                Features
              </button>
              {showFeatures && (
                <div className="fixed left-0 right-0 top-16 bottom-0 z-40 flex items-start justify-center pointer-events-auto">
                  <div className="absolute inset-0 bg-black/60" onClick={() => setShowFeatures(false)} />
                  <div className="relative w-full max-w-6xl mx-4 mt-6 overflow-hidden rounded-2xl">
                    <div className="bg-transparent">
                      <AIFeatureShowcase />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <select
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              className="bg-gradient-to-r from-purple-800 to-purple-900 text-white text-xs rounded px-2 py-1 border border-purple-700/40 focus:outline-none focus:ring-2 focus:ring-purple-600"
            >
              <option value="professional" style={{ backgroundColor: '#2b0756', color: '#fff' }}>Professional</option>
              <option value="friendly" style={{ backgroundColor: '#2b0756', color: '#fff' }}>Friendly</option>
            </select>
          </div>
        </div>
      </div>

      {/* Body: sidebar + chat area side by side */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left sidebar */}
        <div className={`hidden lg:flex flex-col shrink-0 border-r border-white/10 bg-[#05050a]/90 transition-all duration-200 ${sidebarOpen ? 'w-56' : 'w-14'}`}
          style={{ height: 'calc(100vh - 8rem)' }}
        >
          <div className="flex flex-col h-full overflow-hidden p-3">
            <button
              onClick={() => setSidebarOpen(s => !s)}
              className="mb-3 p-2 rounded-lg hover:bg-white/10 text-white/70 self-end transition-all duration-200"
            >
              {sidebarOpen ? '<' : '>'}
            </button>

            {sidebarOpen ? (
              <div className="flex flex-col gap-3 overflow-auto flex-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                <button onClick={handleNewChat} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-600/20 to-pink-500/20 border border-purple-500/30 text-white/90 hover:bg-purple-600/30 transition-all duration-200">
                  <MessageSquare className="w-4 h-4 shrink-0" />
                  <span className="text-sm">New chat</span>
                </button>
                <button onClick={() => setShowGoogleSearch(s => !s)} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition-all duration-200">
                  <Search className="w-4 h-4 shrink-0" />
                  <span className="text-sm">Search web</span>
                </button>

                {showGoogleSearch && (
                  <div className="px-2 pt-1">
                    <div className="text-xs text-white/60 mb-2">Search the web (Google CSE)</div>
                    <div className="h-48 overflow-auto rounded-lg bg-white/5 p-2 border border-white/5">
                      <GoogleCSE />
                    </div>
                  </div>
                )}

                <div className="px-1">
                  <input
                    value={chatSearch}
                    onChange={(e) => setChatSearch(e.target.value)}
                    placeholder="Search chats..."
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-white/50 focus:outline-none focus:border-purple-500/50 transition-all"
                  />
                </div>

                <div className="text-xs text-white/50 px-2 font-medium tracking-wide uppercase mt-2">Pinned</div>
                <div className="px-1 space-y-1 overflow-auto max-h-32 scrollbar-thin scrollbar-thumb-white/10">
                  {pinnedConversations.map((c: any, i: number) => (
                    <div key={c.id || i} onClick={() => {
                      if (c.messages) {
                        const mapped = (c.messages || []).map((m: any) => ({ role: m.role, content: m.content, timestamp: m.timestamp ? new Date(m.timestamp) : new Date() }));
                        setMessages(mapped);
                        setLanguage(c.language || 'auto');
                        setMessagesByLanguage(prev => ({ ...prev, [c.language || 'auto']: mapped }));
                        setCurrentConversationId(c.id || null);
                      }
                    }} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/10 transition-all cursor-pointer group">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center text-xs font-semibold text-white shrink-0">
                        {(c.title || 'C').slice(0, 1)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-white/90 truncate font-medium">{c.title}</div>
                        <div className="text-[10px] text-white/40">{c.created_at ? new Date(c.created_at).toLocaleDateString() : ''}</div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete?')) deleteConversation(c); }} className="p-1 rounded hover:bg-red-500/20 opacity-0 group-hover:opacity-100">
                        <Trash2 className="w-3 h-3 text-red-400" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="text-xs text-white/50 px-2 font-medium tracking-wide uppercase">Recents</div>
                <div className="px-1 space-y-1 overflow-auto flex-1 scrollbar-thin scrollbar-thumb-white/10">
                  {filteredConversations.map((c: any, i: number) => (
                    <div key={c.id || i} onClick={() => {
                      if (c.messages) {
                        const mapped = (c.messages || []).map((m: any) => ({ role: m.role, content: m.content, timestamp: m.timestamp ? new Date(m.timestamp) : new Date() }));
                        setMessages(mapped);
                        setLanguage(c.language || 'auto');
                        setMessagesByLanguage(prev => ({ ...prev, [c.language || 'auto']: mapped }));
                        setCurrentConversationId(c.id || null);
                      }
                    }} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/10 transition-all cursor-pointer group">
                      <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center text-xs font-semibold text-white shrink-0">
                        {(c.title || 'C').slice(0, 1)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-white/90 truncate font-medium">{c.title}</div>
                        <div className="text-[10px] text-white/40">{c.created_at ? new Date(c.created_at).toLocaleDateString() : ''}</div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete?')) deleteConversation(c); }} className="p-1 rounded hover:bg-red-500/20 opacity-0 group-hover:opacity-100">
                        <Trash2 className="w-3 h-3 text-red-400" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* User profile at bottom */}
                <div className="mt-auto pt-3 border-t border-white/10">
                  {isLoggedIn && profile ? (
                    <div className="flex items-center gap-2">
                      <button onClick={() => router.push('/profile')} className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-purple-500/30 shrink-0">
                        <img src={profile.avatar_url || '/images/aura-avatar.jpg'} alt="avatar" className="w-full h-full object-cover" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-white/90 font-medium truncate">{profile.full_name || profile.email}</div>
                      </div>
                      <button onClick={() => signOut()} className="text-xs text-red-400 hover:text-red-300 px-1">Out</button>
                    </div>
                  ) : (
                    <button onClick={() => router.push('/auth/login')} className="flex items-center gap-2 text-white/70 hover:text-white/90 text-sm">
                      <LogIn className="w-4 h-4" /> Sign in
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 mt-2">
                <button onClick={handleNewChat} title="New chat" className="p-2 rounded hover:bg-white/10"><MessageSquare className="w-5 h-5 text-white/80" /></button>
                <button title="Search" className="p-2 rounded hover:bg-white/10"><Search className="w-5 h-5 text-white/70" /></button>
                <button title="Pinned" className="p-2 rounded hover:bg-white/10"><Pin className="w-5 h-5 text-white/70" /></button>
                <button title="Recents" className="p-2 rounded hover:bg-white/10"><Clock className="w-5 h-5 text-white/70" /></button>
                <div className="mt-auto pb-2">
                  {isLoggedIn && profile ? (
                    <button onClick={() => router.push('/profile')} className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-purple-500/30">
                      <img src={profile.avatar_url || '/images/aura-avatar.jpg'} alt="avatar" className="w-full h-full object-cover" />
                    </button>
                  ) : (
                    <button onClick={() => router.push('/auth/login')} title="Sign in" className="p-2 rounded hover:bg-white/10"><LogIn className="w-5 h-5 text-white/70" /></button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main chat column */}
        <div className="flex-1 flex flex-col min-w-0" style={{ height: 'calc(100vh - 8rem)' }}>
          {/* Scrollable messages */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

              {/* Welcome message for empty state */}
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 px-6">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center mb-6 shadow-lg shadow-purple-500/30">
                    <Sparkles className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-2xl font-semibold text-white mb-2">Welcome to AuraAI</h2>
                  <p className="text-white/60 text-center max-w-md mb-8">Your personal beauty advisor for Mumbai. Ask me anything about hairstyles, makeup, skincare, or find the perfect salon for you.</p>
                  
                  {/* Suggested prompts */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
                    <button onClick={() => setInput("What hairstyle would suit me for a wedding?")} className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-purple-500/30 transition-all duration-200 text-left group">
                      <div className="text-white/90 text-sm font-medium group-hover:text-purple-300 transition-colors">ðŸ’‡â€â™€ï¸ Wedding hairstyle advice</div>
                      <div className="text-white/50 text-xs mt-1">Get recommendations for bridal looks</div>
                    </button>
                    <button onClick={() => setInput("Best salons in Bandra for hair treatment")} className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-purple-500/30 transition-all duration-200 text-left group">
                      <div className="text-white/90 text-sm font-medium group-hover:text-purple-300 transition-colors">ðŸª Find top-rated salons</div>
                      <div className="text-white/50 text-xs mt-1">Discover salons in your area</div>
                    </button>
                    <button onClick={() => setInput("Skincare routine for oily skin")} className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-purple-500/30 transition-all duration-200 text-left group">
                      <div className="text-white/90 text-sm font-medium group-hover:text-purple-300 transition-colors">ðŸ§´ Skincare tips</div>
                      <div className="text-white/50 text-xs mt-1">Personalized routines for your skin type</div>
                    </button>
                    <button onClick={() => setInput("Latest makeup trends for 2024")} className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-purple-500/30 transition-all duration-200 text-left group">
                      <div className="text-white/90 text-sm font-medium group-hover:text-purple-300 transition-colors">ðŸ’„ Makeup trends</div>
                      <div className="text-white/50 text-xs mt-1">Stay updated with current styles</div>
                    </button>
                  </div>
                </div>
              )}

              {messages.map((m, i) => {
                const isUser = m.role === 'user';
                const isLast = i === messages.length - 1;
                const containerId = `msg-${i}`;
                
                // Calculate dynamic width based on content length
                const contentLength = (m.content || '').length;
                let dynamicWidth = 'max-w-[85%]'; // Default for long messages
                if (contentLength < 100) {
                  dynamicWidth = 'max-w-[60%]'; // Short messages
                } else if (contentLength < 300) {
                  dynamicWidth = 'max-w-[70%]'; // Medium messages
                } else if (contentLength < 800) {
                  dynamicWidth = 'max-w-[80%]'; // Long messages
                }
                
                return (
                  <div key={i} id={containerId} className={cn(
                    "flex gap-3 items-start w-full",
                    isUser ? 'flex-row-reverse justify-start' : 'justify-start'
                  )}>
                    {/* Avatar */}
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-sm md:w-9 md:h-9 sm:w-8 sm:h-8",
                      isUser ? 'bg-gradient-to-br from-purple-600 to-pink-500' : 'bg-white/5 border border-white/10'
                    )}>
                      {isUser ? <User className="w-4 h-4 text-white md:w-3.5 md:h-3.5" /> : <Sparkles className="w-4 h-4 text-white md:w-3.5 md:h-3.5" />}
                    </div>

                    {/* Message bubble */}
                    <div className={cn(
                      "rounded-2xl px-5 py-4 text-sm leading-relaxed shadow md:px-4 md:py-3 sm:px-3 sm:py-2.5",
                      dynamicWidth,
                      "md:max-w-[75%] sm:max-w-[85%]", // Tablet and mobile widths
                      isUser
                        ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white border border-purple-700/30 rounded-tr-none'
                        : 'bg-white/5 border border-white/10 text-white/85 rounded-tl-none'
                    )}>
                      {/* Render user messages with formatting, assistant messages with per-word spans for highlighting */}
                      {isUser ? (
                        <div dangerouslySetInnerHTML={{ __html: formatContent(m.content || '').replace(/\n/g,'<br/>') }} />
                      ) : (
                        <>
                          {(() => {
                            const { text, cta } = extractCTA(m.content || '');
                            return (
                              <>
                                <div className="text-sm leading-relaxed whitespace-pre-wrap md:text-xs" dangerouslySetInnerHTML={{ __html: formatContent(text.replace(/\n\n/g, '\n').replace(/([.!?])\n/g, '$1\n')).replace(/\n/g, '<br/>') }} />
                                {cta && (
                                  <a href={cta.link} className="inline-block mt-3 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-500 text-white text-xs font-semibold rounded-lg hover:shadow-lg hover:shadow-purple-500/50 transition-all duration-300 hover:-translate-y-0.5">
                                    {cta.label}
                                  </a>
                                )}
                              </>
                            );
                          })()}
                        </>
                      )}

                      <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          {!isUser && (
                            <>
                              <button onClick={(e)=>{ e.stopPropagation(); try { navigator.clipboard?.writeText(m.content || '') } catch{} }} className="p-1 rounded bg-white/6 hover:bg-white/8 transition-colors">
                                <Copy className="w-3.5 h-3.5 text-white/90" />
                              </button>
                              {speakingIndex === i ? (
                                <button onClick={(e)=>{ e.stopPropagation(); stopSpeech(); }} className="p-1 rounded bg-white/6 hover:bg-white/8 transition-colors">
                                  <Pause className="w-3.5 h-3.5 text-white/90" />
                                </button>
                              ) : (
                                <button onClick={(e)=>{ e.stopPropagation(); playMessageSpeech(m, i); }} className="p-1 rounded bg-white/6 hover:bg-white/8 transition-colors">
                                  <Volume2 className="w-3.5 h-3.5 text-white/90" />
                                </button>
                              )}
                            </>
                          )}

                          {speakingIndex === i && (
                            <div className="w-32 h-1 bg-white/10 rounded overflow-hidden sm:w-24">
                              <div style={{ width: `${Math.round(speakingProgress * 100)}%` }} className="h-full bg-purple-400 transition-all duration-150" />
                            </div>
                          )}
                        </div>

                        <p className="text-[11px] text-white/40 shrink-0">{mounted ? new Date(m.timestamp).toLocaleTimeString() : ''}</p>
                      </div>
                    </div>

                    {/* Show carousel inline after assistant message if it has images */}
                    {!isUser && isLast && (parsed as any)?.images && (parsed as any).images.length > 0 && (
                      <div className="w-full mt-4 ml-14 md:ml-12 sm:ml-11">
                        <ImageCarousel images={(parsed as any).images} />
                      </div>
                    )}
                  </div>
                );
              })}
              
              {/* AI Thinking Animation */}
              {isLoading && (
                <div className="flex gap-3 items-start w-full justify-start animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 bg-white/5 border border-white/10 shadow-sm md:w-9 md:h-9 sm:w-8 sm:h-8">
                    <Sparkles className="w-4 h-4 text-purple-400 animate-pulse md:w-3.5 md:h-3.5" />
                  </div>
                  
                  <div className="relative rounded-2xl px-5 py-4 bg-white/5 border border-white/10 max-w-[320px] md:px-4 md:py-3 sm:px-3 sm:py-2.5 sm:max-w-[280px]">
                    {/* Animated thinking text */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm text-white/70 font-medium md:text-xs">AuraAI is thinking</span>
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1s' }}></span>
                        <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms', animationDuration: '1s' }}></span>
                        <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms', animationDuration: '1s' }}></span>
                      </div>
                    </div>
                    
                    {/* Shimmer effect lines */}
                    <div className="space-y-2">
                      <div className="h-3 bg-gradient-to-r from-white/5 via-white/10 to-white/5 rounded animate-shimmer" style={{ width: '100%', backgroundSize: '200% 100%' }}></div>
                      <div className="h-3 bg-gradient-to-r from-white/5 via-white/10 to-white/5 rounded animate-shimmer" style={{ width: '85%', backgroundSize: '200% 100%', animationDelay: '0.2s' }}></div>
                      <div className="h-3 bg-gradient-to-r from-white/5 via-white/10 to-white/5 rounded animate-shimmer" style={{ width: '70%', backgroundSize: '200% 100%', animationDelay: '0.4s' }}></div>
                    </div>
                    
                    {/* Pulsing glow effect */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-500/0 via-purple-500/5 to-purple-500/0 animate-pulse pointer-events-none"></div>
                  </div>
                </div>
              )}
              
              <div ref={bottomRef} />
            </div>
          </div>

          {/* Input bar */}
          <div className="border-t border-white/10 bg-[#05050a]/95 backdrop-blur-xl shrink-0">
            <div className="px-4 sm:px-5 py-3 sm:py-4">
              <div className="flex gap-2 items-end">
                <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl flex items-end gap-3 px-4 py-3 min-w-0 focus-within:border-purple-500/50 focus-within:bg-white/10 transition-all duration-200">
                  <div className="flex-1 min-w-0">
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                      placeholder="Ask about beauty, salons, or treatments..."
                      className="w-full bg-transparent text-white text-sm placeholder:text-white/40 outline-none"
                    />
                    {attachedImage && (
                      <div className="mt-2 flex items-center gap-2">
                        <img src={attachedImage} alt="attached" className="w-16 h-16 object-cover rounded-lg border border-white/20" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white/70">Image attached</p>
                          <div className="flex gap-2 mt-1.5">
                            <button onClick={() => setAttachedImage(null)} className="text-xs px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">Remove</button>
                            <button onClick={() => sendMessage()} className="text-xs px-2 py-1 rounded-lg bg-gradient-to-r from-purple-600 to-pink-500 transition-all">Send</button>
                          </div>
                        </div>
                      </div>
                    )}
                    <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageSelect} />
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-xl hover:bg-white/10 transition-colors" title="Attach image">
                      <Camera className="w-4 h-4 text-white/60 hover:text-white/90 transition-colors" />
                    </button>
                    <button onClick={startStopRecording} className="p-2 rounded-xl hover:bg-white/10 transition-colors" title="Voice input">
                      <Mic className="w-4 h-4 text-white/60 hover:text-white/90 transition-colors" />
                    </button>
                  </div>
                </div>

                <select
                  value={language}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  className="bg-white/5 border border-white/10 text-white text-xs rounded-xl px-2.5 py-2.5 focus:outline-none focus:border-purple-500/50 transition-all cursor-pointer hover:bg-white/10 shrink-0 h-10"
>
                  <option value="auto" style={{ backgroundColor: "#0a0a0f", color: "#fff" }}>Auto</option>
                  <option value="en" style={{ backgroundColor: "#0a0a0f", color: "#fff" }}>English</option>
                  <option value="hi" style={{ backgroundColor: "#0a0a0f", color: "#fff" }}>Hindi</option>
                  <option value="mr" style={{ backgroundColor: "#0a0a0f", color: "#fff" }}>Marathi</option>
                  <option value="gu" style={{ backgroundColor: "#0a0a0f", color: "#fff" }}>Gujarati</option>
                  <option value="bn" style={{ backgroundColor: "#0a0a0f", color: "#fff" }}>Bengali</option>
                  <option value="ta" style={{ backgroundColor: "#0a0a0f", color: "#fff" }}>Tamil</option>
                  <option value="te" style={{ backgroundColor: "#0a0a0f", color: "#fff" }}>Telugu</option>
                  <option value="kn" style={{ backgroundColor: "#0a0a0f", color: "#fff" }}>Kannada</option>
                  <option value="ml" style={{ backgroundColor: "#0a0a0f", color: "#fff" }}>Malayalam</option>
                  <option value="pa" style={{ backgroundColor: "#0a0a0f", color: "#fff" }}>Punjabi</option>
                  <option value="ur" style={{ backgroundColor: "#0a0a0f", color: "#fff" }}>Urdu</option>
                </select>

                <Button
                  onClick={() => sendMessage()}
                  disabled={(!input.trim() && !attachedImage) || isLoading || isTranslating}
                  className="h-10 w-10 p-0 rounded-xl shrink-0 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 transition-all shadow-lg shadow-purple-500/30"
                  aria-label="Send message"
>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-center text-xs text-white/30 mt-2 hidden sm:block">
                AuraAI may occasionally be inaccurate. Always confirm details with the salon.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
