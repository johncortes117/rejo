import { useCallback, useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { Session } from "@supabase/supabase-js";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AlertTriangle, BadgeDollarSign, Beef, ChartNoAxesCombined, ClipboardPenLine, CloudUpload, House, Menu, Milk, Sprout, TrendingDown, TrendingUp } from "lucide-react";
import { Button, Card, FieldLabel, Notice, TextInput } from "@/components/ui";
import { provisionFarm, readFarmSession } from "@/db/bootstrap";
import { db } from "@/db/rejo-db";
import { nowInFarmTimezone } from "@/domain/time";
import type { FarmSession } from "@/domain/models";
import { AnimalsBrowserPage } from "@/features/animals/animals-browser-page";
import { MilkCapturePage } from "@/features/milk/milk-capture-page";
import { getMilkDashboard } from "@/features/milk/dashboard";
import { getDecisionDashboard, type MilkTrendPoint } from "@/features/insights/decision-dashboard";
import { SettingsPage } from "@/features/settings/settings-page";
import { SettlementsPage } from "@/features/economics/settlements-page";
import { PaddocksPage } from "@/features/paddocks/paddocks-page";
import { MilkControlPage } from "@/features/milk-control/milk-control-page";
import { HerdHubPage, MorePage } from "@/features/navigation/operational-hubs";
import { pullFarmChanges, syncPendingOperations, type SyncStatus } from "@/sync/sync-service";
import { isSupabaseConfigured, supabase } from "@/sync/supabase";

type Page = "home" | "capture" | "herd" | "animals" | "finance" | "paddocks" | "milk-control" | "more" | "settings";
const farmProvisionSchema = z.object({
  farmName: z.string().trim().min(1, "Escribe el nombre de la finca para empezar."),
  ownerName: z.string()
});
type FarmProvisionForm = z.infer<typeof farmProvisionSchema>;

