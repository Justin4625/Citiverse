// Stamps live only on this device: { [locationId]: ISO timestamp }.
const KEY = 'stamprally.stamps.v1';

export function loadStamps() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? {};
  } catch {
    return {};
  }
}

export function saveStamp(id) {
  const stamps = loadStamps();
  if (!stamps[id]) {
    stamps[id] = new Date().toISOString();
    localStorage.setItem(KEY, JSON.stringify(stamps));
  }
  return stamps;
}

export function clearStamps() {
  localStorage.removeItem(KEY);
  return {};
}

// Ask the browser not to evict our data when storage runs low.
export function requestPersistence() {
  navigator.storage?.persist?.().catch(() => {});
}
