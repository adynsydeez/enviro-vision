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
