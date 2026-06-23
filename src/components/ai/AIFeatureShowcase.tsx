"use client";

import { motion } from "framer-motion";
import { 
  Mic, Camera, Sparkles, Zap, Brain, MessageSquare,
  TrendingUp, Award, Shield, Rocket
} from "lucide-react";

const features = [
  {
    icon: <Mic className="w-6 h-6" />,
    title: "Voice Conversations",
    description: "Speak naturally and get instant voice responses",
    color: "from-purple-500 to-pink-500",
    delay: 0.1,
  },
  {
    icon: <Camera className="w-6 h-6" />,
    title: "Image Analysis",
    description: "Upload selfies for personalized beauty insights",
    color: "from-pink-500 to-rose-500",
    delay: 0.2,
  },
  {
    icon: <Sparkles className="w-6 h-6" />,
    title: "Smart Recommendations",
    description: "AI-powered salon matching based on your needs",
    color: "from-rose-500 to-orange-500",
    delay: 0.3,
  },
  {
    icon: <Zap className="w-6 h-6" />,
    title: "Real-time Streaming",
    description: "See responses appear instantly as AI types",
    color: "from-orange-500 to-amber-500",
    delay: 0.4,
  },
  {
    icon: <Brain className="w-6 h-6" />,
    title: "Context Memory",
    description: "Remembers your preferences and history",
    color: "from-amber-500 to-yellow-500",
    delay: 0.5,
  },
  {
    icon: <MessageSquare className="w-6 h-6" />,
    title: "Multi-Personality",
    description: "Switch between Professional, Friendly, or Expert modes",
    color: "from-yellow-500 to-lime-500",
    delay: 0.6,
  },
];

const stats = [
  { icon: <TrendingUp />, value: "95%", label: "Accuracy Rate" },
  { icon: <Award />, value: "<2s", label: "Response Time" },
  { icon: <Shield />, value: "100%", label: "Privacy Safe" },
  { icon: <Rocket />, value: "24/7", label: "Always Online" },
];

export default function AIFeatureShowcase() {
  return (
    <div className="py-20 px-4 bg-gradient-to-b from-[#0a0a0f] via-purple-950/10 to-[#0a0a0f]">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-purple-500/30 mb-6">
            <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
            <span className="text-sm text-purple-300 font-medium">Powered by GPT-4</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Meet <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">GlamAI Pro</span>
          </h2>
          
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            Your intelligent beauty companion that understands, recommends, and transforms your salon experience with cutting-edge AI technology.
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: feature.delay }}
              whileHover={{ scale: 1.05, y: -5 }}
              className="glass rounded-2xl p-6 border border-white/10 hover:border-purple-500/30 transition-all duration-300 group"
            >
              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 shadow-lg group-hover:shadow-xl transition-shadow duration-300`}>
                <div className="text-white">
                  {feature.icon}
                </div>
              </div>
              
              <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-purple-300 transition-colors">
                {feature.title}
              </h3>
              
              <p className="text-sm text-white/60 leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6"
        >
          {stats.map((stat, index) => (
            <div
              key={index}
              className="glass rounded-xl p-6 border border-white/10 text-center hover:border-purple-500/30 transition-all duration-300"
            >
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center mx-auto mb-3">
                <div className="text-purple-400">
                  {stat.icon}
                </div>
              </div>
              <div className="text-2xl md:text-3xl font-bold text-white mb-1">
                {stat.value}
              </div>
              <div className="text-xs md:text-sm text-white/50">
                {stat.label}
              </div>
            </div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.9 }}
          className="text-center mt-16"
        >
          <a
            href="/ai-assistant"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 text-white font-semibold shadow-2xl shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-105 transition-all duration-300"
          >
            <Sparkles className="w-5 h-5" />
            <span>Try GlamAI Pro Now</span>
          </a>
        </motion.div>
      </div>
    </div>
  );
}
