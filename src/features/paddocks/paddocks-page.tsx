import { useMemo, useState, type PropsWithChildren } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, ChevronRight, MapPinned, MoveRight, Plus, Sprout, X } from "lucide-react";
import { Button, Card, FieldLabel, Notice, TextInput } from "@/components/ui";
import { db } from "@/db/rejo-db";
import type { FarmSession, PaddockUse } from "@/domain/models";
import { nowInFarmTimezone } from "@/domain/time";
import { createGrazingLot, createPaddock, getPaddockDecisions, moveGrazingLot, type PaddockDecision } from "@/features/paddocks/grazing";

type DetailView = "paddocks" | "lots";
type EntryKind = "move" | "paddock" | "lot";

const useLabels: Record<PaddockUse, string> = { pasture: "Pasto", potato: "Papa", rest: "Descanso", other: "Otro uso" };
const toneByState = { occupied: "bg-lime-100 text-lime-950", ready: "bg-sky-100 text-sky-950", resting: "bg-amber-100 text-amber-950", untracked: "bg-stone-100 text-stone-700" };
const labelByState = { occupied: "En uso", ready: "Listo", resting: "Descansando", untracked: "Sin registro" };
const selectClassName = "min-h-12 w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 text-lg text-stone-950 outline-none focus:border-lime-700 focus:bg-white focus:ring-4 focus:ring-lime-100";

const EntryShell = ({ title, onClose, children }: PropsWithChildren<{ title: string; onClose: () => void }>) => (
  <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-50" role="dialog" aria-modal="true" aria-label={title}>
    <div className="mx-auto min-h-screen max-w-2xl p-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))] sm:p-6">
      <header className="flex items-center justify-between gap-4 border-b border-stone-200 pb-4">
        <div><p className="text-sm font-bold uppercase tracking-[0.16em] text-lime-800">Manejo de la finca</p><h1 className="mt-1 text-3xl font-black tracking-tight text-stone-950">{title}</h1></div>
        <Button type="button" className="shrink-0 bg-white px-4 text-stone-800 ring-1 ring-stone-200" onClick={onClose} aria-label="Cerrar formulario"><X size={22} aria-hidden="true" /></Button>
      </header>
      <div className="pt-6">{children}</div>
    </div>
  </div>
);

const ActionCard = ({ title, description, icon: Icon, onClick, tone = "stone" }: { title: string; description: string; icon: typeof Sprout; onClick: () => void; tone?: "stone" | "lime" | "sky" }) => {
  const toneClasses = { stone: "border-stone-200 bg-white hover:bg-stone-50", lime: "border-lime-200 bg-lime-50 hover:bg-lime-100", sky: "border-sky-200 bg-sky-50 hover:bg-sky-100" };
  return <button type="button" aria-label={`Abrir ${title}`} className={`flex min-h-26 w-full items-center gap-3 rounded-3xl border p-4 text-left shadow-[0_8px_28px_rgba(28,25,23,0.05)] transition active:scale-[0.99] ${toneClasses[tone]}`} onClick={onClick}><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/90 text-lime-800 shadow-sm"><Icon size={22} aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="block text-lg font-black text-stone-950">{title}</span><span className="mt-1 block text-sm leading-snug text-stone-600">{description}</span></span><ChevronRight className="shrink-0 text-stone-400" size={21} aria-hidden="true" /></button>;
};

const PaddockStatusCard = ({ decision, activeLotName }: { decision: PaddockDecision; activeLotName: (id?: string) => string }) => (
  <Card><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-lg font-black text-stone-950">{decision.paddock.name}</p><p className="mt-1 text-sm text-stone-600">{useLabels[decision.paddock.use]} · descanso meta: {decision.paddock.targetRestDays} días</p></div><span className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${toneByState[decision.state]}`}>{labelByState[decision.state]}</span></div><p className="mt-3 text-base font-semibold text-stone-800">{decision.state === "occupied" ? `${activeLotName(decision.activeLotId)} está aquí.` : decision.detail}</p></Card>
);

