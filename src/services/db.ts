// localStorage persistence layer — mirrors the MongoDB schema for local preview

const PREFIX = 'vaultx_';

export function get<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function set<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // storage quota exceeded
  }
}

export function remove(key: string): void {
  localStorage.removeItem(PREFIX + key);
}

export function clear(): void {
  Object.keys(localStorage)
    .filter(k => k.startsWith(PREFIX))
    .forEach(k => localStorage.removeItem(k));
}
