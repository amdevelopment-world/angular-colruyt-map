import { Injectable, signal, computed } from '@angular/core';
import { Map, Marker, LngLat, LngLatBounds } from 'maplibre-gl';

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
  private readonly bounds = signal<LngLatBounds | null>(null);

  readonly visibleLocations = computed(() => {
    const b = this.bounds();
    if (!b) return this.locations();
    return this.locations().filter(l =>
      l.longitude >= b.getWest() && l.longitude <= b.getEast() &&
      l.latitude >= b.getSouth() && l.latitude <= b.getNorth()
    );
  });

  readonly locationCount = computed(() => this.visibleLocations().length);

  constructor() {
    this.loadColruytLocations();
  }

  async loadColruytLocations() {
    const CACHE_KEY = 'colruyt_locations';
    const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

    // Load from localStorage immediately for instant display
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { timestamp, locations } = JSON.parse(cached);
      this.locations.set(locations);
      if (this.map) this.addMarkers();

      // Skip fetch if cache is still fresh
      if (Date.now() - timestamp < CACHE_TTL) return;
    }

    // Fetch from Colruyt Group's official API
    try {
      const response = await fetch('https://ecgplacesmw.colruytgroup.com/ecgplacesmw/v3/nl/places/filter/clp-places');
      if (response.ok) {
        const data = await response.json();
        const loadedLocations = data
          .filter((place: any) => place.geoCoordinates?.latitude && place.geoCoordinates?.longitude)
          .map((place: any) => ({
            name: place.commercialName || 'Colruyt',
            longitude: place.geoCoordinates.longitude,
            latitude: place.geoCoordinates.latitude,
            description: [place.address?.streetName, place.address?.houseNumber, place.address?.postalcode, place.address?.cityName].filter(Boolean).join(' '),
            type: 'store' as LocationType
          }));
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
        console.error('Colruyt API Error:', response.status, response.statusText);
      }
    } catch (e) {
      console.error('Failed to load Colruyt locations', e);
    }
  }

  setMap(instance: Map) {
    this.map = instance;
    this.addMarkers();
    this.updateBounds();
    this.map.on('moveend', () => this.updateBounds());
  }

  private updateBounds() {
    if (this.map) {
      this.bounds.set(this.map.getBounds());
    }
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
