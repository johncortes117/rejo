import { useEffect, useState, type PropsWithChildren } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Building2, ChevronRight, LogOut, Save, Truck, type LucideIcon } from "lucide-react";
import { Button, Card, FieldLabel, Notice, TextInput } from "@/components/ui";
import type { Buyer, Farm, FarmSession } from "@/domain/models";
import { db } from "@/db/rejo-db";
import { saveFarmSettings } from "@/features/settings/settings";

interface SettingsPageProps {
  session: FarmSession;
  onSignOut?: () => Promise<void>;
}

interface SettingsForm {
  farmName: string;
  ownerName: string;
  buyerName: string;
}

type SettingsSection = "overview" | "farm" | "buyer" | "access";

const toSettingsForm = (farm: Farm, buyer: Buyer): SettingsForm => ({
  farmName: farm.name,
  ownerName: farm.ownerName ?? "",
  buyerName: buyer.name
});

const SettingsEntryShell = ({ title, icon: Icon, onClose, children }: PropsWithChildren<{ title: string; icon: LucideIcon; onClose: () => void }>) => (
  <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-50" role="dialog" aria-modal="true" aria-label={title}>
    <div className="mx-auto min-h-screen max-w-2xl p-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))] sm:p-6">
      <header className="flex items-center gap-3 border-b border-stone-200 pb-4"><Button type="button" className="min-h-11 shrink-0 bg-white px-3 text-stone-800 ring-1 ring-stone-200" onClick={onClose} aria-label="Volver a configuración"><ArrowLeft size={20} aria-hidden="true" /></Button><div className="flex min-w-0 items-center gap-2"><Icon className="shrink-0 text-lime-800" size={20} aria-hidden="true" /><h1 className="truncate text-2xl font-black tracking-tight text-stone-950">{title}</h1></div></header><div className="pt-6">{children}</div>
    </div>
  </div>
);

const SettingsRow = ({ title, detail, icon: Icon, onClick }: { title: string; detail: string; icon: LucideIcon; onClick: () => void }) => (
  <button type="button" aria-label={title} className="flex min-h-20 w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-stone-50 active:bg-lime-50 sm:px-5" onClick={onClick}><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lime-50 text-lime-800"><Icon size={20} aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="block font-black text-stone-950">{title}</span><span className="mt-1 block truncate text-sm text-stone-600">{detail}</span></span><ChevronRight className="shrink-0 text-stone-400" size={20} aria-hidden="true" /></button>
);

export const SettingsPage = ({ session, onSignOut }: SettingsPageProps) => {
  const farm = useLiveQuery(() => db.farms.get(session.farmId), [session.farmId]);
  const buyer = useLiveQuery(() => db.buyers.filter((item) => item.farmId === session.farmId && !item.deletedAt).first(), [session.farmId]);
  const [form, setForm] = useState<SettingsForm>();
  const [section, setSection] = useState<SettingsSection>("overview");
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    if (farm && buyer && form === undefined) setForm(toSettingsForm(farm, buyer));
  }, [buyer, farm, form]);

  if (!farm || !buyer || !form) return <Notice tone="info">Cargando los ajustes…</Notice>;

  const closeEntry = () => { setSection("overview"); setError(undefined); };
  const save = async (nextMessage: string) => {
    setMessage(undefined);
    setError(undefined);
    try {
      await saveFarmSettings(db, { farm: { ...farm, name: form.farmName.trim(), ownerName: form.ownerName.trim() || undefined }, buyer: { ...buyer, name: form.buyerName.trim() || "Alpina" } });
      setMessage(nextMessage);
      setSection("overview");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron guardar los ajustes.");
    }
  };
  const signOut = async () => {
    if (!onSignOut) return;
    setError(undefined);
    setIsSigningOut(true);
    try { await onSignOut(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo cerrar la sesión."); setIsSigningOut(false); }
  };

  return <div className="space-y-5"><header className="px-1"><h1 className="text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">Configuración</h1></header>{message ? <Notice tone="success">{message}</Notice> : null}{section === "overview" && error ? <Notice tone="error">{error}</Notice> : null}
    <section aria-labelledby="settings-sections-title"><div className="px-1"><p className="text-sm font-bold uppercase tracking-wide text-stone-500">La finca</p><h2 id="settings-sections-title" className="mt-1 text-xl font-black text-stone-950">Datos y herramientas</h2></div><div className="mt-3 overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-[0_8px_28px_rgba(28,25,23,0.06)]"><SettingsRow title="Datos de la finca" detail={form.ownerName ? `${form.farmName} · ${form.ownerName}` : form.farmName} icon={Building2} onClick={() => setSection("farm")} /><div className="border-t border-stone-100"><SettingsRow title="Comprador de leche" detail={form.buyerName || "Sin comprador definido"} icon={Truck} onClick={() => setSection("buyer")} /></div>{onSignOut ? <div className="border-t border-stone-100"><SettingsRow title="Acceso" detail="Cerrar sesión en este teléfono" icon={LogOut} onClick={() => setSection("access")} /></div> : null}</div></section>
    {section === "farm" ? <SettingsEntryShell title="Datos de la finca" icon={Building2} onClose={closeEntry}><div className="space-y-5">{error ? <Notice tone="error">{error}</Notice> : null}<Card><div><FieldLabel>Nombre de la finca</FieldLabel><TextInput autoFocus value={form.farmName} onChange={(event) => setForm({ ...form, farmName: event.target.value })} /></div><div className="mt-5"><FieldLabel>Nombre de quien la maneja <span className="normal-case tracking-normal">(opcional)</span></FieldLabel><TextInput value={form.ownerName} onChange={(event) => setForm({ ...form, ownerName: event.target.value })} /></div><Button type="button" className="mt-6 w-full bg-lime-700 text-white" onClick={() => void save("Los datos de la finca quedaron guardados en el celular.")}><Save size={20} aria-hidden="true" />Guardar datos</Button></Card></div></SettingsEntryShell> : null}
    {section === "buyer" ? <SettingsEntryShell title="Comprador de leche" icon={Truck} onClose={closeEntry}><div className="space-y-5">{error ? <Notice tone="error">{error}</Notice> : null}<Card><div><FieldLabel>Nombre</FieldLabel><TextInput autoFocus value={form.buyerName} onChange={(event) => setForm({ ...form, buyerName: event.target.value })} placeholder="Ejemplo: Alpina" /></div><Button type="button" className="mt-6 w-full bg-lime-700 text-white" onClick={() => void save("El comprador quedó guardado en el celular.")}><Save size={20} aria-hidden="true" />Guardar comprador</Button></Card></div></SettingsEntryShell> : null}
    {section === "access" && onSignOut ? <SettingsEntryShell title="Acceso" icon={LogOut} onClose={closeEntry}><div className="space-y-5">{error ? <Notice tone="error">{error}</Notice> : null}<Card><p className="text-lg font-black text-stone-950">Cerrar sesión</p><p className="mt-2 text-base leading-snug text-stone-600">Podrás entrar con otra cuenta en este teléfono. Los registros guardados localmente no se borran.</p><Button type="button" className="mt-6 w-full bg-stone-900 text-white" disabled={isSigningOut} onClick={() => void signOut()}><LogOut size={20} aria-hidden="true" />{isSigningOut ? "Cerrando sesión…" : "Cerrar sesión"}</Button></Card></div></SettingsEntryShell> : null}
  </div>;
};