const MoveLotEntry = ({ session, lots, paddocks, onSaved, onClose }: { session: FarmSession; lots: Array<{ id: string; name: string }>; paddocks: Array<{ id: string; name: string }>; onSaved: (message: string) => void; onClose: () => void }) => {
  const { date } = nowInFarmTimezone();
  const [lotId, setLotId] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [error, setError] = useState<string>();

  const save = async () => {
    try {
      await moveGrazingLot(db, { farmId: session.farmId, userId: session.userId, lotId, paddockId: destinationId, date });
      onSaved("El movimiento quedó guardado en el celular.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar el movimiento.");
    }
  };

  return <EntryShell title="Mover el rejo" onClose={onClose}><div className="space-y-5"><p className="text-base text-stone-600">Elige el lote y el potrero donde quedó hoy. El cambio se guardará aunque no haya señal.</p>{lots.length === 0 || paddocks.length === 0 ? <Notice tone="info">{lots.length === 0 ? "Primero agrega al menos un lote." : "Primero agrega al menos un potrero."}</Notice> : null}{error ? <Notice tone="error">{error}</Notice> : null}<Card><div><FieldLabel>Lote</FieldLabel><select className={selectClassName} value={lotId} onChange={(event) => setLotId(event.target.value)}><option value="">Elige el lote</option>{lots.map((lot) => <option key={lot.id} value={lot.id}>{lot.name}</option>)}</select></div><div className="mt-5"><FieldLabel>Potrero de hoy</FieldLabel><select className={selectClassName} value={destinationId} onChange={(event) => setDestinationId(event.target.value)}><option value="">Elige el potrero</option>{paddocks.map((paddock) => <option key={paddock.id} value={paddock.id}>{paddock.name}</option>)}</select></div><Button type="button" className="mt-6 w-full bg-lime-700 text-white" disabled={!lotId || !destinationId} onClick={() => void save()}><MoveRight size={20} aria-hidden="true" />Registrar movimiento de hoy</Button></Card></div></EntryShell>;
};

