"use client";

import { useState, useEffect, useRef } from "react";
import { MapPin, Search, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface LocationPickerProps {
  onLocationSelect: (location: { address: string; lat: number; lng: number }) => void;
  initialLocation?: { address: string; lat: number; lng: number };
}

export default function LocationPicker({ onLocationSelect, initialLocation }: LocationPickerProps) {
  const [map, setMap] = useState<any>(null);
  const [marker, setMarker] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{ address: string; lat: number; lng: number } | null>(
    initialLocation || null
  );
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInitialized = useRef(false);

  // Load Leaflet dynamically
  useEffect(() => {
    let mounted = true;

    const loadLeaflet = async () => {
      if (typeof window === "undefined" || !mapRef.current || mapInitialized.current) {
        return;
      }

      // Import Leaflet CSS
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      if (!document.querySelector(`link[href="${link.href}"]`)) {
        document.head.appendChild(link);
      }

      const L = await import("leaflet");
      
      if (!mounted || !mapRef.current || mapInitialized.current) return;

      // Fix for default marker icons
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      try {
        const mapInstance = L.map(mapRef.current, {
          center: [initialLocation?.lat || 19.0760, initialLocation?.lng || 72.8777],
          zoom: 13,
          scrollWheelZoom: true,
          zoomControl: true,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(mapInstance);

        // Force map to recalculate size
        setTimeout(() => {
          if (mapInstance && mounted) {
            mapInstance.invalidateSize();
          }
        }, 100);

        // Add click handler to set marker
        mapInstance.on("click", (e: any) => {
          const { lat, lng } = e.latlng;
          setMarkerPosition(mapInstance, lat, lng);
          reverseGeocode(lat, lng);
        });

        // Add initial marker if provided
        if (initialLocation) {
          setMarkerPosition(mapInstance, initialLocation.lat, initialLocation.lng);
        }

        if (mounted) {
          setMap(mapInstance);
          mapInitialized.current = true;
        }
      } catch (error) {
        console.error("Error initializing map:", error);
      }
    };

    loadLeaflet();

    return () => {
      mounted = false;
    };
  }, []);

  const setMarkerPosition = async (mapInstance: any, lat: number, lng: number) => {
    const L = await import("leaflet");
    
    if (marker) {
      marker.setLatLng([lat, lng]);
    } else {
      const newMarker = L.marker([lat, lng], {
        draggable: true,
      }).addTo(mapInstance);
      
      newMarker.on("dragend", function() {
        const position = newMarker.getLatLng();
        reverseGeocode(position.lat, position.lng);
      });
      
      setMarker(newMarker);
    }
    mapInstance.setView([lat, lng], 15);
  };

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
          lng
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
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&addressdetails=1`
      );
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const selectSearchResult = (result: any) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    const address = result.display_name;

    if (map) {
      setMarkerPosition(map, lat, lng);
    }

    const location = { address, lat, lng };
    setSelectedLocation(location);
    onLocationSelect(location);
    setSearchResults([]);
    setSearchQuery("");
  };

  const handleLocateMe = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          if (map) {
            setMarkerPosition(map, latitude, longitude);
            reverseGeocode(latitude, longitude);
          }
        },
        (error) => {
          console.error("Geolocation error:", error);
        }
      );
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
            <MapPin className="w-4 h-4 mr-1" /> Locate Me
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
                if (marker && map) {
                  map.removeLayer(marker);
                  setMarker(null);
                }
              }}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Map Container */}
      <div
        ref={mapRef}
        className="w-full h-80 rounded-xl border border-white/10 overflow-hidden bg-[#1a0a2e]"
      />

      {/* Instructions */}
      <div className="text-xs text-white/40 space-y-1">
        <p>• Click anywhere on the map to set your salon location</p>
        <p>• Drag the marker to adjust the position</p>
        <p>• Use the search bar to find a specific address</p>
        <p>• Click "Locate Me" to use your current location</p>
      </div>
    </div>
  );
}
