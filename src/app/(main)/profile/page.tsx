"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/useAuth";
import { Button } from "@/components/ui/button";
import { User, Camera, Mail, Phone, Calendar, Award, ArrowLeft, Loader2, Check } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

export default function ProfilePage() {
  const { profile, updateUserProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || "",
    phone: profile?.phone || "",
    avatar_url: profile?.avatar_url || "",
  });

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    
    const result = await updateUserProfile(formData);
    
    setIsSaving(false);
    
    if (!result.error) {
      setSaveSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  const handleCancel = () => {
    setFormData({
      full_name: profile?.full_name || "",
      phone: profile?.phone || "",
      avatar_url: profile?.avatar_url || "",
    });
    setIsEditing(false);
  };

  if (!profile) {
    return (
      <div className="min-h-screen gradient-hero flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/50">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-hero pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <Link href="/">
          <Button variant="ghost" className="mb-6 gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
        </Link>

        {/* Profile Card */}
        <div className="glass rounded-3xl border border-white/20 overflow-hidden">
          {/* Header */}
          <div className="relative h-32 bg-gradient-to-r from-purple-600 to-pink-600">
            <div className="absolute inset-0 bg-black/20" />
          </div>

          {/* Profile Content */}
          <div className="relative px-6 sm:px-8 pb-8">
            {/* Avatar */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between -mt-16 mb-6">
              <div className="relative">
                <div className="w-32 h-32 rounded-2xl overflow-hidden ring-4 ring-[#0a0a0f] bg-white/5">
                  {profile.avatar_url ? (
                    <Image 
                      src={profile.avatar_url} 
                      alt={profile.full_name || 'Profile'}
                      width={128}
                      height={128}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-4xl font-bold">
                      {profile.full_name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?"}
                    </div>
                  )}
                </div>
                <button className="absolute bottom-0 right-0 w-10 h-10 rounded-xl bg-purple-500 hover:bg-purple-600 border-4 border-[#0a0a0f] flex items-center justify-center transition-colors">
                  <Camera className="w-5 h-5 text-white" />
                </button>
              </div>

              {/* Edit Button */}
              <div className="mt-4 sm:mt-0">
                {!isEditing ? (
                  <Button onClick={() => setIsEditing(true)} className="w-full sm:w-auto">
                    <User className="w-4 h-4 mr-2" />
                    Edit Profile
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button onClick={handleCancel} variant="outline" className="w-full sm:w-auto">
                      Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Success Message */}
            {saveSuccess && (
              <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-center gap-2">
                <Check className="w-4 h-4" />
                Profile updated successfully!
              </div>
            )}

            {/* Profile Info */}
            <div className="space-y-6">
              {/* Full Name */}
              <div>
                <label className="text-sm text-white/60 mb-2 block">Full Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:border-purple-500/50 focus:outline-none transition-colors"
                    placeholder="Enter your full name"
                  />
                ) : (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
                    <User className="w-5 h-5 text-white/40" />
                    <span className="text-white text-lg">{profile.full_name || "Not set"}</span>
                  </div>
                )}
              </div>

              {/* Email (Read-only) */}
              <div>
                <label className="text-sm text-white/60 mb-2 block">Email</label>
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 opacity-60">
                  <Mail className="w-5 h-5 text-white/40" />
                  <span className="text-white">{profile.email}</span>
                  <span className="ml-auto text-xs text-white/40">Read-only</span>
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="text-sm text-white/60 mb-2 block">Phone Number</label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:border-purple-500/50 focus:outline-none transition-colors"
                    placeholder="Enter your phone number"
                  />
                ) : (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
                    <Phone className="w-5 h-5 text-white/40" />
                    <span className="text-white">{profile.phone || "Not set"}</span>
                  </div>
                )}
              </div>

              {/* Member Since */}
              <div>
                <label className="text-sm text-white/60 mb-2 block">Member Since</label>
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
                  <Calendar className="w-5 h-5 text-white/40" />
                  <span className="text-white">
                    {new Date(profile.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "long",
                      year: "numeric"
                    })}
                  </span>
                </div>
              </div>

              {/* Membership Tier */}
              <div>
                <label className="text-sm text-white/60 mb-2 block">Membership Tier</label>
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
                  <Award className="w-5 h-5 text-purple-400" />
                  <span className="text-white capitalize">
                    {(profile as any).membership_tier || "Basic"}
                  </span>
                </div>
              </div>

              {/* GlamPoints */}
              <div>
                <label className="text-sm text-white/60 mb-2 block">GlamPoints Balance</label>
                <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <Award className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold gradient-text">
                        {(profile as any).glam_points || 0}
                      </p>
                      <p className="text-xs text-white/50">Reward points</p>
                    </div>
                  </div>
                  <Link href="/rewards">
                    <Button variant="outline" size="sm">
                      View Rewards
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-6 text-center text-sm text-white/40">
          <p>Need help? Contact support at support@mumbaiglamhub.com</p>
        </div>
      </div>
    </div>
  );
}
