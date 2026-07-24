import { useCallback, useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { Session } from "@supabase/supabase-js";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AlertTriangle, Beef, ChartNoAxesCombined, ClipboardPenLine, CloudUpload, Droplets, House, Milk, Settings, TrendingDown, TrendingUp } from "lucide-react";
import { Button, Card, FieldLabel, Notice, TextInput } from "@/components/ui";
import { provisionFarm, readFarmSession } from "@/db/bootstrap";
import { db } from "@/db/rejo-db";
import { nowInFarmTimezone } from "@/domain/time";
import type { FarmSession } from "@/domain/models";
import { AnimalsPage } from "@/features/animals/animals-page";
import { MilkCapturePage } from "@/features/milk/milk-capture-page";
import { getMilkDashboard } from "@/features/milk/dashboard";
import { getDecisionDashboard, type MilkTrendPoint } from "@/features/insights/decision-dashboard";
import { SettingsPage } from "@/features/settings/settings-page";
import { pullFarmChanges, syncPendingOperations, type SyncStatus } from "@/sync/sync-service";
import { isSupabaseConfigured, supabase } from "@/sync/supabase";

type Page = "home" | "capture" | "animals" | "settings";
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

const HomePage = ({ session, onCapture }: HomePageProps) => {
  const { date } = nowInFarmTimezone();
  const [trendPeriod, setTrendPeriod] = useState<7 | 30>(7);
  const dashboard = useLiveQuery(() => getMilkDashboard(db, session.farmId, date), [session.farmId, date]);
  const decisions = useLiveQuery(() => getDecisionDashboard(db, session.farmId, date), [session.farmId, date]);
  const trend = decisions?.trend.slice(-trendPeriod) ?? [];
  const directionLabel = decisions?.trendDirection === "down" ? "Bajando frente a los días anteriores" : decisions?.trendDirection === "up" ? "Subiendo frente a los días anteriores" : decisions?.trendDirection === "steady" ? "Se mantiene estable" : "Aún no hay tendencia suficiente";

  return (
    <div className="space-y-6">
      <div className="px-1">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-lime-800">Resumen de hoy</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">La finca, al día.</h1>
      </div>

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
      </section>

      <Card>
        <p className="text-sm font-bold uppercase tracking-wide text-stone-500">Referencia</p>
        <p className="mt-1 text-3xl font-black tracking-tight text-stone-950">
          {dashboard?.sevenDayAverage === undefined ? "Aún no sabemos" : dashboard.sevenDayAverage.toFixed(1) + " L"}
        </p>
        <p className="mt-1 text-base text-stone-600">Promedio de los últimos 7 días.</p>
      </Card>

      <section>
        <div className="flex items-end justify-between gap-3 px-1">
          <div><p className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-stone-500"><AlertTriangle size={16} aria-hidden="true" />Atención hoy</p><h2 className="mt-1 text-2xl font-black text-stone-950">Lo que requiere revisión</h2></div>
          {decisions?.alerts.length ? <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-950">{decisions.alerts.length}</span> : null}
        </div>
        <div className="mt-3 space-y-3">
          {decisions === undefined ? <Notice tone="info">Revisando los registros guardados en el celular…</Notice> : decisions.alerts.length === 0 ? <Notice tone="success">No hay alertas que requieran atención hoy.</Notice> : decisions.alerts.slice(0, 4).map((alert) => <Notice key={alert.id} tone={alert.tone === "critical" ? "error" : alert.tone === "attention" ? "warning" : "info"}><strong>{alert.title}</strong><br />{alert.detail}</Notice>)}
        </div>
      </section>

      <Card>
        <div className="flex items-start justify-between gap-4"><div><p className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-stone-500"><ChartNoAxesCombined size={16} aria-hidden="true" />Tendencia de leche</p><h2 className="mt-1 text-2xl font-black text-stone-950">Medida del tanque</h2></div><div className="grid grid-cols-2 rounded-xl bg-stone-100 p-1"><button type="button" aria-pressed={trendPeriod === 7} className={`min-h-10 rounded-lg px-3 text-sm font-bold ${trendPeriod === 7 ? "bg-white text-lime-950 shadow-sm" : "text-stone-600"}`} onClick={() => setTrendPeriod(7)}>7 días</button><button type="button" aria-pressed={trendPeriod === 30} className={`min-h-10 rounded-lg px-3 text-sm font-bold ${trendPeriod === 30 ? "bg-white text-lime-950 shadow-sm" : "text-stone-600"}`} onClick={() => setTrendPeriod(30)}>30 días</button></div></div>
        <div className="mt-5 text-lime-800"><MilkTrendChart points={trend} /></div>
        <div className="mt-2 flex items-center gap-2 text-base font-semibold text-stone-700">{decisions?.trendDirection === "down" ? <TrendingDown size={20} className="text-amber-700" aria-hidden="true" /> : <TrendingUp size={20} className="text-lime-700" aria-hidden="true" />}{directionLabel}</div>
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
    { page: "capture" as const, label: "Anotar", icon: Droplets },
    { page: "animals" as const, label: "Mis vacas", icon: Beef },
    { page: "settings" as const, label: "Ajustes", icon: Settings }
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
        {page === "home" ? <HomePage session={session} onCapture={() => setPage("capture")} /> : null}
        {page === "capture" ? <MilkCapturePage session={session} onSaved={() => setPage("home")} /> : null}
        {page === "animals" ? <AnimalsPage session={session} /> : null}
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
