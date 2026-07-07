const NAMESPACE = "framewave:";
const LEGACY_NAMESPACE = ["voice", "blank:"].join("");

function settingKey(namespace: string, key: string): string {
  return `${namespace}${key}`;
}

/**
 * Namespaced localStorage helpers. Future home of user preferences and
 * bring-your-own-key credentials for optional API-backed enhancements.
 */
export function getSetting<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(settingKey(NAMESPACE, key));
    if (raw !== null && raw !== undefined) {
      return JSON.parse(raw) as T;
    }

    const legacyRaw = globalThis.localStorage?.getItem(
      settingKey(LEGACY_NAMESPACE, key)
    );
    if (legacyRaw === null || legacyRaw === undefined) {
      return fallback;
    }

    globalThis.localStorage?.setItem(settingKey(NAMESPACE, key), legacyRaw);
    globalThis.localStorage?.removeItem(settingKey(LEGACY_NAMESPACE, key));
    return JSON.parse(legacyRaw) as T;
  } catch {
    return fallback;
  }
}

export function setSetting<T>(key: string, value: T): void {
  try {
    globalThis.localStorage?.setItem(
      settingKey(NAMESPACE, key),
      JSON.stringify(value)
    );
  } catch {
    // Storage may be unavailable (private mode, quota); settings are optional.
  }
}

export function removeSetting(key: string): void {
  try {
    globalThis.localStorage?.removeItem(settingKey(NAMESPACE, key));
    globalThis.localStorage?.removeItem(settingKey(LEGACY_NAMESPACE, key));
  } catch {
    // Ignore unavailable storage.
  }
}
