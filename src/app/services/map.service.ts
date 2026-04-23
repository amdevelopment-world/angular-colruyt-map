import { Injectable, signal, computed } from '@angular/core';
import { Map, Marker, LngLat } from 'maplibre-gl';

export interface MapLocation {
  name: string;
  longitude: number;
  latitude: number;
  description: string;
}

@Injectable({
  providedIn: 'root'
})
export class MapService {
  private map: Map | null = null;
  private markers: Marker[] = [];

  readonly selectedLocation = signal<MapLocation | null>(null);
  readonly zoom = signal(7);
  readonly center = signal<[number, number]>([4.4699, 50.5039]); // Centered on Belgium
  readonly locations = signal<MapLocation[]>([]);

  readonly locationCount = computed(() => this.locations().length);

  constructor() {
    this.loadColruytLocations();
  }

  async loadColruytLocations() {
    const CACHE_KEY = 'colruyt_locations';
    const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

    // Try loading from localStorage first
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { timestamp, locations } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_TTL) {
        this.locations.set(locations);
        if (this.map) this.addMarkers();
        return;
      }
    }

    // Cache expired or missing — fetch from Overpass API
    const query = '[out:json];area["ISO3166-1"="BE"][admin_level=2]->.searchArea;(node["brand"="Colruyt"](area.searchArea);way["brand"="Colruyt"](area.searchArea);relation["brand"="Colruyt"](area.searchArea););out center;';
    try {
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      if (response.ok) {
        const data = await response.json();
        const loadedLocations = data.elements
          .map((el: any) => {
            const lat = el.lat || el.center?.lat;
            const lon = el.lon || el.center?.lon;
            if (!lat || !lon) return null;
            return {
              name: el.tags?.name || 'Colruyt',
              longitude: lon,
              latitude: lat,
              description: [el.tags?.['addr:street'], el.tags?.['addr:city']].filter(Boolean).join(', ') || 'Colruyt Store'
            };
          })
          .filter((l: any) => l !== null);
        this.locations.set(loadedLocations);

        // Save to localStorage
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          timestamp: Date.now(),
          locations: loadedLocations
        }));
        
        if (this.map) {
          this.addMarkers();
        }
      } else {
        console.error('Overpass API Error:', response.status, response.statusText);
      }
    } catch (e) {
      console.error('Failed to load Colruyt locations', e);
    }
  }

  setMap(instance: Map) {
    this.map = instance;
    this.addMarkers();
  }

  flyTo(location: MapLocation) {
    this.selectedLocation.set(location);
    this.map!.flyTo({
      center: [location.longitude, location.latitude],
      zoom: 14,
      duration: 2000
    });
  }

  resetView() {
    this.selectedLocation.set(null);
    this.map!.flyTo({
      center: this.center(),
      zoom: this.zoom(),
      duration: 1500
    });
  }

  setStyle(styleUrl: string) {
    this.clearMarkers();
    this.map!.setStyle(styleUrl);
    this.map!.once('styledata', () => this.addMarkers());
  }

  private addMarkers() {
    this.clearMarkers();

    for (const location of this.locations()) {
      const marker = new Marker({ color: '#f97316' }) // Colruyt orange-ish
        .setLngLat([location.longitude, location.latitude])
        .addTo(this.map!);

      marker.getElement().addEventListener('click', () => {
        this.flyTo(location);
      });

      this.markers.push(marker);
    }
  }

  private clearMarkers() {
    for (const marker of this.markers) {
      marker.remove();
    }
    this.markers = [];
  }
}
