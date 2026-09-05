export type MobilePreferences = {
  navSide: "left" | "right";
  compactNav: boolean;
  showTopbarProfile: boolean;
  reduceMotion: boolean;
};

export const DEFAULT_MOBILE_PREFERENCES: MobilePreferences = {
  navSide: "left",
  compactNav: false,
  showTopbarProfile: true,
  reduceMotion: false,
};

const DB_NAME = "rhythians-mobile";
const STORE_NAME = "preferences";
const KEY = "ui";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is unavailable"));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open IndexedDB"));
  });
}

export async function loadMobilePreferences(): Promise<MobilePreferences> {
  try {
    const db = await openDb();
    const value = await new Promise<unknown>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(KEY);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    if (!value || typeof value !== "object") return DEFAULT_MOBILE_PREFERENCES;
    return { ...DEFAULT_MOBILE_PREFERENCES, ...(value as Partial<MobilePreferences>) };
  } catch {
    return DEFAULT_MOBILE_PREFERENCES;
  }
}

export async function saveMobilePreferences(preferences: MobilePreferences): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(preferences, KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    db.close();
  } catch {
    // Preferences are an enhancement; the mobile UI keeps its defaults if storage is unavailable.
  }
}
