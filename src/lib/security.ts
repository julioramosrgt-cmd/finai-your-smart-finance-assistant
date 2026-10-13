const enc = new TextEncoder();
const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const b64u = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64u = (s: string) => {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

export async function hashPin(pin: string, salt?: string) {
  const s = salt ?? toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const h = await crypto.subtle.digest("SHA-256", enc.encode(`${s}:${pin}`));
  return { hash: toHex(h), salt: s };
}

export async function biometricAvailable() {
  try {
    return (
      typeof window !== "undefined" &&
      !!window.PublicKeyCredential &&
      (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
    );
  } catch {
    return false;
  }
}

export async function registerBiometric(): Promise<string> {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "FinAI", id: window.location.hostname },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: "finai-local", displayName: "FinAI" },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
      timeout: 60000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Biometria cancelada");
  return b64u(cred.rawId);
}

export async function verifyBiometric(id: string) {
  const res = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ type: "public-key", id: fromB64u(id) }],
      userVerification: "required",
      timeout: 60000,
    },
  });
  return !!res;
}

export const UNLOCK_KEY = "finai-unlocked";
