export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

declare global {
  interface Window {
    __finaiInstallPrompt?: InstallPromptEvent;
  }
}

export const installAvailabilityEvent = "finai-install-availability";

export function notifyInstallAvailability() {
  window.dispatchEvent(new Event(installAvailabilityEvent));
}

export function getInstallPrompt() {
  return window.__finaiInstallPrompt;
}
