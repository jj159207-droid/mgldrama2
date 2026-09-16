export type InstallPlatform = "ios" | "android" | "desktop";

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    __kinoPwa?: { prompt: InstallPrompt | null; installed: boolean; prompting: boolean };
  }
}

export function installEnvironment(userAgent: string, maxTouchPoints = 0) {
  const ios = /iPad|iPhone|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);
  return {
    platform: (ios ? "ios" : /Android/i.test(userAgent) ? "android" : "desktop") as InstallPlatform,
    embedded: /FBAN|FBAV|Instagram|Line\/|TikTok|BytedanceWebview|; wv\)/i.test(userAgent),
  };
}

export function isStandalone() {
  return Boolean((navigator as Navigator & { standalone?: boolean }).standalone || window.matchMedia?.("(display-mode: standalone)").matches);
}
