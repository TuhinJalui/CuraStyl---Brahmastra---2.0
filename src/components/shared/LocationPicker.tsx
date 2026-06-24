"use client";

import { useState, useEffect, useRef } from "react";
import { MapPin, Search, Loader2, X, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface LocationPickerProps {
  onLocationSelect: (location: { address: string; lat: number; lng: number }) => void;
  initialLocation?: { address: string; lat: number; lng: number };
}

export default function LocationPicker({ onLocationSelect, initialLocation }: LocationPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{ address: string; lat: number; lng: number } | null>(
    initialLocation || null
  );
  
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const mapInitialized = useRef(false);

  // Initialize Leaflet map
  useEffect(() => {
    let mounted = true;

    const initMap = async () => {
      if (typeof window === "undefined" || !mapRef.current || mapInitialized.current) {
        return;
      }

      try {
        // Import Leaflet CSS
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        if (!document.querySelector(`link[href="${link.href}"]`)) {
          document.head.appendChild(link);
        }

        const L = await import("leaflet");

        if (!mounted || !mapRef.current || mapInitialized.current) return;

        // Fix default marker icon
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        });

        // Create map centered on Mumbai by default
        const defaultLat = initialLocation?.lat || 19.0760;
        const defaultLng = initialLocation?.lng || 72.8777;
        const defaultZoom = initialLocation ? 15 : 11;

        const map = L.map(mapRef.current, {
          center: [defaultLat, defaultLng],
          zoom: defaultZoom,
          zoomControl: true,
          scrollWheelZoom: true,
          dragging: true,
          touchZoom: true,
          doubleClickZoom: true,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);

        // Force proper rendering with multiple invalidateSize calls
        setTimeout(() => map.invalidateSize(), 100);
        setTimeout(() => map.invalidateSize(), 300);
        setTimeout(() => map.invalidateSize(), 500);

        // Add marker if initial location exists
        if (initialLocation) {
          const marker = L.marker([initialLocation.lat, initialLocation.lng], {
            draggable: true,
          }).addTo(map);

          // Handle marker drag
          marker.on("dragend", async function () {
            const position = marker.getLatLng();
            await reverseGeocode(position.lat, position.lng);
          });

          markerRef.current = marker;
        }

        // Click on map to place/move marker
        map.on("click", async (e: any) => {
          const { lat, lng } = e.latlng;
          
          if (markerRef.current) {
            // Move existing marker
            markerRef.current.setLatLng([lat, lng]);
          } else {
            // Create new marker
            const marker = L.marker([lat, lng], {
              draggable: true,
            }).addTo(map);

            marker.on("dragend", async function () {
              const position = marker.getLatLng();
              await reverseGeocode(position.lat, position.lng);
            });

            markerRef.current = marker;
          }

          await reverseGeocode(lat, lng);
        });

        mapInstanceRef.current = map;
        mapInitialized.current = true;

      } catch (error) {
        console.error("Error initializing map:", error);
      }
    };

    const timer = setTimeout(() => {
      initMap();
    }, 100);

    return () => {
      mounted = false;
      clearTimeout(timer);
      
      // Cleanup
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
          mapInitialized.current = false;
        } catch (e) {
          console.error("Map cleanup error:", e);
        }
      }
    };
  }, []);

  // Update marker when selectedLocation changes externally
  useEffect(() => {
    if (selectedLocation && mapInstanceRef.current && markerRef.current) {
      const L = require("leaflet");
      markerRef.current.setLatLng([selectedLocation.lat, selectedLocation.lng]);
      mapInstanceRef.current.setView([selectedLocation.lat, selectedLocation.lng], 15);
    }
  }, [selectedLocation]);

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      );
      const data = await response.json();
      
      if (data.display_name) {
        const location = {
          address: data.display_name,
          lat,
          lng,
        };
        setSelectedLocation(location);
        onLocationSelect(location);
      }
    } catch (error) {
      console.error("Reverse geocoding failed:", error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchResults([]);
    
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&addressdetails=1&countrycodes=in`
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        setSearchResults(data);
      }
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const selectSearchResult = async (result: any) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    const address = result.display_name;

    const location = { address, lat, lng };
    setSelectedLocation(location);
    onLocationSelect(location);
    setSearchResults([]);
    setSearchQuery("");

    // Update map and marker
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([lat, lng], 15);
      
      const L = await import("leaflet");
      
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        const marker = L.marker([lat, lng], {
          draggable: true,
        }).addTo(mapInstanceRef.current);

        marker.on("dragend", async function () {
          const position = marker.getLatLng();
          await reverseGeocode(position.lat, position.lng);
        });

        markerRef.current = marker;
      }
    }
  };

  const handleLocateMe = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          await reverseGeocode(latitude, longitude);
          
          // Update map and marker
          if (mapInstanceRef.current) {
            mapInstanceRef.current.setView([latitude, longitude], 15);
            
            const L = await import("leaflet");
            
            if (markerRef.current) {
              markerRef.current.setLatLng([latitude, longitude]);
            } else {
              const marker = L.marker([latitude, longitude], {
                draggable: true,
              }).addTo(mapInstanceRef.current);

              marker.on("dragend", async function () {
                const position = marker.getLatLng();
                await reverseGeocode(position.lat, position.lng);
              });

              markerRef.current = marker;
            }
          }
        },
        (error) => {
          console.error("Geolocation error:", error);
          alert("Unable to get your location. Please search manually.");
        }
      );
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search for your location..."
              className="pl-9"
            />
          </div>
          <Button onClick={handleSearch} disabled={isSearching} size="sm">
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
          </Button>
          <Button onClick={handleLocateMe} variant="outline" size="sm">
            <Navigation className="w-4 h-4 mr-1" /> Locate Me
          </Button>
        </div>

        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
          <div className="absolute z-10 w-full mt-1 glass-card border border-white/10 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
            {searchResults.map((result, index) => (
              <button
                key={index}
                onClick={() => selectSearchResult(result)}
                className="w-full text-left px-4 py-3 hover:bg-white/10 transition-colors border-b border-white/5 last:border-0"
              >
                <p className="text-sm text-white font-medium">{result.display_name.split(",")[0]}</p>
                <p className="text-xs text-white/50 truncate">{result.display_name}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected Location Display */}
      {selectedLocation && (
        <div className="glass-card p-4 border-purple-500/30 bg-purple-500/5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="text-xs text-purple-300 font-medium mb-1">Selected Location</p>
              <p className="text-sm text-white/80">{selectedLocation.address}</p>
              <p className="text-xs text-white/40 mt-1">
                Coordinates: {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedLocation(null);
                if (markerRef.current && mapInstanceRef.current) {
                  mapInstanceRef.current.removeLayer(markerRef.current);
                  markerRef.current = null;
                }
              }}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Map Container - Interactive Leaflet Map */}
      <div
        ref={mapRef}
        className="w-full h-80 rounded-xl border border-white/10 overflow-hidden bg-[#1a0a2e]"
        style={{ minHeight: '320px', zIndex: 0 }}
      />

      {/* Instructions */}
      <div className="text-xs text-white/40 space-y-1">
        <p>• Search for your salon's address using the search bar above</p>
        <p>• Click "Locate Me" to use your current GPS location</p>
        <p>• Click anywhere on the map to place a marker at that location</p>
        <p>• Drag the marker to fine-tune your exact position</p>
        <p>• You can also pan/zoom the map independently</p>
      </div>
    </div>
  );
}
