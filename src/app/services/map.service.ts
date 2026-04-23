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
    try {
      const response = await fetch('/api/getColruytLocations');
      if (response.ok) {
        const geoJson = await response.json();
        const loadedLocations = geoJson.features.map((f: any) => ({
          name: f.properties.name || 'Colruyt',
          longitude: f.geometry.coordinates[0],
          latitude: f.geometry.coordinates[1],
          description: [f.properties.street, f.properties.city].filter(Boolean).join(', ') || 'Colruyt Store'
        }));
        this.locations.set(loadedLocations);
        
        // If map is already loaded, add the markers now
        if (this.map) {
          this.addMarkers();
        }
      } else {
        console.error('API Error:', response.statusText);
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
