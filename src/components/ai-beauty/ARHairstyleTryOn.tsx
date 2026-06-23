"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Sparkles, Download, ChevronLeft, Wand2, User,
  Check, Video, AlertCircle, Activity, Loader2, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { mediaPipeFaceEngine, type FaceMeshResult } from "@/lib/ai-beauty/mediapipe-face-engine";
import { arHairRenderer, type HairstyleCatalogItem } from "@/lib/ai-beauty/ar-hair-renderer";

type Gender = "men" | "women";

async function getCameraStream(): Promise<MediaStream> {
  const attempts: MediaStreamConstraints[] = [
    { video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } } },
    { video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } },
    { video: { facingMode: "user" } },
    { video: true },
  ];

  let lastError: unknown;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

export default function ARHairstyleTryOn() {
  const [gender, setGender] = useState<Gender | null>(null);
  const [catalog, setCatalog] = useState<HairstyleCatalogItem[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<HairstyleCatalogItem | null>(null);
  const [appliedStyle, setAppliedStyle] = useState<HairstyleCatalogItem | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [faceResult, setFaceResult] = useState<FaceMeshResult | null>(null);
  const [accuracy, setAccuracy] = useState(0);
  const [fps, setFps] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastFpsTime = useRef(0);
  const frameCount = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const appliedStyleRef = useRef<HairstyleCatalogItem | null>(null);
  const lastUiUpdate = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    appliedStyleRef.current = appliedStyle;
  }, [appliedStyle]);

  const initEngine = useCallback(async () => {
    if (mediaPipeFaceEngine.isReady()) return true;
    setIsInitializing(true);
    try {
      return await mediaPipeFaceEngine.initialize();
    } finally {
      if (mountedRef.current) setIsInitializing(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsCameraActive(false);
    arHairRenderer.clearHairstyle();
  }, []);

  const startRenderLoop = useCallback(() => {
    const loop = (timestamp: number) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(loop);
        return;
      }

      frameCount.current++;
      if (timestamp - lastFpsTime.current >= 1000) {
        setFps(frameCount.current);
        frameCount.current = 0;
        lastFpsTime.current = timestamp;
      }

      const result = mediaPipeFaceEngine.detectFrameSync(video);

      if (timestamp - lastUiUpdate.current > 150) {
        lastUiUpdate.current = timestamp;
        setFaceResult(result);
        setAccuracy(mediaPipeFaceEngine.getAccuracyPercent(result));
      }

      if (appliedStyleRef.current) {
        arHairRenderer.renderFrame(canvas, video, result);
      } else {
        const w = video.videoWidth;
        const h = video.videoHeight;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.save();
          ctx.translate(w, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(video, 0, 0, w, h);
          ctx.restore();

          if (result.detected && result.landmarks.length > 0) {
            result.landmarks.forEach((lm) => {
              const x = (1 - lm.x) * w;
              const y = lm.y * h;
              ctx.fillStyle = "rgba(96, 165, 250, 0.35)";
              ctx.fillRect(x - 1, y - 1, 2, 2);
            });
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
  }, []);

  const startCamera = useCallback(async (g: Gender) => {
    stopCamera();
    setCameraError(null);
    setIsLoadingCatalog(true);

    const engineOk = await initEngine();
    if (!engineOk) {
      setIsLoadingCatalog(false);
      return;
    }

    try {
      const items = await arHairRenderer.loadCatalog(g);
      if (mountedRef.current) setCatalog(items);
    } catch (e) {
      console.error("Catalog load error:", e);
    } finally {
      if (mountedRef.current) setIsLoadingCatalog(false);
    }

    try {
      const stream = await getCameraStream();
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;

      video.srcObject = stream;
      video.playsInline = true;
      video.muted = true;

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("Video failed to load"));
      });
      await video.play();

      if (!mountedRef.current) return;
      setIsCameraActive(true);
      startRenderLoop();
    } catch (err) {
      console.error("Camera error:", err);
      if (mountedRef.current) {
        setCameraError("Could not access camera. Please allow camera permission and try again.");
      }
    }
  }, [initEngine, stopCamera, startRenderLoop]);

  const handleSelectGender = (g: Gender) => {
    setGender(g);
    setSelectedStyle(null);
    setAppliedStyle(null);
    startCamera(g);
  };

  const handleApplyHairstyle = (style: HairstyleCatalogItem) => {
    console.log(`🎨 USER ACTION: Applying hairstyle "${style.name}" (${style.id})`);
    setSelectedStyle(style);
    arHairRenderer.applyHairstyle(style);
    setAppliedStyle(style);
    console.log(`✅ Hairstyle "${style.name}" is now ACTIVE and should be VISIBLE on your head`);
  };

  const handleClearHairstyle = () => {
    arHairRenderer.clearHairstyle();
    setAppliedStyle(null);
    setSelectedStyle(null);
  };

  const downloadSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `glamhub-ar-${appliedStyle?.name || "preview"}-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopCamera();
    };
  }, [stopCamera]);

  return (
    <div className="min-h-screen gradient-hero pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-purple-500/30 mb-4">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-purple-300">MediaPipe Face Mesh • Three.js AR</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            AR Hairstyle <span className="gradient-text">Try-On</span>
          </h1>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            Real-time 3D hairstyles anchored to your face with 468 landmark tracking
          </p>
        </div>

        {!gender && (
          <div className="max-w-2xl mx-auto">
            <div className="glass rounded-3xl p-8 border border-white/10">
              <h2 className="text-2xl font-bold text-white mb-6 text-center">Select Your Gender</h2>
              <div className="grid grid-cols-2 gap-4">
                {(["men", "women"] as Gender[]).map((g) => (
                  <button
                    key={g}
                    onClick={() => handleSelectGender(g)}
                    className={cn(
                      "group p-8 rounded-2xl glass border border-white/10 transition-all duration-300",
                      g === "men"
                        ? "hover:border-blue-500/50 hover:bg-blue-500/10"
                        : "hover:border-pink-500/50 hover:bg-pink-500/10"
                    )}
                  >
                    <User className={cn("w-12 h-12 mx-auto mb-4", g === "men" ? "text-blue-400" : "text-pink-400")} />
                    <p className="text-xl font-semibold text-white mb-2 capitalize">{g}</p>
                    <p className="text-sm text-white/50">3D GLB Hairstyles</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {gender && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="glass rounded-3xl p-6 border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <Button
                  variant="ghost"
                  onClick={() => { stopCamera(); setGender(null); setCatalog([]); handleClearHairstyle(); }}
                  className="text-white/60"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <div className="flex items-center gap-2">
                  {isCameraActive && (
                    <Badge className="bg-red-500/80">
                      <div className="w-2 h-2 rounded-full bg-white mr-2 animate-pulse" />
                      LIVE {fps} FPS
                    </Badge>
                  )}
                  {appliedStyle && (
                    <Button size="sm" onClick={downloadSnapshot} className="gap-1">
                      <Download className="w-4 h-4" />
                      Save
                    </Button>
                  )}
                </div>
              </div>

              <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-black">
                <video ref={videoRef} className="hidden" playsInline muted />
                <canvas ref={canvasRef} className="w-full h-full object-cover" />

                {(isInitializing || isLoadingCatalog) && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
                    <Loader2 className="w-10 h-10 text-purple-400 animate-spin mb-3" />
                    <p className="text-white/70 text-sm">
                      {isInitializing ? "Loading MediaPipe Face Mesh..." : "Loading 3D hairstyle models..."}
                    </p>
                  </div>
                )}

                {cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-6">
                    <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
                    <p className="text-white/80 text-sm text-center">{cameraError}</p>
                  </div>
                )}

                {isCameraActive && (
                  <div className="absolute top-4 left-4 glass rounded-xl p-3 border border-white/20">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={cn("w-2 h-2 rounded-full", faceResult?.detected ? "bg-green-400 animate-pulse" : "bg-red-400")} />
                      <span className="text-xs font-medium text-white">468-Point Face Mesh</span>
                    </div>
                    <div className="text-xs text-white/60">Tracking: {accuracy}%</div>
                    {faceResult?.detected && (
                      <div className="flex items-center gap-1 mt-1">
                        <Activity className="w-3 h-3 text-purple-400" />
                        <span className="text-xs text-purple-300 capitalize">{faceResult.quality} • {faceResult.faceShape} face</span>
                      </div>
                    )}
                  </div>
                )}

                {appliedStyle && (
                  <div className="absolute bottom-4 left-4 right-4 glass rounded-xl p-3 border border-purple-500/30">
                    <p className="text-sm font-semibold text-white">{appliedStyle.name}</p>
                    <p className="text-xs text-purple-300">3D AR Active • Locked to head</p>
                  </div>
                )}

                {!faceResult?.detected && isCameraActive && !isLoadingCatalog && !cameraError && (
                  <div className="absolute bottom-4 left-4 right-4 glass rounded-xl p-3 border border-yellow-500/30 bg-yellow-500/10">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-yellow-400" />
                      <p className="text-xs text-yellow-200">Center your face in good lighting for tracking</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 flex gap-3">
                {appliedStyle ? (
                  <Button onClick={handleClearHairstyle} variant="outline" className="flex-1">
                    Remove Hairstyle
                  </Button>
                ) : (
                  <Button
                    onClick={() => selectedStyle && handleApplyHairstyle(selectedStyle)}
                    disabled={!selectedStyle || !faceResult?.detected}
                    className="flex-1 h-12 bg-gradient-to-r from-purple-600 to-pink-600"
                  >
                    <Zap className="w-5 h-5 mr-2" />
                    {selectedStyle ? `Apply ${selectedStyle.name}` : "Select a Hairstyle"}
                  </Button>
                )}
              </div>
            </div>

            <div className="glass rounded-3xl p-6 border border-white/10">
              <h3 className="text-xl font-bold text-white mb-1">Choose Hairstyle</h3>
              <p className="text-sm text-white/50 mb-4">Tap to preview • Apply for live 3D AR on your head</p>

              <div className="space-y-3 max-h-[620px] overflow-y-auto pr-2 custom-scrollbar">
                {catalog.map((style) => {
                  const compat = faceResult?.detected
                    ? arHairRenderer.getCompatibilityScore(style, faceResult.faceShape)
                    : null;
                  const isSelected = selectedStyle?.id === style.id;
                  const isApplied = appliedStyle?.id === style.id;

                  return (
                    <button
                      key={style.id}
                      onClick={() => setSelectedStyle(style)}
                      className={cn(
                        "w-full p-4 rounded-xl border transition-all duration-200 text-left",
                        isApplied
                          ? "border-green-500 bg-green-500/10"
                          : isSelected
                          ? "border-purple-500 bg-purple-500/10"
                          : "border-white/10 glass hover:border-white/30"
                      )}
                    >
                      <div className="flex gap-3">
                        <div className="w-20 h-20 rounded-lg overflow-hidden bg-[#1a1a2e] shrink-0 relative">
                          {style.thumbnail ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={style.thumbnail}
                              alt={style.name}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full">
                              <Wand2 className="w-8 h-8 text-purple-400" />
                            </div>
                          )}
                          {isApplied && (
                            <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                              <Check className="w-6 h-6 text-green-400" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-semibold text-white truncate">{style.name}</p>
                            {isSelected && !isApplied && <Check className="w-4 h-4 text-purple-400 shrink-0" />}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-white/60 mb-1">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{style.category}</Badge>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{style.difficulty}</Badge>
                          </div>
                          <p className="text-xs text-emerald-400 font-medium mb-1">{style.price}</p>
                          {compat !== null && (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                                  style={{ width: `${compat}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-purple-300">{compat}% match</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1 mt-1 text-[10px] text-white/40">
                            <Video className="w-3 h-3" />
                            <span>Real 3D GLB model</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}

                {catalog.length === 0 && !isLoadingCatalog && (
                  <p className="text-white/50 text-center py-8">No hairstyles loaded</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(168,85,247,0.4); border-radius: 10px; }
      `}</style>
    </div>
  );
}
