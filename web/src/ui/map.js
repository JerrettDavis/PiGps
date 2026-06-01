/**
 * map.js — Leaflet map wrapper for PiGps.
 * Uses a CSS divIcon for the position marker to avoid Vite asset resolution
 * issues with Leaflet's default PNG icon.
 */

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export class TrackMap {
  constructor(elementId) {
    this._map = L.map(elementId, { zoomControl: true }).setView([0, 0], 2);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(this._map);

    // Use a CSS divIcon to avoid the Vite/Leaflet default-icon asset bug.
    this._markerIcon = L.divIcon({
      className: 'pigps-position-marker',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    this._marker = null;
    this._polyline = L.polyline([], {
      color: '#4a9eff',
      weight: 3,
      opacity: 0.8,
    }).addTo(this._map);
  }

  /**
   * Set the live position marker.
   * @param {number} lat
   * @param {number} lon
   * @param {boolean} follow  if true, pan the map to this position
   */
  setPosition(lat, lon, follow) {
    const latlng = [lat, lon];
    if (this._marker) {
      this._marker.setLatLng(latlng);
    } else {
      this._marker = L.marker(latlng, { icon: this._markerIcon }).addTo(this._map);
    }
    if (follow) {
      this._map.setView(latlng, Math.max(this._map.getZoom(), 15));
    }
  }

  /**
   * Add a point to the trail polyline.
   * @param {number} lat
   * @param {number} lon
   */
  appendTrail(lat, lon) {
    this._polyline.addLatLng([lat, lon]);
  }

  /** Clear the trail polyline. */
  clearTrail() {
    this._polyline.setLatLngs([]);
    if (this._marker) {
      this._marker.remove();
      this._marker = null;
    }
  }

  /** Trigger Leaflet to recalculate container size (call after layout changes). */
  invalidate() {
    this._map.invalidateSize();
  }
}
