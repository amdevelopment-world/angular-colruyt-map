import { Component, inject } from '@angular/core';
import { MapService, MapLocation } from '../../services/map.service';

@Component({
  selector: 'app-location-list',
  standalone: true,
  templateUrl: './location-list.html',
  styleUrl: './location-list.css'
})
export class LocationListComponent {
  readonly mapService = inject(MapService);

  selectLocation(location: MapLocation) {
    this.mapService.flyTo(location);
  }

  isSelected(location: MapLocation): boolean {
    return this.mapService.selectedLocation()?.name === location.name;
  }
}
