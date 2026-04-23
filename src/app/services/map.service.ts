import { Injectable, signal, computed } from '@angular/core';
import { Map, Marker, LngLat, LngLatBounds, GeoJSONSource } from 'maplibre-gl';

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
  private sourceReady = false;

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
    try {
      const response = await fetch('https://ecgplacesmw.colruytgroup.com/ecgplacesmw/v3/nl/places/filter/clp-places');
      if (response.ok) {
        const data = await response.json();
        console.log('Colruyt API response:', data);
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

        if (this.map) {
          this.updateSource();
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
    this.setupClustering();
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
    this.sourceReady = false;
    this.map!.setStyle(styleUrl);
    this.map!.once('styledata', () => this.setupClustering());
  }

  private setupClustering() {
    if (!this.map) return;

    // Add clustered GeoJSON source
    this.map.addSource('colruyt-stores', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      cluster: true,
      clusterMaxZoom: 12,
      clusterRadius: 30
    });

    // Cluster circles
    this.map.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'colruyt-stores',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#e8751a',
        'circle-radius': ['step', ['get', 'point_count'], 18, 10, 24, 50, 32],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff'
      }
    });

    // Cluster count labels
    this.map.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: 'colruyt-stores',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-size': 13
      },
      paint: {
        'text-color': '#ffffff'
      }
    });

    // Individual store pins — start with circle fallback
    this.map.addLayer({
      id: 'unclustered-point',
      type: 'circle',
      source: 'colruyt-stores',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': '#e8751a',
        'circle-radius': 8,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff'
      }
    });

    this.sourceReady = true;
    this.updateSource();

    // Load the Colruyt pin image and upgrade the layer
    this.map.loadImage('/colruyt_pin.png').then(({ data }) => {
      if (!this.map!.hasImage('colruyt-pin')) {
        this.map!.addImage('colruyt-pin', data);
      }
      // Replace circle layer with icon layer
      this.map!.removeLayer('unclustered-point');
      this.map!.addLayer({
        id: 'unclustered-point',
        type: 'symbol',
        source: 'colruyt-stores',
        filter: ['!', ['has', 'point_count']],
        layout: {
          'icon-image': 'colruyt-pin',
          'icon-size': 0.7,
          'icon-allow-overlap': true
        }
      });
    }).catch(err => {
      console.warn('Could not load colruyt_pin.png, using circle fallback', err);
    });

    // Click on cluster → zoom in
    this.map.on('click', 'clusters', (e) => {
      const features = this.map!.queryRenderedFeatures(e.point, { layers: ['clusters'] });
      const clusterId = features[0].properties['cluster_id'];
      (this.map!.getSource('colruyt-stores') as GeoJSONSource).getClusterExpansionZoom(clusterId).then(zoom => {
        this.map!.easeTo({
          center: (features[0].geometry as any).coordinates,
          zoom
        });
      });
    });

    // Click on individual store → flyTo
    this.map.on('click', 'unclustered-point', (e) => {
      const coords = (e.features![0].geometry as any).coordinates;
      const location = this.locations().find(l =>
        Math.abs(l.longitude - coords[0]) < 0.0001 && Math.abs(l.latitude - coords[1]) < 0.0001
      );
      if (location) this.flyTo(location);
    });

    // Cursor pointer on hover
    this.map.on('mouseenter', 'clusters', () => this.map!.getCanvas().style.cursor = 'pointer');
    this.map.on('mouseleave', 'clusters', () => this.map!.getCanvas().style.cursor = '');
    this.map.on('mouseenter', 'unclustered-point', () => this.map!.getCanvas().style.cursor = 'pointer');
    this.map.on('mouseleave', 'unclustered-point', () => this.map!.getCanvas().style.cursor = '');
  }

  private updateSource() {
    if (!this.map || !this.sourceReady) return;

    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: this.locations().map(l => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [l.longitude, l.latitude] },
        properties: { name: l.name, description: l.description, type: l.type }
      }))
    };

    (this.map.getSource('colruyt-stores') as GeoJSONSource).setData(geojson);
  }
}