const syncMessage = (status: SyncStatus | undefined, pendingCount: number): string => {
  if (!status || status.state === "offline") {
    return pendingCount > 0 ? "Guardado en el celular" : "Sin conexión";
  }

  if (status.state === "unconfigured") {
    return pendingCount > 0 ? "Guardado en el celular" : "Listo en el celular";
  }

  if (status.state === "failed") {
    return "Guardado en el celular";
  }

  return pendingCount > 0 ? "Guardado en el celular" : "Ya se envió";
};

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
  return <svg className="h-32 w-full overflow-visible" viewBox="0 0 320 112" role="img" aria-label={`Tendencia de ${points.length} medidas del tanque, entre ${minimum.toFixed(1)} y ${maximum.toFixed(1)} litros`}><line x1="12" x2="308" y1="100" y2="100" stroke="currentColor" strokeOpacity="0.15" /><polyline points={coordinates} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" /><circle cx={coordinates.split(" ").at(-1)?.split(",")[0]} cy={coordinates.split(" ").at(-1)?.split(",")[1]} fill="currentColor" r="5" /></svg>;
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
    { label: "Rejo", description: "Animales y fichas", ariaLabel: "Abrir el rejo", icon: Beef, onClick: onHerd, tone: "bg-lime-50 text-lime-950 ring-lime-200" },
    { label: "Potreros", description: "Rotación y lotes", ariaLabel: "Abrir potreros", icon: Sprout, onClick: onPaddocks, tone: "bg-sky-50 text-sky-950 ring-sky-200" },
    { label: "Finanzas", description: "Pagos y costos", ariaLabel: "Abrir finanzas", icon: BadgeDollarSign, onClick: onFinance, tone: "bg-amber-50 text-amber-950 ring-amber-200" },
    { label: "Control", description: "Litros por vaca", ariaLabel: "Abrir control lechero", icon: ClipboardPenLine, onClick: onMilkControl, tone: "bg-stone-100 text-stone-950 ring-stone-200" }
  ];

  return (
    <div className="space-y-7">
      <header className="px-1">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-lime-800">Hoy</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">La finca, al día.</h1>
        <p className="mt-2 text-base text-stone-600">Empieza por lo que pasó hoy; el resto está a un toque.</p>
      </header>

      <section className="rounded-3xl bg-lime-800 p-6 text-white shadow-[0_16px_35px_rgba(77,124,15,0.25)]">
        <p className="text-base font-bold text-lime-100">Medida del tanque · hoy</p>
        <p className="mt-3 text-6xl font-black tracking-tight sm:text-7xl">
          {dashboard?.todayLiters === undefined ? "—" : dashboard.todayLiters.toFixed(1)}
        </p>
        <p className="mt-1 text-lg font-semibold text-lime-100">
          {dashboard?.todayLiters === undefined ? "Aún falta la medida de hoy" : "litros medidos en el tanque"}
        </p>
        <Button type="button" className="mt-6 w-full bg-white text-lime-950 hover:bg-lime-50" onClick={onCapture}>
          <Milk size={20} aria-hidden="true" />
          {dashboard?.todayLiters === undefined ? "Anotar la leche" : "Revisar la medida"}
        </Button>
        <div className="mt-5 flex items-center justify-between gap-4 border-t border-lime-700 pt-4">
          <span className="text-sm font-semibold text-lime-100">Promedio de 7 días</span>
          <span className="text-lg font-black">{dashboard?.sevenDayAverage === undefined ? "Aún no" : `${dashboard.sevenDayAverage.toFixed(1)} L`}</span>
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between gap-3 px-1">
          <div><p className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-stone-500"><AlertTriangle size={16} aria-hidden="true" />Atención hoy</p><h2 className="mt-1 text-2xl font-black text-stone-950">Lo importante</h2></div>
          {decisions && decisions.alerts.length > 2 ? <button type="button" className="min-h-11 rounded-xl px-3 text-sm font-bold text-lime-800 underline" aria-expanded={showAllAlerts} onClick={() => setShowAllAlerts((current) => !current)}>{showAllAlerts ? "Ver menos" : `Ver todas (${decisions.alerts.length})`}</button> : null}
        </div>
        <div className="mt-3 space-y-3">
          {decisions === undefined ? <Notice tone="info">Revisando los registros guardados en el celular…</Notice> : decisions.alerts.length === 0 ? <Notice tone="success">No hay alertas que requieran atención hoy.</Notice> : visibleAlerts.map((alert) => <Notice key={alert.id} tone={alert.tone === "critical" ? "error" : alert.tone === "attention" ? "warning" : "info"}><strong>{alert.title}</strong><br />{alert.detail}</Notice>)}
        </div>
      </section>

      <section>
        <div className="px-1"><p className="text-sm font-bold uppercase tracking-wide text-stone-500">Accesos de la finca</p><h2 className="mt-1 text-2xl font-black text-stone-950">¿Qué necesitas hacer?</h2></div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {shortcuts.map((shortcut) => {
            const Icon = shortcut.icon;
            return <button key={shortcut.label} type="button" aria-label={shortcut.ariaLabel} className={`flex min-h-36 flex-col items-start rounded-3xl p-4 text-left ring-1 transition active:scale-[0.98] ${shortcut.tone}`} onClick={shortcut.onClick}><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/80 shadow-sm"><Icon size={21} aria-hidden="true" /></span><span className="mt-4 text-lg font-black">{shortcut.label}</span><span className="mt-0.5 text-sm leading-snug opacity-75">{shortcut.description}</span></button>;
          })}
        </div>
      </section>

      <Card>
        <div className="flex items-start justify-between gap-4"><div><p className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-stone-500"><ChartNoAxesCombined size={16} aria-hidden="true" />Producción</p><h2 className="mt-1 text-2xl font-black text-stone-950">Tendencia de leche</h2><div className="mt-2 flex items-center gap-2 text-base font-semibold text-stone-700">{decisions?.trendDirection === "down" ? <TrendingDown size={20} className="text-amber-700" aria-hidden="true" /> : <TrendingUp size={20} className="text-lime-700" aria-hidden="true" />}{directionLabel}</div></div><button type="button" aria-expanded={isTrendVisible} className="min-h-11 shrink-0 rounded-xl bg-stone-100 px-3 text-sm font-bold text-stone-800" onClick={() => setIsTrendVisible((current) => !current)}>{isTrendVisible ? "Ocultar" : "Ver"}</button></div>
        {isTrendVisible ? <div className="mt-5"><div className="flex justify-end"><div className="grid grid-cols-2 rounded-xl bg-stone-100 p-1"><button type="button" aria-pressed={trendPeriod === 7} className={`min-h-10 rounded-lg px-3 text-sm font-bold ${trendPeriod === 7 ? "bg-white text-lime-950 shadow-sm" : "text-stone-600"}`} onClick={() => setTrendPeriod(7)}>7 días</button><button type="button" aria-pressed={trendPeriod === 30} className={`min-h-10 rounded-lg px-3 text-sm font-bold ${trendPeriod === 30 ? "bg-white text-lime-950 shadow-sm" : "text-stone-600"}`} onClick={() => setTrendPeriod(30)}>30 días</button></div></div><div className="mt-4 text-lime-800"><MilkTrendChart points={trend} /></div></div> : null}
      </Card>
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

const AppShell = ({ session }: { session: FarmSession }) => {
  const [page, setPage] = useState<Page>("home");
  const [returnPage, setReturnPage] = useState<Page>("home");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>();
  const pendingCount = useLiveQuery(
    () => db.syncQueue.filter((item) => item.farmId === session.farmId && !item.completedAt).count(),
    [session.farmId],
    0
  );

  const sync = useCallback(async () => {
    const status = await syncPendingOperations(db, session.farmId);
    setSyncStatus(status);
    if (status.state === "synced") {
      await pullFarmChanges(db, session.farmId);
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

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col bg-transparent">
      <header className="flex items-center justify-between gap-3 bg-lime-950 px-5 py-4 text-white">
        <div>
          <p className="text-xl font-black tracking-wide">REJO</p>
          <p className="mt-1 inline-flex rounded-full bg-lime-900 px-2.5 py-1 text-sm font-semibold text-lime-100">{syncMessage(syncStatus, pendingCount)}</p>
        </div>
        {pendingCount > 0 ? (
          <button
            className="min-h-12 rounded-2xl bg-white px-4 text-base font-bold text-lime-950"
            type="button"
            onClick={() => void sync()}
          >
            <CloudUpload size={20} aria-hidden="true" />
            Respaldar
          </button>
        ) : null}
      </header>

      <main className="flex-1 p-4 pb-6 pt-6 sm:p-6">
        {page === "home" ? <HomePage session={session} onCapture={() => setPage("capture")} onHerd={() => setPage("herd")} onFinance={() => setPage("finance")} onPaddocks={() => openPaddocks("home")} onMilkControl={() => openMilkControl("home")} /> : null}
        {page === "capture" ? <MilkCapturePage session={session} onSaved={() => setPage("home")} /> : null}
        {page === "herd" ? <HerdHubPage onAnimals={() => setPage("animals")} onMilkControl={() => openMilkControl("herd")} /> : null}
        {page === "animals" ? <AnimalsBrowserPage session={session} onMilkControl={() => openMilkControl("animals")} /> : null}
        {page === "finance" ? <SettlementsPage session={session} /> : null}
        {page === "paddocks" ? <PaddocksPage session={session} onBack={() => setPage(returnPage)} /> : null}
        {page === "milk-control" ? <MilkControlPage session={session} onBack={() => setPage(returnPage)} /> : null}
        {page === "more" ? <MorePage onPaddocks={() => openPaddocks("more")} onSettings={() => setPage("settings")} /> : null}
        {page === "settings" ? <SettingsPage session={session} /> : null}
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

  if (authSession === undefined) {
    return <main className="p-5"><Notice tone="info">Preparando el acceso…</Notice></main>;
  }

  if (!authSession) {
    return <SupabaseSignInPage />;
  }

  const belongsToSignedInUser = farmSession?.userId === authSession.user.id;
  if (!farmSession || !belongsToSignedInUser) {
    return (
      <ProvisioningPage
        userId={authSession.user.id}
        onProvisioned={(nextSession) => setFarmSession(nextSession)}
      />
    );
  }

  return <AppShell session={farmSession} />;
};

export const App = () =>
  isSupabaseConfigured && supabase ? <ConfiguredApp /> : <LocalApp />;