const PaddockEntry = ({ session, onSaved, onClose }: { session: FarmSession; onSaved: (message: string) => void; onClose: () => void }) => {
  const [name, setName] = useState("");
  const [use, setUse] = useState<PaddockUse>("pasture");
  const [restDays, setRestDays] = useState("21");
  const [error, setError] = useState<string>();

  const save = async () => {
    try {
      await createPaddock(db, { farmId: session.farmId, userId: session.userId, name, use, targetRestDays: Number(restDays) });
      onSaved("El potrero quedó guardado en el celular.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar el potrero.");
    }
  };

  return <EntryShell title="Agregar potrero" onClose={onClose}><div className="space-y-5"><p className="text-base text-stone-600">Define el nombre, el uso y el descanso esperado para poder seguir la rotación.</p>{error ? <Notice tone="error">{error}</Notice> : null}<Card><div><FieldLabel>Nombre</FieldLabel><TextInput value={name} onChange={(event) => setName(event.target.value)} placeholder="Ejemplo: La loma" /></div><div className="mt-5"><FieldLabel>Uso</FieldLabel><select className={selectClassName} value={use} onChange={(event) => setUse(event.target.value as PaddockUse)}>{Object.entries(useLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="mt-5"><FieldLabel>Días objetivo de descanso</FieldLabel><TextInput type="number" min="0" value={restDays} onChange={(event) => setRestDays(event.target.value)} /></div><Button type="button" className="mt-6 w-full bg-stone-900 text-white" onClick={() => void save()}><Plus size={20} aria-hidden="true" />Guardar potrero</Button></Card></div></EntryShell>;
};

const LotEntry = ({ session, onSaved, onClose }: { session: FarmSession; onSaved: (message: string) => void; onClose: () => void }) => {
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();

  const save = async () => {
    try {
      await createGrazingLot(db, { farmId: session.farmId, userId: session.userId, name });
      onSaved("El lote quedó listo para mover.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar el lote.");
    }
  };

  return <EntryShell title="Agregar lote" onClose={onClose}><div className="space-y-5"><p className="text-base text-stone-600">Un lote reúne animales que se mueven juntos entre potreros.</p>{error ? <Notice tone="error">{error}</Notice> : null}<Card><div><FieldLabel>Nombre del lote</FieldLabel><TextInput value={name} onChange={(event) => setName(event.target.value)} placeholder="Ejemplo: Vacas de leche" /></div><Button type="button" className="mt-6 w-full bg-stone-900 text-white" onClick={() => void save()}><Plus size={20} aria-hidden="true" />Guardar lote</Button></Card></div></EntryShell>;
};

export const PaddocksPage = ({ session, onBack }: { session: FarmSession; onBack: () => void }) => {
  const { date } = nowInFarmTimezone();
  const [detail, setDetail] = useState<DetailView>();
  const [entry, setEntry] = useState<EntryKind>();
  const [message, setMessage] = useState<string>();
  const paddocks = useLiveQuery(() => db.paddocks.filter((item) => item.farmId === session.farmId && !item.deletedAt).toArray(), [session.farmId], []);
  const lots = useLiveQuery(() => db.grazingLots.filter((item) => item.farmId === session.farmId && !item.deletedAt).toArray(), [session.farmId], []);
  const records = useLiveQuery(() => db.grazingRecords.filter((item) => item.farmId === session.farmId && !item.deletedAt).toArray(), [session.farmId], []);
  const decisions = useMemo(() => getPaddockDecisions(paddocks, records, date), [paddocks, records, date]);
  const occupied = decisions.filter((decision) => decision.state === "occupied");
  const ready = decisions.filter((decision) => decision.state === "ready");
  const resting = decisions.filter((decision) => decision.state === "resting");
  const activeLotName = (id?: string) => lots.find((item) => item.id === id)?.name ?? "Un lote";
  const activeLocationByLot = useMemo(() => new Map(occupied.map((decision) => [decision.activeLotId, decision.paddock.name])), [occupied]);

  const finishEntry = (nextMessage: string) => {
    setMessage(nextMessage);
    setEntry(undefined);
  };

  return <div className="space-y-6"><header className="flex items-start gap-3"><Button type="button" className="shrink-0 bg-white px-4 text-stone-800 ring-1 ring-stone-200" onClick={onBack} aria-label="Volver al inicio"><ArrowLeft size={20} aria-hidden="true" /></Button><div><p className="text-sm font-bold uppercase tracking-[0.16em] text-lime-800">Manejo de la finca</p><h1 className="mt-1 text-3xl font-black tracking-tight text-stone-950">Potreros y rotación</h1><p className="mt-2 text-base text-stone-600">Ubica el rejo primero; revisa el descanso y administra los potreros cuando lo necesites.</p></div></header>{message ? <Notice tone="success">{message}</Notice> : null}{detail ? <section className="space-y-4"><div className="flex items-end justify-between gap-3 px-1"><div><p className="text-sm font-bold uppercase tracking-wide text-stone-500">{detail === "paddocks" ? "Estado de la rotación" : "Grupos de animales"}</p><h2 className="mt-1 text-2xl font-black text-stone-950">{detail === "paddocks" ? "Todos los potreros" : "Lotes"}</h2></div><button type="button" className="min-h-11 rounded-xl px-3 text-sm font-bold text-lime-800 underline" onClick={() => setDetail(undefined)}>Volver al resumen</button></div>{detail === "paddocks" ? <div className="space-y-3">{decisions.length === 0 ? <Notice tone="info">Aún no hay potreros registrados.</Notice> : decisions.map((decision) => <PaddockStatusCard key={decision.paddock.id} decision={decision} activeLotName={activeLotName} />)}</div> : <div className="space-y-3">{lots.length === 0 ? <Notice tone="info">Aún no hay lotes registrados.</Notice> : lots.map((lot) => <Card key={lot.id}><div className="flex items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-lime-50 text-lime-800"><MapPinned size={22} aria-hidden="true" /></span><div><p className="text-lg font-black text-stone-950">{lot.name}</p><p className="mt-1 text-sm text-stone-600">{activeLocationByLot.get(lot.id) ? `Está en ${activeLocationByLot.get(lot.id)}.` : "Sin ubicación registrada."}</p></div></div></Card>)}</div>}</section> : <><section className="space-y-3"><div className="flex items-center gap-2 px-1"><MapPinned size={19} className="text-lime-800" aria-hidden="true" /><div><p className="text-sm font-bold uppercase tracking-wide text-stone-500">Ubicación actual</p><h2 className="mt-1 text-2xl font-black text-stone-950">¿Dónde está el rejo?</h2></div></div>{occupied.length === 0 ? <Notice tone="info">Aún no hay una ubicación registrada. Cuando muevas el rejo, anótalo aquí.</Notice> : occupied.map((decision) => <Card key={decision.paddock.id}><p className="text-sm font-bold uppercase tracking-wide text-stone-500">{activeLotName(decision.activeLotId)}</p><p className="mt-1 text-2xl font-black text-stone-950">{decision.paddock.name}</p><p className="mt-1 text-sm text-stone-600">{useLabels[decision.paddock.use]} · desde hoy o el último movimiento registrado.</p></Card>)}<Button type="button" className="w-full bg-lime-700 text-white" onClick={() => setEntry("move")}><MoveRight size={20} aria-hidden="true" />Mover el rejo</Button></section><section className="space-y-3"><div className="px-1"><p className="text-sm font-bold uppercase tracking-wide text-stone-500">Descanso</p><h2 className="mt-1 text-2xl font-black text-stone-950">Estado de potreros</h2></div><div className="grid grid-cols-3 gap-3"><Card><p className="text-sm font-bold uppercase tracking-wide text-stone-500">En uso</p><p className="mt-1 text-3xl font-black text-stone-950">{occupied.length}</p></Card><Card><p className="text-sm font-bold uppercase tracking-wide text-stone-500">Listos</p><p className="mt-1 text-3xl font-black text-stone-950">{ready.length}</p></Card><Card><p className="text-sm font-bold uppercase tracking-wide text-stone-500">Descansan</p><p className="mt-1 text-3xl font-black text-stone-950">{resting.length}</p></Card></div><button type="button" className="min-h-12 w-full rounded-2xl bg-white px-4 text-base font-bold text-lime-800 ring-1 ring-stone-200" onClick={() => setDetail("paddocks")}>Ver todos los potreros</button></section><section className="space-y-3"><div className="px-1"><p className="text-sm font-bold uppercase tracking-wide text-stone-500">Administración</p><h2 className="mt-1 text-2xl font-black text-stone-950">Organiza la rotación</h2></div><div className="grid gap-3 sm:grid-cols-2"><ActionCard title="Agregar potrero" description="Define su uso y días de descanso." icon={Sprout} onClick={() => setEntry("paddock")} tone="lime" /><ActionCard title="Agregar lote" description="Crea un grupo de animales que se mueve junto." icon={MapPinned} onClick={() => setEntry("lot")} tone="sky" /></div>{lots.length > 0 ? <button type="button" className="min-h-11 w-full rounded-xl px-3 text-sm font-bold text-lime-800 underline" onClick={() => setDetail("lots")}>Ver lotes registrados</button> : null}</section></>}{entry === "move" ? <MoveLotEntry session={session} lots={lots} paddocks={paddocks} onClose={() => setEntry(undefined)} onSaved={finishEntry} /> : null}{entry === "paddock" ? <PaddockEntry session={session} onClose={() => setEntry(undefined)} onSaved={finishEntry} /> : null}{entry === "lot" ? <LotEntry session={session} onClose={() => setEntry(undefined)} onSaved={finishEntry} /> : null}</div>;
};
