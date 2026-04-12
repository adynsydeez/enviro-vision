// Returns [[south, west], [north, east]] for a square of side 2*radiusKm
export function getBounds(center, radiusKm = 5) {
  const [lat, lng] = center;
  const latDelta = radiusKm / 111.32;
  const lngDelta = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  return [
    [lat - latDelta, lng - lngDelta],
    [lat + latDelta, lng + lngDelta],
  ];
}

// Converts a Leaflet LatLng object to grid cell coordinates.
// bounds = [[swLat, swLng], [neLat, neLng]] (from getBounds)
// Returns { x, y } clamped to [0, gridSize - 1].
export function latlngToCell(latlng, bounds, gridSize) {
  const [[swLat, swLng], [neLat, neLng]] = bounds;
  const x = Math.floor(((latlng.lng - swLng) / (neLng - swLng)) * gridSize);
  const y = Math.floor(((neLat - latlng.lat) / (neLat - swLat)) * gridSize);
  return {
    x: Math.max(0, Math.min(gridSize - 1, x)),
    y: Math.max(0, Math.min(gridSize - 1, y)),
  };
}
