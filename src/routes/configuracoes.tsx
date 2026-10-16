import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Download, EyeOff, FileUp, Fingerprint, ShieldAlert, Tags, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useData } from "@/hooks/use-data";
import { PageHeader } from "@/components/finai/PageHeader";
import { db, factoryReset, uid } from "@/lib/db";
import { accountBalance, currentMonth, invoiceTotal, todayISO } from "@/lib/finance";
import { money, parseMoney } from "@/lib/format";
import { biometricAvailable, hashPin, registerBiometric } from "@/lib/security";
import { useProfile } from "@/hooks/use-profile";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getInstallPrompt, installAvailabilityEvent } from "@/lib/pwa-install";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — FinAI" },
      { name: "description", content: "Preferências, segurança, ajuste de saldos, backup e reset do aplicativo." },
      { property: "og:title", content: "Configurações — FinAI" },
      { property: "og:description", content: "Ajustes e privacidade do FinAI." },
    ],
  }),
  component: Config,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-4">
      <h2 className="mb-3 font-semibold">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Config() {
  const data = useData();
  const profile = useProfile();
  const [pin, setPin] = useState("");
  const [bioOk, setBioOk] = useState(false);
  const [adjTarget, setAdjTarget] = useState("");
  const [adjValue, setAdjValue] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [installHelpOpen, setInstallHelpOpen] = useState(false);
  const [installAvailable, setInstallAvailable] = useState(false);
  const [appInstalled, setAppInstalled] = useState(false);
  const [confirm, setConfirm] = useState("");
  useEffect(() => { biometricAvailable().then(setBioOk); }, []);
  useEffect(() => {
    const updateInstallState = () => {
      setInstallAvailable(!!getInstallPrompt());
      setAppInstalled(window.matchMedia("(display-mode: standalone)").matches ||
        ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true));
    };
    updateInstallState();
    window.addEventListener(installAvailabilityEvent, updateInstallState);
    return () => window.removeEventListener(installAvailabilityEvent, updateInstallState);
  }, []);
  if (!data?.settings) return null;
  const s = data.settings;
  const upd = (p: Partial<typeof s>) => db.settings.update("app", p);

  const cm = currentMonth();
  const currentOf = (t: string) => {
    const [k, id] = t.split(":");
    if (k === "acc") { const a = data.accounts.find((x) => x.id === id); return a ? accountBalance(a, data.transactions) : 0; }
    return invoiceTotal(id, cm, data.transactions);
  };

  async function adjust() {
    if (!adjTarget) return;
    const [k, id] = adjTarget.split(":");
    const target = parseMoney(adjValue);
    const diff = Math.round((target - currentOf(adjTarget)) * 100) / 100;
    if (!diff) return toast.info("Nenhuma diferença.");
    const today = todayISO();
    const acc = data!.accounts.find((a) => a.id === id);
    const card = data!.cards.find((c) => c.id === id);
    await db.transactions.add({
      id: uid(),
      profile,
      description: "Ajuste manual de saldo",
      amount: Math.abs(diff),
      date: today,
      due_date: k === "card" ? `${cm}-${String(card?.due_day ?? 10).padStart(2, "0")}` : today,
      type: k === "acc" ? (diff > 0 ? "income" : "expense") : diff > 0 ? "expense" : "income",
      account_type: k === "card" ? "credit_card" : (acc?.kind ?? "checking"),
      institution_name: acc?.institution_name ?? card?.institution_name ?? "",
      category_id: "",
      is_installment: false,
      is_recurring: false,
      status: k === "card" ? "pending" : "paid",
      paid_at: k === "card" ? undefined : today,
      account_id: k === "acc" ? id : undefined,
      card_id: k === "card" ? id : undefined,
      invoice_month: k === "card" ? cm : undefined,
      is_adjustment: true,
      created_at: new Date().toISOString(),
    });
    toast.success(`Ajuste de ${money(diff)} lançado.`);
    setAdjValue("");
  }

  async function exportJSON() {
    const dump = {
      accounts: data!.accounts,
      cards: data!.cards,
      loanContracts: data!.loanContracts,
      categories: data!.categories,
      subcategories: data!.subcategories,
      transactions: data!.transactions,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `finai-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function installApp() {
    const installPrompt = getInstallPrompt();
    if (!installPrompt) {
      setInstallHelpOpen(true);
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      window.__finaiInstallPrompt = undefined;
      setInstallAvailable(false);
      toast.success("Instalação iniciada.");
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Configurações" />
      <Section title="Aplicativo">
        <p className="text-xs text-muted-foreground">Instale o FinAI na tela inicial para abrir como um aplicativo e acessar mais rapidamente.</p>
        <Button onClick={installApp} disabled={appInstalled}>
          <Smartphone /> {appInstalled ? "Aplicativo instalado" : "Instalar Aplicativo"}
        </Button>
        {!installAvailable && !appInstalled && <p className="text-xs text-muted-foreground">Se a instalação automática não estiver disponível neste navegador, veja as instruções de instalação.</p>}
      </Section>
      <Section title="Preferências">
        <div className="flex items-center justify-between">
          <Label>Moeda</Label>
          <Select value={s.currency} onValueChange={(v) => upd({ currency: v })}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="BRL">Real (R$)</SelectItem><SelectItem value="USD">Dólar</SelectItem><SelectItem value="EUR">Euro</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between"><Label>Modo escuro</Label><Switch checked={s.theme === "dark"} onCheckedChange={(c) => upd({ theme: c ? "dark" : "light" })} /></div>
        <div className="flex items-center justify-between"><Label>Aviso sonoro de vencimentos</Label><Switch checked={s.sound} onCheckedChange={(c) => upd({ sound: c })} /></div>
        <div className="flex items-center justify-between"><Label className="flex items-center gap-2"><EyeOff className="h-4 w-4" /> Ocultar valores</Label><Switch checked={!!s.hideValues} onCheckedChange={(c) => upd({ hideValues: c })} /></div>
        <div className="flex gap-2">
          <Button variant="secondary" asChild><Link to="/categorias"><Tags /> Categorias</Link></Button>
          <Button variant="secondary" asChild><Link to="/importar"><FileUp /> Importar extratos</Link></Button>
        </div>
      </Section>

      <Section title="Segurança">
        <div className="flex items-center justify-between gap-3">
          <Label>Bloqueio automático por inatividade</Label>
          <Select value={String(s.autoLockMinutes ?? 0)} onValueChange={(v) => upd({ autoLockMinutes: Number(v) })}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="0">Desativado</SelectItem><SelectItem value="1">1 minuto</SelectItem><SelectItem value="5">5 minutos</SelectItem><SelectItem value="15">15 minutos</SelectItem><SelectItem value="30">30 minutos</SelectItem></SelectContent>
          </Select>
        </div>
        {!s.pin_hash && s.autoLockMinutes ? <p className="text-xs text-warning">Configure um PIN para ativar o bloqueio automático.</p> : null}
        <div className="flex gap-2">
          <Input type="password" inputMode="numeric" maxLength={6} placeholder="Novo PIN (6 dígitos)" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
          <Button onClick={async () => {
            if (pin.length !== 6) return toast.error("Use 6 dígitos.");
            const h = await hashPin(pin);
            await upd({ pin_hash: h.hash, pin_salt: h.salt });
            setPin("");
            toast.success("PIN salvo.");
          }}>Salvar PIN</Button>
        </div>
        {s.pin_hash && (
          <Button variant="ghost" size="sm" onClick={() => upd({ pin_hash: undefined, pin_salt: undefined, webauthn_id: undefined })}>Remover PIN e biometria</Button>
        )}
        <div className="flex items-center justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium"><Fingerprint className="h-4 w-4" /> Biometria / Face ID</p>
            <p className="text-xs text-muted-foreground">{bioOk ? "Disponível neste aparelho" : "Indisponível neste aparelho"} · requer PIN</p>
          </div>
          <Switch
            disabled={!bioOk || !s.pin_hash}
            checked={!!s.webauthn_id}
            onCheckedChange={async (c) => {
              if (!c) return upd({ webauthn_id: undefined });
              try { await upd({ webauthn_id: await registerBiometric() }); toast.success("Biometria ativada"); } catch { toast.error("Não foi possível ativar."); }
            }}
          />
        </div>
      </Section>

      <Section title="Ajuste manual de saldos e faturas">
        <p className="text-xs text-muted-foreground">Informe o valor correto; o app lança um ajuste com a diferença.</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <Select value={adjTarget} onValueChange={setAdjTarget}>
            <SelectTrigger><SelectValue placeholder="Conta ou fatura do mês" /></SelectTrigger>
            <SelectContent>
              {data.accounts.map((a) => <SelectItem key={a.id} value={`acc:${a.id}`}>{a.name}</SelectItem>)}
              {data.cards.map((c) => <SelectItem key={c.id} value={`card:${c.id}`}>Fatura {c.name} ({cm.slice(5)})</SelectItem>)}
            </SelectContent>
          </Select>
          <Input className="num" inputMode="decimal" placeholder={adjTarget ? `Atual: ${money(currentOf(adjTarget))}` : "Valor correto"} value={adjValue} onChange={(e) => setAdjValue(e.target.value)} />
          <Button onClick={adjust} disabled={!adjTarget || !adjValue}>Ajustar</Button>
        </div>
      </Section>

      <Section title="Dados e Privacidade">
        <p className="text-xs text-muted-foreground">Seus dados ficam somente neste aparelho. Faça backups regulares.</p>
        <Button variant="secondary" onClick={exportJSON}><Download /> Exportar backup (JSON)</Button>
        <Button variant="destructive" onClick={() => { setConfirm(""); setResetOpen(true); }}><ShieldAlert /> Zerar / Resetar Aplicativo</Button>
      </Section>

      <Dialog open={installHelpOpen} onOpenChange={setInstallHelpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Instale o FinAI no seu celular</DialogTitle>
            <DialogDescription>As opções podem variar um pouco conforme o navegador.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="rounded-lg border p-3">
              <h3 className="mb-1 font-semibold">iPhone ou iPad (Safari)</h3>
              <p className="text-muted-foreground">Toque no ícone de Compartilhar <span aria-label="Compartilhar">□↑</span> e selecione <strong>Adicionar à Tela de Início</strong>. Confirme tocando em Adicionar.</p>
            </div>
            <div className="rounded-lg border p-3">
              <h3 className="mb-1 font-semibold">Android (Chrome)</h3>
              <p className="text-muted-foreground">Abra o menu ⋮ do navegador e toque em <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>.</p>
            </div>
            <div className="rounded-lg border p-3">
              <h3 className="mb-1 font-semibold">Computador</h3>
              <p className="text-muted-foreground">No Chrome ou Edge, use o ícone de instalação na barra de endereço ou a opção <strong>Instalar FinAI</strong> no menu do navegador.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-expense">Apagar todos os dados?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso exclui permanentemente contas, cartões, lançamentos, categorias, conversas e segurança deste aparelho. Não é possível desfazer. Digite <b>ZERAR</b> para confirmar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="ZERAR" />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button variant="destructive" disabled={confirm !== "ZERAR"} onClick={() => factoryReset()}>Apagar tudo</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
