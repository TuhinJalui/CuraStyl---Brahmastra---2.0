"use client";

import { useEffect, useCallback } from "react";
import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/useAuth";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  created_at: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isLoaded: boolean;
  setNotifications: (notifications: Notification[], unreadCount: number) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  addNotification: (notification: Notification) => void;
}

const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  isLoaded: false,
  setNotifications: (notifications, unreadCount) =>
    set({ notifications, unreadCount, isLoaded: true }),
  markRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, is_read: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),
  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
      unreadCount: 0,
    })),
  addNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: !notification.is_read ? state.unreadCount + 1 : state.unreadCount,
    })),
}));

export function useNotifications() {
  const store = useNotificationStore();
  const { profile } = useAuth();
  const supabase = (() => {
    try { return createClient(); } catch { return null; }
  })();

  const fetchNotifications = useCallback(async () => {
    if (!profile || !supabase) return;
    try {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (data) {
        const unreadCount = data.filter((n: any) => !n.is_read).length;
        store.setNotifications(data as Notification[], unreadCount);
      }
    } catch {
      // Table might not exist yet
      if (!store.isLoaded) {
        store.setNotifications([], 0);
      }
    }
  }, [profile, supabase, store]);

  // Initial fetch
  useEffect(() => {
    if (profile && !store.isLoaded) {
      fetchNotifications();
    }
  }, [profile, store.isLoaded, fetchNotifications]);

  // 🔥 FREE POLLING (No Realtime subscription needed!)
  // Checks for new notifications every 15 seconds
  useEffect(() => {
    if (!profile) return;

    // Poll every 15 seconds for new notifications
    const pollInterval = setInterval(() => {
      fetchNotifications();
    }, 15000); // 15 seconds

    return () => {
      clearInterval(pollInterval);
    };
  }, [profile, fetchNotifications]);

  const markAsRead = useCallback(async (notificationId: string) => {
    if (!profile || !supabase) return;
    store.markRead(notificationId);
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId)
      .eq("user_id", profile.id);
  }, [profile, supabase, store]);

  const markAllAsRead = useCallback(async () => {
    if (!profile || !supabase) return;
    store.markAllRead();
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", profile.id)
      .eq("is_read", false);
  }, [profile, supabase, store]);

  return {
    notifications: store.notifications,
    unreadCount: store.unreadCount,
    isLoaded: store.isLoaded,
    markAsRead,
    markAllAsRead,
    refresh: fetchNotifications,
  };
}
