import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, CreditCard, Fingerprint, ShieldCheck, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Logo } from "@/components/finai/AppShell";
import { db, seedCategories, uid, type AccountKind } from "@/lib/db";
import { biometricAvailable, hashPin, registerBiometric, UNLOCK_KEY } from "@/lib/security";
import { parseMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Bem-vindo ao FinAI" },
      { name: "description", content: "Configure moeda, primeira conta e segurança do FinAI em poucos passos." },
      { property: "og:title", content: "Bem-vindo ao FinAI" },
      { property: "og:description", content: "Configure o FinAI em menos de um minuto." },
    ],
  }),
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [currency, setCur] = useState("BRL");
  const [accName, setAccName] = useState("Conta principal");
  const [accBank, setAccBank] = useState("");
  const [accKind, setAccKind] = useState<AccountKind>("checking");
  const [accBalance, setAccBalance] = useState("");
  const [addCard, setAddCard] = useState(false);
  const [card, setCard] = useState({ name: "", bank: "", limit: "", closing: "5", due: "12" });
  const [pin, setPin] = useState("");
  const [bioOk, setBioOk] = useState(false);
  const [bioId, setBioId] = useState<string>();

  useEffect(() => {
    biometricAvailable().then(setBioOk);
  }, []);

  async function finish() {
    if (pin && pin.length !== 6) return toast.error("O PIN deve ter 6 dígitos.");
    await seedCategories();
    await db.accounts.add({
      id: uid(),
      profile: "PF",
      name: accName.trim() || "Conta principal",
      kind: accKind,
      institution_name: accBank.trim(),
      initial_balance: parseMoney(accBalance),
      created_at: new Date().toISOString(),
    });
    if (addCard && card.name) {
      await db.cards.add({
        id: uid(),
        profile: "PF",
        name: card.name,
        institution_name: card.bank,
        limit: parseMoney(card.limit),
        closing_day: Math.min(28, Math.max(1, Number(card.closing) || 1)),
        due_day: Math.min(28, Math.max(1, Number(card.due) || 10)),
        created_at: new Date().toISOString(),
      });
    }
    const pinData = pin ? await hashPin(pin) : undefined;
    await db.settings.put({
      id: "app",
      onboarded: true,
      currency,
      pin_hash: pinData?.hash,
      pin_salt: pinData?.salt,
      webauthn_id: bioId,
      theme: "dark",
      sound: true,
    });
    sessionStorage.setItem(UNLOCK_KEY, "1");
    toast.success("Tudo pronto! Seu FinAI está configurado.");
    navigate({ to: "/" });
  }

  const steps = [
    {
      icon: <Wallet />,
      title: "Moeda e primeira conta",
      body: (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Moeda</Label>
            <Select value={currency} onValueChange={setCur}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BRL">Real (R$)</SelectItem>
                <SelectItem value="USD">Dólar (US$)</SelectItem>
                <SelectItem value="EUR">Euro (€)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nome da conta</Label>
              <Input value={accName} onChange={(e) => setAccName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Banco</Label>
              <Input value={accBank} onChange={(e) => setAccBank(e.target.value)} placeholder="Ex: Nubank" />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={accKind} onValueChange={(v) => setAccKind(v as AccountKind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="checking">Conta corrente</SelectItem>
                  <SelectItem value="benefit_card">Cartão benefício</SelectItem>
                  <SelectItem value="investment">Investimento</SelectItem>
                  <SelectItem value="loan">Empréstimo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Saldo atual</Label>
              <Input className="num" inputMode="decimal" value={accBalance} onChange={(e) => setAccBalance(e.target.value)} placeholder="0,00" />
            </div>
          </div>
        </div>
      ),
    },
    {
      icon: <CreditCard />,
      title: "Cartão de crédito (opcional)",
      body: (
        <div className="space-y-3">
          <Button variant={addCard ? "default" : "secondary"} className="w-full" onClick={() => setAddCard(!addCard)}>
            {addCard ? "Cadastrando cartão" : "Adicionar um cartão agora"}
          </Button>
          {addCard && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Nome</Label><Input value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} placeholder="Ex: Roxinho" /></div>
              <div className="space-y-1.5"><Label>Banco</Label><Input value={card.bank} onChange={(e) => setCard({ ...card, bank: e.target.value })} /></div>
              <div className="col-span-2 space-y-1.5"><Label>Limite</Label><Input className="num" inputMode="decimal" value={card.limit} onChange={(e) => setCard({ ...card, limit: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Dia de fechamento</Label><Input type="number" value={card.closing} onChange={(e) => setCard({ ...card, closing: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Dia de vencimento</Label><Input type="number" value={card.due} onChange={(e) => setCard({ ...card, due: e.target.value })} /></div>
            </div>
          )}
        </div>
      ),
    },
    {
      icon: <ShieldCheck />,
      title: "Proteja seu app",
      body: (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>PIN de 6 dígitos (opcional, recomendado)</Label>
            <InputOTP maxLength={6} value={pin} onChange={setPin} inputMode="numeric">
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} className="h-11 w-10" />)}
              </InputOTPGroup>
            </InputOTP>
          </div>
          <Button
            variant="secondary"
            className="w-full gap-2"
            disabled={!bioOk || pin.length !== 6}
            onClick={async () => {
              try {
                setBioId(await registerBiometric());
                toast.success("Biometria ativada");
              } catch {
                toast.error("Não foi possível ativar a biometria.");
              }
            }}
          >
            <Fingerprint /> {bioId ? "Biometria ativada" : bioOk ? "Ativar biometria / Face ID" : "Biometria indisponível neste aparelho"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="bg-hero flex min-h-screen flex-col items-center bg-background px-5 py-10">
      <Logo />
      {step === -1 ? null : (
        <div className="mt-8 w-full max-w-md">
          <div className="mb-6 flex gap-1.5">
            {steps.map((_, i) => (
              <div key={i} className={cn("h-1.5 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
            ))}
          </div>
          <div className="rounded-3xl border bg-card p-6 shadow-glow">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-primary">{steps[step].icon}</div>
              <h1 className="text-xl font-bold">{steps[step].title}</h1>
            </div>
            {steps[step].body}
            <div className="mt-6 flex gap-2">
              {step > 0 && <Button variant="ghost" onClick={() => setStep(step - 1)}>Voltar</Button>}
              <Button className="ml-auto gap-2" onClick={() => (step < steps.length - 1 ? setStep(step + 1) : finish())}>
                {step < steps.length - 1 ? "Continuar" : "Começar"} <ArrowRight />
              </Button>
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">Seus dados financeiros ficam apenas neste aparelho.</p>
        </div>
      )}
    </div>
  );
}
