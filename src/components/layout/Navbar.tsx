"use client";

import { useState, useEffect, useLayoutEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Menu,
  X,
  Sparkles,
  User,
  Calendar,
  Heart,
  LogOut,
  ChevronDown,
  Scissors,
  Bell,
  Check,
  Grid2X2,
  Home,
  Zap,
  MessageSquare,
  Gift,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/useAuth";
import { useNotifications } from "@/lib/notifications/useNotifications";

const navLinks = [
  { label: "Salons", href: "/salons" },
  { label: "Offers", href: "/offers" },
  { label: "AI Assistant", href: "/ai-assistant" },
];

const authenticatedNavLinks = [
  { label: "Dashboard", href: "/" },
  { label: "Salons", href: "/salons" },
  { label: "Offers", href: "/offers" },
  { label: "AI Assistant", href: "/ai-assistant" },
];

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isGridMenuOpen, setIsGridMenuOpen] = useState(false);
  const pathname = usePathname();

  const { isLoggedIn, profile, signOut } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : "??";

  const navItems = isLoggedIn
    ? [
        { label: "Dashboard", href: profile?.role === "salon_owner" ? "/salon-owner/dashboard" : "/" },
        { label: "Salons", href: "/salons" },
        { label: "Offers", href: "/offers" },
        { label: "AI Assistant", href: "/ai-assistant" },
      ]
    : navLinks;

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile menu whenever route changes — intentional setState in effect
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useLayoutEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-[#0a0a0f]/85 backdrop-blur-lg border-b border-purple-500/20",
        isScrolled
          ? "shadow-lg shadow-black/30"
          : "shadow-md shadow-black/20"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-18">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30 group-hover:shadow-purple-500/50 transition-all duration-300 group-hover:scale-110">
              <Scissors className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-bold text-lg gradient-text">
                Mumbai
              </span>
              <span className="font-bold text-lg gradient-text -mt-1">
                GlamHub
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                  pathname === link.href
                    ? "text-purple-300 bg-purple-500/10"
                    : "text-white/70 hover:text-white hover:bg-white/5"
                )}
              >
                {link.label === "AI Assistant" ? (
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    {link.label}
                  </span>
                ) : (
                  link.label
                )}
              </Link>
            ))}
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-3">
            {isLoggedIn && (
              <div className="relative">
                <button
                  onClick={() => { setIsNotifOpen(!isNotifOpen); setIsUserMenuOpen(false); }}
                  className="relative p-2 rounded-lg hover:bg-white/10 transition-colors"
                  aria-label="Notifications"
                >
                  <Bell className="w-4.5 h-4.5 text-white/60" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-pink-500 text-[10px] font-bold text-white flex items-center justify-center shadow-lg shadow-pink-500/40">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>

                {isNotifOpen && (
                  <div className="absolute right-0 top-full mt-2 w-80 glass-dark rounded-2xl border border-purple-500/20 shadow-xl shadow-black/40 overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                      <p className="text-sm font-semibold text-white">Notifications</p>
                      {unreadCount > 0 && (
                        <button
                          onClick={() => markAllAsRead()}
                          className="text-[11px] text-purple-300 hover:text-purple-200 flex items-center gap-1 transition-colors"
                        >
                          <Check className="w-3 h-3" /> Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="text-center py-8 text-white/30 text-sm">
                          <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          No notifications yet
                        </div>
                      ) : (
                        notifications.slice(0, 8).map((notif) => (
                          <button
                            key={notif.id}
                            onClick={() => { markAsRead(notif.id); setIsNotifOpen(false); }}
                            className={cn(
                              "w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors",
                              !notif.is_read && "bg-purple-500/5"
                            )}
                          >
                            <div className="flex items-start gap-2">
                              {!notif.is_read && (
                                <div className="w-2 h-2 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-white font-medium truncate">{notif.title}</p>
                                <p className="text-xs text-white/40 line-clamp-2 mt-0.5">{notif.message}</p>
                                <p className="text-[10px] text-white/20 mt-1">
                                  {new Date(notif.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            {isLoggedIn ? (
              <div className="relative">
                <button
                  onClick={() => { setIsUserMenuOpen(!isUserMenuOpen); setIsNotifOpen(false); setIsGridMenuOpen(false); }}
                  className="relative group"
                >
                  {/* Profile Photo with online indicator */}
                  <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-purple-500/30 group-hover:ring-purple-500/60 transition-all duration-300 group-hover:scale-105">
                    {profile?.avatar_url ? (
                      <Image 
                        src={profile.avatar_url} 
                        alt={profile.full_name || 'Profile'}
                        width={40}
                        height={40}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold">
                        {initials}
                      </div>
                    )}
                  </div>
                  
                  {/* Online Indicator */}
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#0a0a0f]" />
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 glass-dark rounded-2xl border border-purple-500/20 shadow-xl shadow-black/40 overflow-hidden">
                    {/* Profile Header */}
                    <div className="px-4 py-3 border-b border-white/10">
                      <p className="text-sm font-semibold text-white truncate">{profile?.full_name}</p>
                      <p className="text-xs text-white/40 truncate">{profile?.email}</p>
                    </div>
                    
                    {/* Menu Items */}
                    <div className="p-2 space-y-1">
                      <Link
                        href="/profile"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-white/80 hover:bg-white/5 hover:text-white transition-all"
                      >
                        <User className="w-4 h-4" /> Edit Profile
                      </Link>
                      <button 
                        onClick={() => { 
                          setIsUserMenuOpen(false);
                          if (window.location.pathname === '/') {
                            document.getElementById('bookings')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          } else {
                            window.location.href = '/#bookings';
                          }
                        }} 
                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-white/80 hover:bg-white/5 hover:text-white transition-all"
                      >
                        <Calendar className="w-4 h-4" /> My Bookings
                      </button>
                      <button 
                        onClick={() => { 
                          setIsUserMenuOpen(false);
                          if (window.location.pathname === '/') {
                            document.getElementById('favorites')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          } else {
                            window.location.href = '/#favorites';
                          }
                        }} 
                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-white/80 hover:bg-white/5 hover:text-white transition-all"
                      >
                        <Heart className="w-4 h-4" /> My Favorites
                      </button>
                      <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/60 cursor-default">
                        <Gift className="w-4 h-4" /> GlamPoints: {(profile as any)?.glam_points ?? 0}
                      </div>
                      
                      <hr className="border-white/10 my-1" />
                      
                      <button 
                        onClick={signOut} 
                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-all"
                      >
                        <LogOut className="w-4 h-4" /> Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link href="/auth/login">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link href="/auth/register">
                  <Button size="sm" className="shadow-lg shadow-purple-500/20">
                    Get Started
                  </Button>
                </Link>
              </>
            )}

            
          </div>


          {/* Mobile Menu Button - 3-dot icon */}
          <button
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Toggle menu"
          >
            {isMobileOpen ? (
              <X className="w-5 h-5 text-white" />
            ) : (
              <div className="flex flex-col gap-1">
                <div className="w-1 h-1 rounded-full bg-white"></div>
                <div className="w-1 h-1 rounded-full bg-white"></div>
                <div className="w-1 h-1 rounded-full bg-white"></div>
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileOpen && (
        <div className="md:hidden mobile-menu-enter border-t border-purple-500/20 bg-[#0a0a0f]/95 backdrop-blur-xl">
          <div className="px-4 py-4 space-y-1">
            {navItems.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "block px-4 py-3 rounded-xl text-sm font-medium transition-all",
                  pathname === link.href
                    ? "text-purple-300 bg-purple-500/10"
                    : "text-white/70 hover:text-white hover:bg-white/5"
                )}
              >
                {link.label}
              </Link>
            ))}
            <hr className="border-white/10 my-2" />
            {isLoggedIn ? (
              <>
                <div className="px-4 py-2">
                  <p className="text-sm font-semibold text-white">{profile?.full_name}</p>
                  <p className="text-xs text-white/40">{profile?.email}</p>
                </div>
                <Link href="/" className="block">
                  <Button variant="ghost" className="w-full justify-start gap-2" size="sm">
                    <User className="w-4 h-4" /> My Account
                  </Button>
                </Link>
                <Button onClick={signOut} variant="ghost" className="w-full justify-start gap-2 text-red-400 hover:bg-red-500/10" size="sm">
                  <LogOut className="w-4 h-4" /> Sign Out
                </Button>
              </>
            ) : (
              <>
                <Link href="/auth/login" className="block">
                  <Button variant="ghost" className="w-full justify-start" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link href="/auth/register" className="block">
                  <Button className="w-full" size="sm">
                    Get Started
                  </Button>
                </Link>
                <Link href="/salon-owner/register" className="block">
                  <Button variant="outline" className="w-full" size="sm">
                    List Your Salon
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
