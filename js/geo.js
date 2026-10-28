const EARTH_RADIUS_M = 6371000;
// GPS between high-rise buildings drifts; forgive up to this much of the reported inaccuracy.
const MAX_ACCURACY_BONUS_M = 40;

export function distanceM(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function isInRange(distance, accuracy, radius) {
  return distance - Math.min(accuracy, MAX_ACCURACY_BONUS_M) <= radius;
}

export function formatDistance(m) {
  return m < 1000 ? `${Math.round(m)} m verderop` : `${(m / 1000).toFixed(1).replace('.', ',')} km verderop`;
}

// Calls onFix({ lat, lng, accuracy }) on every GPS update. Returns a stop function.
export function watchPosition(onFix, onError) {
  if (!('geolocation' in navigator)) {
    onError(new Error('Dit apparaat ondersteunt geen locatie.'));
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    (p) => onFix({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
    onError,
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}
