import { Injectable, signal, computed } from '@angular/core';
import { Map, Marker, LngLat } from 'maplibre-gl';

export type LocationType = 'store' | 'distribution';

export interface MapLocation {
  name: string;
  longitude: number;
  latitude: number;
  description: string;
  type: LocationType;
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

    // Load from localStorage immediately for instant display
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { locations } = JSON.parse(cached);
      this.locations.set(locations);
      if (this.map) this.addMarkers();
    }

    // Always fetch fresh data in the background (BE + LU + FR)
    const query = '[out:json];area["ISO3166-1"="BE"][admin_level=2]->.be;area["ISO3166-1"="LU"][admin_level=2]->.lu;area["ISO3166-1"="FR"][admin_level=2]->.fr;(nwr["brand"="Colruyt"](area.be);nwr["brand"="Colruyt"](area.lu);nwr["brand"="Colruyt"](area.fr);nwr["name"~"Colruyt",i](area.be);nwr["name"~"Colruyt",i](area.lu);nwr["name"~"Colruyt",i](area.fr););out center;';
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
            const isStore = el.tags?.shop || el.tags?.brand === 'Colruyt';
            return {
              name: el.tags?.name || 'Colruyt',
              longitude: lon,
              latitude: lat,
              description: [el.tags?.['addr:street'], el.tags?.['addr:city']].filter(Boolean).join(', ') || (isStore ? 'Colruyt Store' : 'Colruyt Group'),
              type: isStore ? 'store' : 'distribution' as LocationType
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
      const color = location.type === 'store' ? '#f97316' : '#3b82f6'; // orange for stores, blue for distribution
      const marker = new Marker({ color })
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
