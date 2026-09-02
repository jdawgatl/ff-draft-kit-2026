// Cross-environment storage adapter: uses chrome.storage.local when running
// inside the Chrome extension (side panel / popup), and falls back to
// localStorage for the standalone web app. This is what keeps every user's
// draft state completely self-contained per browser/session.

declare const chrome: any;

function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && !!chrome?.storage?.local;
}

export const crossStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (hasChromeStorage()) {
      return new Promise((resolve) => {
        chrome.storage.local.get([name], (result: Record<string, string>) => {
          resolve(result[name] ?? null);
        });
      });
    }
    return localStorage.getItem(name);
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (hasChromeStorage()) {
      return new Promise((resolve) => {
        chrome.storage.local.set({ [name]: value }, () => resolve());
      });
    }
    localStorage.setItem(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    if (hasChromeStorage()) {
      return new Promise((resolve) => {
        chrome.storage.local.remove([name], () => resolve());
      });
    }
    localStorage.removeItem(name);
  },
};

export function isExtensionContext(): boolean {
  return typeof chrome !== 'undefined' && !!chrome?.runtime?.id;
}
