import { useCallback, useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { Session } from "@supabase/supabase-js";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Card, FieldLabel, Notice, TextInput } from "@/components/ui";
import { provisionFarm, readFarmSession } from "@/db/bootstrap";
import { db } from "@/db/rejo-db";
import { nowInFarmTimezone } from "@/domain/time";
import type { FarmSession } from "@/domain/models";
import { AnimalsPage } from "@/features/animals/animals-page";
import { MilkCapturePage } from "@/features/milk/milk-capture-page";
import { getMilkDashboard } from "@/features/milk/dashboard";
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

const HomePage = ({ session, onCapture }: HomePageProps) => {
  const { date } = nowInFarmTimezone();
  const dashboard = useLiveQuery(() => getMilkDashboard(db, session.farmId, date), [session.farmId, date]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-4xl font-black text-stone-950">Inicio</h1>
        <p className="mt-1 text-lg text-stone-700">Un número al día es suficiente para empezar.</p>
      </div>

      <Card>
        <p className="text-lg font-bold text-stone-700">Litros de hoy</p>
        <p className="mt-1 text-6xl font-black text-lime-800">
          {dashboard?.todayLiters === undefined ? "—" : dashboard.todayLiters.toFixed(1)}
        </p>
        <p className="mt-2 text-lg text-stone-700">
          {dashboard?.todayLiters === undefined ? "Todavía no has anotado la leche de hoy." : "medidos en el tanque"}
        </p>
      </Card>

      <Card>
        <p className="text-lg font-bold text-stone-700">Promedio de los últimos 7 días</p>
        <p className="mt-1 text-4xl font-black text-stone-950">
          {dashboard?.sevenDayAverage === undefined ? "Aún no sabemos" : dashboard.sevenDayAverage.toFixed(1) + " L"}
        </p>
      </Card>

      <Button type="button" className="w-full bg-lime-700 text-white hover:bg-lime-800" onClick={onCapture}>
        Anotar la leche de hoy
      </Button>
    </div>
  );
};

interface NavigationProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const Navigation = ({ currentPage, onNavigate }: NavigationProps) => {
  const links: Array<{ page: Page; label: string }> = [
    { page: "home", label: "Inicio" },
    { page: "capture", label: "Anotar" },
    { page: "animals", label: "Mis vacas" },
    { page: "settings", label: "Ajustes" }
  ];

  return (
    <nav className="sticky bottom-0 grid grid-cols-4 gap-1 border-t border-stone-200 bg-white p-2">
      {links.map((link) => (
        <button
          className={
            "min-h-12 rounded-lg px-2 text-lg font-bold " +
            (currentPage === link.page ? "bg-lime-700 text-white" : "text-stone-700")
          }
          key={link.page}
          onClick={() => onNavigate(link.page)}
          type="button"
        >
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
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col bg-stone-50">
      <header className="flex items-center justify-between gap-3 bg-lime-950 px-5 py-4 text-white">
        <div>
          <p className="text-2xl font-black">REJO</p>
          <p className="text-lg text-lime-100">{syncMessage(syncStatus, pendingCount)}</p>
        </div>
        {pendingCount > 0 ? (
          <button
            className="min-h-12 rounded-lg bg-lime-800 px-3 text-lg font-bold"
            type="button"
            onClick={() => void sync()}
          >
            Respaldar
          </button>
        ) : null}
      </header>

      <main className="flex-1 p-5">
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
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [isSending, setIsSending] = useState(false);

  const signIn = async () => {
    if (!supabase || !email.trim()) {
      setError("Escribe tu correo para recibir el enlace.");
      return;
    }

    setIsSending(true);
    setError(undefined);

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin }
    });

    setIsSending(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    setMessage("Revisa tu correo y abre el enlace en este mismo teléfono.");
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center p-5">
      <Card>
        <p className="text-lg font-bold text-lime-800">REJO</p>
        <h1 className="mt-2 text-4xl font-black text-stone-950">Entrar a la finca</h1>
        <p className="mt-3 text-lg text-stone-700">
          Te enviaremos un enlace seguro. Solo se necesita señal para este primer paso.
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

        <Button
          type="button"
          className="mt-7 w-full bg-lime-700 text-white hover:bg-lime-800"
          disabled={isSending}
          onClick={() => void signIn()}
        >
          {isSending ? "Enviando…" : "Enviar enlace"}
        </Button>
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
