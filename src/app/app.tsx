import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { Session } from "@supabase/supabase-js";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AlertTriangle, BadgeDollarSign, Beef, ChartNoAxesCombined, CircleCheck, ClipboardPenLine, CloudCheck, CloudUpload, House, LoaderCircle, Menu, Milk, Sprout, TrendingDown, TrendingUp } from "lucide-react";
import { Button, Card, FieldLabel, Notice, TextInput } from "@/components/ui";
import { clearFarmSession, provisionFarm, readFarmSession, repairFarmSessionIds, saveFarmSession } from "@/db/bootstrap";
import { db } from "@/db/rejo-db";
import { repairLegacyUuidRecords } from "@/db/repair-legacy-uuids";
import { nowInFarmTimezone } from "@/domain/time";
import type { FarmSession } from "@/domain/models";
import { AnimalsBrowserPage } from "@/features/animals/animals-browser-page";
import { ReproductionWorklistPage } from "@/features/animals/reproduction-worklist-page";
import { HealthWorklistPage } from "@/features/health/health-worklist-page";
import { MilkCapturePage } from "@/features/milk/milk-capture-page";
import { getMilkDashboard } from "@/features/milk/dashboard";
import { getDecisionDashboard, type MilkTrendPoint } from "@/features/insights/decision-dashboard";
import { SettingsPage } from "@/features/settings/settings-page";
import { FinancePage } from "@/features/economics/finance-page";
import { PaddocksPage } from "@/features/paddocks/paddocks-page";
import { MilkControlPage } from "@/features/milk-control/milk-control-page";
import { HerdHubPage, MorePage } from "@/features/navigation/operational-hubs";
import { pullFarmChanges, syncPendingOperations, type SyncStatus } from "@/sync/sync-service";
import { isSupabaseConfigured, supabase } from "@/sync/supabase";
import { resolveRemoteFarmSession, type RemoteFarmSessionResult } from "@/sync/farm-session";

type Page = "home" | "capture" | "herd" | "animals" | "reproduction" | "health" | "finance" | "paddocks" | "milk-control" | "more" | "settings";
const farmProvisionSchema = z.object({
  farmName: z.string().trim().min(1, "Escribe el nombre de la finca para empezar."),
  ownerName: z.string()
});
type FarmProvisionForm = z.infer<typeof farmProvisionSchema>;

interface ProvisioningPageProps {
  onProvisioned: (session: FarmSession) => void;
  userId?: string;
}

