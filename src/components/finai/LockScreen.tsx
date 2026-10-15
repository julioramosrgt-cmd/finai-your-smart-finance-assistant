import { useEffect, useState } from "react";
import { Fingerprint } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import type { Settings } from "@/lib/db";
import { hashPin, verifyBiometric } from "@/lib/security";
import { Logo } from "./AppShell";

export function LockScreen({ settings, onUnlock }: { settings: Settings; onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  async function bio() {
    if (!settings.webauthn_id) return;
    try {
      if (await verifyBiometric(settings.webauthn_id)) onUnlock();
    } catch {
      setError("Biometria não confirmada. Use seu PIN.");
    }
  }

  useEffect(() => {
    if (settings.webauthn_id) void bio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function check(v: string) {
    setPin(v);
    if (v.length < 6) return;
    const { hash } = await hashPin(v, settings.pin_salt);
    if (hash === settings.pin_hash) onUnlock();
    else {
      setError("PIN incorreto");
      setPin("");
    }
  }

  return (
    <div className="bg-hero flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-6">
      <Logo />
      <div className="text-center">
        <h1 className="text-xl font-semibold">Digite seu PIN</h1>
        <p className="mt-1 text-sm text-muted-foreground">Seus dados ficam protegidos neste aparelho.</p>
      </div>
      <InputOTP maxLength={6} value={pin} onChange={check} autoFocus inputMode="numeric">
        <InputOTPGroup>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <InputOTPSlot key={i} index={i} className="h-12 w-11 text-lg" />
          ))}
        </InputOTPGroup>
      </InputOTP>
      {error && <p className="text-sm text-expense">{error}</p>}
      {settings.webauthn_id && (
        <Button variant="secondary" onClick={bio} className="gap-2">
          <Fingerprint /> Usar biometria
        </Button>
      )}
    </div>
  );
}
