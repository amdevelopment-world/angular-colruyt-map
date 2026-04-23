import { Component, inject, effect } from '@angular/core';
import { MapService, MapLocation } from '../../services/map.service';

@Component({
  selector: 'app-location-list',
  standalone: true,
  templateUrl: './location-list.html',
  styleUrl: './location-list.css'
})
export class LocationListComponent {
  readonly mapService = inject(MapService);

  constructor() {
    effect(() => {
      const selected = this.mapService.selectedLocation();
      if (selected) {
        const index = this.mapService.locations().findIndex(l => l.name === selected.name);
        if (index >= 0) {
          const el = document.getElementById('location-' + index);
          el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    });
  }

  selectLocation(location: MapLocation) {
    this.mapService.flyTo(location);
  }

  isSelected(location: MapLocation): boolean {
    return this.mapService.selectedLocation()?.name === location.name;
  }
}