const ProvisioningPage = ({ onProvisioned, userId }: ProvisioningPageProps) => {
  const [error, setError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<FarmProvisionForm>({
    resolver: zodResolver(farmProvisionSchema),
    defaultValues: { farmName: "", ownerName: "" }
  });

  const submit = handleSubmit(async ({ farmName, ownerName }) => {
    setIsSaving(true);
    setError(undefined);

    try {
      const session = await provisionFarm(db, { farmName, ownerName, userId });
      onProvisioned(session);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo preparar la finca.");
    } finally {
      setIsSaving(false);
    }
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center p-5">
      <Card>
        <p className="text-lg font-bold text-lime-800">REJO</p>
        <h1 className="mt-2 text-4xl font-black text-stone-950">Preparemos la finca</h1>
        <p className="mt-3 text-lg text-stone-700">
          Este paso se hace una sola vez. Después podrás anotar aun cuando no haya señal.
        </p>

        {error ? <div className="mt-5"><Notice tone="error">{error}</Notice></div> : null}

        <div className="mt-6">
          <FieldLabel>¿Cómo se llama la finca?</FieldLabel>
          <TextInput
            autoFocus
            placeholder="Ejemplo: Finca El Capulí"
            {...register("farmName")}
          />
          {errors.farmName ? <p className="mt-2 text-lg text-red-800">{errors.farmName.message}</p> : null}
        </div>

        <div className="mt-5">
          <FieldLabel>¿Quién la maneja? (opcional)</FieldLabel>
          <TextInput
            placeholder="Ejemplo: Don Luis"
            {...register("ownerName")}
          />
        </div>

        <Button
          type="button"
          className="mt-7 w-full bg-lime-700 text-white hover:bg-lime-800"
          disabled={isSaving}
          onClick={() => void submit()}
        >
          <House size={20} aria-hidden="true" />
          {isSaving ? "Preparando…" : "Empezar"}
        </Button>
      </Card>
    </main>
  );
};

interface HomePageProps {
  session: FarmSession;
  onCapture: () => void;
  onHerd: () => void;
  onFinance: () => void;
  onPaddocks: () => void;
  onMilkControl: () => void;
}

const MilkTrendChart = ({ points }: { points: MilkTrendPoint[] }) => {
  if (points.length < 2) {
    return <p className="text-base text-stone-600">Sigue anotando la medida diaria para ver la tendencia.</p>;
  }
  const values = points.map((point) => point.liters);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = maximum - minimum || 1;
  const coordinates = points.map((point, index) => {
    const x = 12 + (index / (points.length - 1)) * 296;
    const y = 100 - ((point.liters - minimum) / range) * 76;
    return `${x},${y}`;
  }).join(" ");
  return <svg className="h-24 w-full overflow-visible" viewBox="0 0 320 112" role="img" aria-label={`Tendencia de ${points.length} medidas del tanque, entre ${minimum.toFixed(1)} y ${maximum.toFixed(1)} litros`}><line x1="12" x2="308" y1="100" y2="100" stroke="currentColor" strokeOpacity="0.15" /><polyline points={coordinates} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" /><circle cx={coordinates.split(" ").at(-1)?.split(",")[0]} cy={coordinates.split(" ").at(-1)?.split(",")[1]} fill="currentColor" r="5" /></svg>;
};

const HomePage = ({ session, onCapture, onHerd, onFinance, onPaddocks, onMilkControl }: HomePageProps) => {
  const { date } = nowInFarmTimezone();
  const [trendPeriod, setTrendPeriod] = useState<7 | 30>(7);
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const [isTrendVisible, setIsTrendVisible] = useState(false);
  const dashboard = useLiveQuery(() => getMilkDashboard(db, session.farmId, date), [session.farmId, date]);
  const decisions = useLiveQuery(() => getDecisionDashboard(db, session.farmId, date), [session.farmId, date]);
  const trend = decisions?.trend.slice(-trendPeriod) ?? [];
  const directionLabel = decisions?.trendDirection === "down" ? "Bajando frente a los días anteriores" : decisions?.trendDirection === "up" ? "Subiendo frente a los días anteriores" : decisions?.trendDirection === "steady" ? "Se mantiene estable" : "Aún no hay tendencia suficiente";
  const visibleAlerts = showAllAlerts ? decisions?.alerts ?? [] : decisions?.alerts.slice(0, 2) ?? [];
  const shortcuts = [
    { label: "Rejo", ariaLabel: "Abrir el rejo", icon: Beef, onClick: onHerd, iconTone: "bg-lime-100 text-lime-900" },
    { label: "Potreros", ariaLabel: "Abrir potreros", icon: Sprout, onClick: onPaddocks, iconTone: "bg-sky-100 text-sky-900" },
    { label: "Finanzas", ariaLabel: "Abrir finanzas", icon: BadgeDollarSign, onClick: onFinance, iconTone: "bg-amber-100 text-amber-900" },
    { label: "Control lechero", ariaLabel: "Abrir control lechero", icon: ClipboardPenLine, onClick: onMilkControl, iconTone: "bg-stone-100 text-stone-800" }
  ];
  const hasAlerts = (decisions?.alerts.length ?? 0) > 0;
  const hasTrend = trend.length >= 2;

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3 px-1">
        <div>
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-lime-800">Hoy</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-stone-950 sm:text-3xl">La finca, al día.</h1>
        </div>
        <span className="rounded-full bg-lime-100 px-3 py-1.5 text-sm font-bold text-lime-950">{dashboard?.todayLiters === undefined ? "Medida pendiente" : "Medida lista"}</span>
      </header>

      <section className="rounded-3xl bg-lime-800 p-5 text-white shadow-[0_14px_30px_rgba(77,124,15,0.22)]">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-lime-700 text-white"><Milk size={24} aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-lime-100">Medida del tanque</p>
            <p className="mt-0.5 text-4xl font-black tracking-tight sm:text-5xl">{dashboard?.todayLiters === undefined ? "—" : dashboard.todayLiters.toFixed(1)}<span className="ml-1 text-xl text-lime-100">L</span></p>
          </div>
          <Button type="button" className="min-h-11 shrink-0 bg-white px-3 text-sm text-lime-950 hover:bg-lime-50" onClick={onCapture}>
            {dashboard?.todayLiters === undefined ? "Anotar" : "Revisar"}
          </Button>
        </div>
        <div className="mt-4 flex items-center justify-between gap-4 border-t border-lime-700 pt-3 text-sm">
          <span className="font-semibold text-lime-100">Promedio 7 días</span>
          <span className="font-black">{dashboard?.sevenDayAverage === undefined ? "Sin promedio" : `${dashboard.sevenDayAverage.toFixed(1)} L`}</span>
        </div>
      </section>

      <section className="space-y-3">
        {decisions === undefined ? <Notice tone="info">Revisando los registros guardados en el celular…</Notice> : !hasAlerts ? <div className="flex min-h-14 items-center gap-3 rounded-2xl bg-lime-50 px-4 text-lime-950 ring-1 ring-lime-200"><CircleCheck className="shrink-0" size={22} aria-hidden="true" /><span className="font-bold">Todo en orden · sin alertas para hoy.</span></div> : <>
        <div className="flex items-end justify-between gap-3 px-1">
          <div><p className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-stone-500"><AlertTriangle size={16} aria-hidden="true" />Atención</p><h2 className="mt-1 text-xl font-black text-stone-950">Revisa esto</h2></div>
          {decisions && decisions.alerts.length > 2 ? <button type="button" className="min-h-11 rounded-xl px-3 text-sm font-bold text-lime-800 underline" aria-expanded={showAllAlerts} onClick={() => setShowAllAlerts((current) => !current)}>{showAllAlerts ? "Ver menos" : `Ver todas (${decisions.alerts.length})`}</button> : null}
        </div>
        <div className="mt-3 space-y-3">
          {visibleAlerts.map((alert) => <Notice key={alert.id} tone={alert.tone === "critical" ? "error" : alert.tone === "attention" ? "warning" : "info"}><strong>{alert.title}</strong><br />{alert.detail}</Notice>)}
        </div>
        </>}
      </section>

      <section>
        <div className="px-1"><p className="text-sm font-bold uppercase tracking-wide text-stone-500">Accesos rápidos</p></div>
        <div className="mt-2 grid grid-cols-2 gap-2.5">
          {shortcuts.map((shortcut) => {
            const Icon = shortcut.icon;
            return <button key={shortcut.label} type="button" aria-label={shortcut.ariaLabel} className="flex min-h-20 items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3 text-left shadow-[0_6px_18px_rgba(28,25,23,0.04)] transition active:scale-[0.98]" onClick={shortcut.onClick}><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${shortcut.iconTone}`}><Icon size={21} aria-hidden="true" /></span><span className="text-base font-black leading-tight text-stone-950">{shortcut.label}</span></button>;
          })}
        </div>
      </section>

      {hasTrend ? <Card><div className="flex items-center justify-between gap-4"><div><p className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-stone-500"><ChartNoAxesCombined size={16} aria-hidden="true" />Producción</p><div className="mt-1 flex items-center gap-2 text-base font-bold text-stone-800">{decisions?.trendDirection === "down" ? <TrendingDown size={19} className="text-amber-700" aria-hidden="true" /> : <TrendingUp size={19} className="text-lime-700" aria-hidden="true" />}{directionLabel}</div></div><button type="button" aria-expanded={isTrendVisible} className="min-h-10 shrink-0 rounded-xl bg-stone-100 px-3 text-sm font-bold text-stone-800" onClick={() => setIsTrendVisible((current) => !current)}>{isTrendVisible ? "Ocultar" : "Ver"}</button></div>{isTrendVisible ? <div className="mt-4"><div className="flex justify-end"><div className="grid grid-cols-2 rounded-xl bg-stone-100 p-1"><button type="button" aria-pressed={trendPeriod === 7} className={`min-h-10 rounded-lg px-3 text-sm font-bold ${trendPeriod === 7 ? "bg-white text-lime-950 shadow-sm" : "text-stone-600"}`} onClick={() => setTrendPeriod(7)}>7 días</button><button type="button" aria-pressed={trendPeriod === 30} className={`min-h-10 rounded-lg px-3 text-sm font-bold ${trendPeriod === 30 ? "bg-white text-lime-950 shadow-sm" : "text-stone-600"}`} onClick={() => setTrendPeriod(30)}>30 días</button></div></div><div className="mt-3 text-lime-800"><MilkTrendChart points={trend} /></div></div> : null}</Card> : null}
    </div>
  );
};

interface NavigationProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const Navigation = ({ currentPage, onNavigate }: NavigationProps) => {
  const links = [
    { page: "home" as const, label: "Inicio", icon: House },
    { page: "herd" as const, label: "Rejo", icon: Beef },
    { page: "finance" as const, label: "Finanzas", icon: BadgeDollarSign },
    { page: "more" as const, label: "Más", icon: Menu }
  ];

  return (
    <nav className="sticky bottom-0 grid grid-cols-4 gap-1 border-t border-stone-200/80 bg-white/95 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur">
      {links.map((link) => (
        <button
          className={
            "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-sm font-bold " +
            (currentPage === link.page ? "bg-lime-100 text-lime-950" : "text-stone-500")
          }
          key={link.page}
          onClick={() => onNavigate(link.page)}
          type="button"
        >
          <link.icon size={20} strokeWidth={2.25} aria-hidden="true" />
          {link.label}
        </button>
      ))}
    </nav>
  );
};

const AppShell = ({ session, onSignOut }: { session: FarmSession; onSignOut?: () => Promise<void> }) => {
  const [page, setPage] = useState<Page>("home");
  const [returnPage, setReturnPage] = useState<Page>("home");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>();
  const [isSyncing, setIsSyncing] = useState(false);
  const syncInFlight = useRef(false);
  const pendingCount = useLiveQuery(
    () => db.syncQueue.filter((item) => item.farmId === session.farmId && !item.completedAt).count(),
    [session.farmId],
    0
  );

  const sync = useCallback(async () => {
    if (syncInFlight.current) {
      return;
    }

    syncInFlight.current = true;
    setIsSyncing(true);
    let processed = 0;

    try {
      const status = await syncPendingOperations(db, session.farmId);
      processed = status.processed;
      setSyncStatus(status);
      if (status.state === "synced") {
        await pullFarmChanges(db, session.farmId);
      }
    } catch (caught) {
      setSyncStatus({
        state: "failed",
        processed,
        error: caught instanceof Error ? caught.message : "No se pudo completar el respaldo."
      });
    } finally {
      syncInFlight.current = false;
      setIsSyncing(false);
    }
  }, [session.farmId]);

  useEffect(() => {
    void sync();
    const onOnline = () => void sync();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [sync]);

  const openPaddocks = (from: Page) => {
    setReturnPage(from);
    setPage("paddocks");
  };

  const openMilkControl = (from: Page) => {
    setReturnPage(from);
    setPage("milk-control");
  };
  const isOffline = syncStatus?.state === "offline" || !navigator.onLine;
  const canBackUp = isSupabaseConfigured && pendingCount > 0;
  const pendingLabel = `${pendingCount} ${pendingCount === 1 ? "cambio" : "cambios"}`;
  const backupFailed = syncStatus?.state === "failed";
  const completedBackupCount = syncStatus?.state === "synced" ? syncStatus.processed : 0;
  const backupSucceeded = !isSyncing && pendingCount === 0 && completedBackupCount > 0;

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col bg-transparent">
      <header className="flex min-h-16 items-center justify-between gap-3 bg-lime-950 px-4 py-3 text-white sm:px-6">
        <p className="text-xl font-black tracking-wide">REJO</p>
        {canBackUp ? (
          <button
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-white px-3 text-sm font-bold text-lime-950 disabled:opacity-60"
            type="button"
            disabled={isOffline || isSyncing}
            aria-label={isSyncing ? `Respaldando ${pendingLabel}` : isOffline ? "No se puede respaldar sin señal" : backupFailed ? `Reintentar respaldo de ${pendingLabel}` : `Respaldar ${pendingLabel} en la nube`}
            title={isSyncing ? "No cierres la app mientras termina el respaldo" : "Envía los cambios guardados en este teléfono a la nube"}
            onClick={() => void sync()}
          >
            {isSyncing ? <LoaderCircle className="animate-spin" size={18} aria-hidden="true" /> : <CloudUpload size={18} aria-hidden="true" />}
            {isSyncing ? `Respaldando ${pendingCount}` : isOffline ? "Sin señal" : backupFailed ? `Reintentar ${pendingCount}` : `Respaldar ${pendingCount}`}
          </button>
        ) : backupSucceeded ? <span className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-lime-900 px-3 text-sm font-bold text-lime-100" aria-label="Respaldo al día"><CloudCheck size={18} aria-hidden="true" />Al día</span> : null}
      </header>

      {isSyncing ? <div className="px-4 pt-3 sm:px-6" role="status" aria-live="polite"><Notice tone="info">Respaldando {pendingLabel}. No cierres la app hasta que termine.</Notice></div> : null}
      {backupFailed ? <div className="px-4 pt-3 sm:px-6" role="alert"><Notice tone="error"><p>No se pudo respaldar. {pendingCount === 1 ? "Tu" : "Tus"} {pendingLabel} {pendingCount === 1 ? "sigue" : "siguen"} guardado{pendingCount === 1 ? "" : "s"} en este celular. Revisa la conexión e inténtalo de nuevo.</p><details className="mt-2"><summary className="cursor-pointer font-bold">Ver detalle</summary><p className="mt-1 text-sm">{syncStatus?.state === "failed" ? syncStatus.error : ""}</p></details></Notice></div> : null}
      {backupSucceeded ? <div className="px-4 pt-3 sm:px-6" role="status" aria-live="polite"><Notice tone="success">{completedBackupCount} {completedBackupCount === 1 ? "cambio quedó respaldado" : "cambios quedaron respaldados"} en la nube.</Notice></div> : null}

      <main className="flex-1 p-4 pb-6 pt-6 sm:p-6">
        {page === "home" ? <HomePage session={session} onCapture={() => setPage("capture")} onHerd={() => setPage("herd")} onFinance={() => setPage("finance")} onPaddocks={() => openPaddocks("home")} onMilkControl={() => openMilkControl("home")} /> : null}
        {page === "capture" ? <MilkCapturePage session={session} onSaved={() => setPage("home")} /> : null}
        {page === "herd" ? <HerdHubPage onAnimals={() => setPage("animals")} onReproduction={() => setPage("reproduction")} onHealth={() => setPage("health")} onMilkControl={() => openMilkControl("herd")} /> : null}
        {page === "animals" ? <AnimalsBrowserPage session={session} onMilkControl={() => openMilkControl("animals")} /> : null}
        {page === "reproduction" ? <ReproductionWorklistPage session={session} onBack={() => setPage("herd")} /> : null}
        {page === "health" ? <HealthWorklistPage session={session} onBack={() => setPage("herd")} /> : null}
        {page === "finance" ? <FinancePage session={session} /> : null}
        {page === "paddocks" ? <PaddocksPage session={session} onBack={() => setPage(returnPage)} /> : null}
        {page === "milk-control" ? <MilkControlPage session={session} onBack={() => setPage(returnPage)} /> : null}
        {page === "more" ? <MorePage onPaddocks={() => openPaddocks("more")} onSettings={() => setPage("settings")} /> : null}
        {page === "settings" ? <SettingsPage session={session} onSignOut={onSignOut} /> : null}
      </main>

      <Navigation currentPage={page} onNavigate={setPage} />
    </div>
  );
};

const LocalApp = () => {
  const [session, setSession] = useState<FarmSession | null>(() => readFarmSession());

  if (!session) {
    return <ProvisioningPage onProvisioned={setSession} />;
  }

  return <AppShell session={session} />;
};

const SupabaseSignInPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    if (!supabase || !email.trim() || !password) {
      setError("Escribe tu correo y contrase\u00f1a.");
      return;
    }

    if (password.length < 8) {
      setError("La contrase\u00f1a debe tener al menos 8 caracteres.");
      return;
    }

    setIsSubmitting(true);
    setError(undefined);
    setMessage(undefined);

    if (mode === "sign-up") {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password
      });

      setIsSubmitting(false);

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (!data.session) {
        setMessage("Cuenta creada. Activa la confirmaci\u00f3n autom\u00e1tica de correo en Supabase para entrar sin recibir un enlace.");
      }
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    setIsSubmitting(false);

    if (signInError) {
      setError(signInError.message);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center p-5">
      <Card>
        <p className="text-lg font-bold text-lime-800">REJO</p>
        <h1 className="mt-2 text-4xl font-black text-stone-950">
          {mode === "sign-in" ? "Entrar a la finca" : "Crear acceso a la finca"}
        </h1>
        <p className="mt-3 text-lg text-stone-700">
          Solo necesitas conexi\u00f3n para crear o abrir tu acceso por primera vez en este tel\u00e9fono.
        </p>

        {message ? <div className="mt-5"><Notice tone="success">{message}</Notice></div> : null}
        {error ? <div className="mt-5"><Notice tone="error">{error}</Notice></div> : null}

        <div className="mt-6">
          <FieldLabel>Correo</FieldLabel>
          <TextInput
            autoComplete="email"
            inputMode="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="nombre@correo.com"
          />
        </div>

        <div className="mt-5">
          <FieldLabel>Contrase\u00f1a</FieldLabel>
          <TextInput
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            minLength={8}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="M\u00ednimo 8 caracteres"
          />
        </div>

        <Button
          type="button"
          className="mt-7 w-full bg-lime-700 text-white hover:bg-lime-800"
          disabled={isSubmitting}
          onClick={() => void submit()}
        >
          <ClipboardPenLine size={20} aria-hidden="true" />
          {isSubmitting ? "Guardando…" : mode === "sign-in" ? "Entrar" : "Crear cuenta"}
        </Button>

        <button
          className="mt-5 w-full text-lg font-bold text-lime-800 underline"
          type="button"
          onClick={() => {
            setMode((current) => current === "sign-in" ? "sign-up" : "sign-in");
            setError(undefined);
            setMessage(undefined);
          }}
        >
          {mode === "sign-in" ? "Crear mi acceso" : "Ya tengo acceso"}
        </button>
      </Card>
    </main>
  );
};

const ConfiguredApp = () => {
  const [authSession, setAuthSession] = useState<Session | null | undefined>(undefined);
  const [farmSession, setFarmSession] = useState<FarmSession | null>(() => readFarmSession());
  const [farmLookup, setFarmLookup] = useState<RemoteFarmSessionResult | { state: "loading" }>();
  const [farmLookupAttempt, setFarmLookupAttempt] = useState(0);
  const authUserId = authSession?.user.id;
  const signOut = useCallback(async () => {
    if (!supabase) {
      return;
    }

    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }

    clearFarmSession();
    setFarmSession(null);
    setFarmLookup(undefined);
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    void supabase.auth.getSession().then(({ data }) => setAuthSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setAuthSession(nextSession);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const configuredSupabase = supabase;
    if (!authUserId || !configuredSupabase) {
      return;
    }

    const storedSession = readFarmSession();
    if (storedSession?.userId === authUserId) {
      setFarmSession(storedSession);
      setFarmLookup({ state: "found", session: storedSession });
      return;
    }

    let cancelled = false;
    setFarmSession(null);
    setFarmLookup({ state: "loading" });

    void resolveRemoteFarmSession(authUserId, async (userId) => {
      const { data, error } = await configuredSupabase
        .from("farm_members")
        .select("farm_id, role")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      return data ? { farmId: data.farm_id, role: data.role } : null;
    }).then((result) => {
      if (cancelled) {
        return;
      }

      setFarmLookup(result);
      if (result.state === "found") {
        saveFarmSession(result.session);
        setFarmSession(result.session);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [authUserId, farmLookupAttempt]);

  if (authSession === undefined) {
    return <main className="p-5"><Notice tone="info">Preparando el acceso…</Notice></main>;
  }

  if (!authSession) {
    return <SupabaseSignInPage />;
  }

  const belongsToSignedInUser = farmSession?.userId === authSession.user.id;
  if ((!farmLookup && !belongsToSignedInUser) || farmLookup?.state === "loading") {
    return <main className="p-5"><Notice tone="info">Buscando tu fincaâ€¦</Notice></main>;
  }

  if (farmLookup?.state === "failed") {
    return <main className="mx-auto max-w-xl p-5"><Notice tone="error">No se pudo abrir la finca: {farmLookup.message}</Notice><Button type="button" className="mt-4 bg-lime-700 text-white" onClick={() => setFarmLookupAttempt((current) => current + 1)}>Reintentar</Button></main>;
  }

  if (!farmSession || !belongsToSignedInUser) {
    return (
      <ProvisioningPage
        userId={authSession.user.id}
        onProvisioned={(nextSession) => setFarmSession(nextSession)}
      />
    );
  }

  return <AppShell session={farmSession} onSignOut={signOut} />;
};

const ConfiguredAppBootstrap = () => {
  const [isPreparingLocalData, setIsPreparingLocalData] = useState(true);
  const [localDataError, setLocalDataError] = useState<string>();
  const [repairAttempt, setRepairAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsPreparingLocalData(true);
    setLocalDataError(undefined);

    void repairLegacyUuidRecords(db).then((result) => {
      repairFarmSessionIds(result.replacements);
      if (!cancelled) setIsPreparingLocalData(false);
    }).catch((caught) => {
      if (!cancelled) {
        setLocalDataError(caught instanceof Error ? caught.message : "No se pudieron preparar los datos guardados.");
        setIsPreparingLocalData(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [repairAttempt]);

  if (isPreparingLocalData) {
    return <main className="p-5"><Notice tone="info">Preparando los datos guardados en este celular…</Notice></main>;
  }

  if (localDataError) {
    return <main className="mx-auto max-w-xl p-5"><Notice tone="error">No se pudieron preparar los datos locales: {localDataError}</Notice><Button type="button" className="mt-4 bg-lime-700 text-white" onClick={() => setRepairAttempt((current) => current + 1)}>Reintentar</Button></main>;
  }

  return <ConfiguredApp />;
};

export const App = () =>
  isSupabaseConfigured && supabase ? <ConfiguredAppBootstrap /> : <LocalApp />;
