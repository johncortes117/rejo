import { useMemo, useState, type PropsWithChildren } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, MapPinned, MoveRight, Plus, Sprout, X } from "lucide-react";
import { Button, Card, FieldLabel, Notice, SegmentedControl, TextInput } from "@/components/ui";
import { db } from "@/db/rejo-db";
import type { FarmSession, PaddockUse } from "@/domain/models";
import { nowInFarmTimezone } from "@/domain/time";
import { createGrazingLot, createPaddock, getPaddockDecisions, moveGrazingLot, type PaddockDecision } from "@/features/paddocks/grazing";

type DetailView = "summary" | "paddocks" | "lots";
type EntryKind = "move" | "paddock" | "lot";

const useLabels: Record<PaddockUse, string> = { pasture: "Pasto", potato: "Papa", rest: "Descanso", other: "Otro uso" };
const toneByState = { occupied: "bg-lime-100 text-lime-950", ready: "bg-sky-100 text-sky-950", resting: "bg-amber-100 text-amber-950", untracked: "bg-stone-100 text-stone-700" };
const labelByState = { occupied: "En uso", ready: "Listo", resting: "Descansando", untracked: "Sin registro" };
const selectClassName = "min-h-12 w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 text-lg text-stone-950 outline-none focus:border-lime-700 focus:bg-white focus:ring-4 focus:ring-lime-100";

const EntryShell = ({ title, onClose, children }: PropsWithChildren<{ title: string; onClose: () => void }>) => (
  <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-50" role="dialog" aria-modal="true" aria-label={title}>
    <div className="mx-auto min-h-screen max-w-2xl p-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))] sm:p-6">
      <header className="flex items-center justify-between gap-4 border-b border-stone-200 pb-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-lime-800">Potreros</p><h1 className="mt-1 text-3xl font-black tracking-tight text-stone-950">{title}</h1></div><Button type="button" className="min-h-11 shrink-0 bg-white px-3 text-stone-800 ring-1 ring-stone-200" onClick={onClose} aria-label="Cerrar formulario"><X size={20} aria-hidden="true" /></Button></header>
      <div className="pt-6">{children}</div>
    </div>
  </div>
);

const PaddockStatusRow = ({ decision, activeLotName }: { decision: PaddockDecision; activeLotName: (id?: string) => string }) => (
  <article className="flex min-h-20 items-center gap-3 px-4 py-3 sm:px-5"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneByState[decision.state]}`}><Sprout size={20} aria-hidden="true" /></span><div className="min-w-0 flex-1"><p className="truncate font-black text-stone-950">{decision.paddock.name}</p><p className="mt-1 text-sm leading-snug text-stone-600">{decision.state === "occupied" ? `${activeLotName(decision.activeLotId)} está aquí.` : decision.detail}</p></div><span className={`shrink-0 rounded-lg px-2 py-1 text-xs font-bold ${toneByState[decision.state]}`}>{labelByState[decision.state]}</span></article>
);

const MoveLotEntry = ({ session, lots, paddocks, onSaved, onClose }: { session: FarmSession; lots: Array<{ id: string; name: string }>; paddocks: Array<{ id: string; name: string }>; onSaved: (message: string) => void; onClose: () => void }) => {
  const { date } = nowInFarmTimezone();
  const [lotId, setLotId] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [error, setError] = useState<string>();
  const save = async () => {
    try { await moveGrazingLot(db, { farmId: session.farmId, userId: session.userId, lotId, paddockId: destinationId, date }); onSaved("El movimiento quedó guardado en el celular."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo guardar el movimiento."); }
  };
  return <EntryShell title="Mover el rejo" onClose={onClose}><div className="space-y-5"><p className="text-base text-stone-600">Elige el lote y el potrero donde quedó hoy. El cambio se guardará aunque no haya señal.</p>{lots.length === 0 || paddocks.length === 0 ? <Notice tone="info">{lots.length === 0 ? "Primero agrega al menos un lote." : "Primero agrega al menos un potrero."}</Notice> : null}{error ? <Notice tone="error">{error}</Notice> : null}<Card><div><FieldLabel>Lote</FieldLabel><select className={selectClassName} value={lotId} onChange={(event) => setLotId(event.target.value)}><option value="">Elige el lote</option>{lots.map((lot) => <option key={lot.id} value={lot.id}>{lot.name}</option>)}</select></div><div className="mt-5"><FieldLabel>Potrero de hoy</FieldLabel><select className={selectClassName} value={destinationId} onChange={(event) => setDestinationId(event.target.value)}><option value="">Elige el potrero</option>{paddocks.map((paddock) => <option key={paddock.id} value={paddock.id}>{paddock.name}</option>)}</select></div><Button type="button" className="mt-6 w-full bg-lime-700 text-white" disabled={!lotId || !destinationId} onClick={() => void save()}><MoveRight size={20} aria-hidden="true" />Registrar movimiento de hoy</Button></Card></div></EntryShell>;
};

const PaddockEntry = ({ session, onSaved, onClose }: { session: FarmSession; onSaved: (message: string) => void; onClose: () => void }) => {
  const [name, setName] = useState("");
  const [use, setUse] = useState<PaddockUse>("pasture");
  const [restDays, setRestDays] = useState("21");
  const [error, setError] = useState<string>();
  const save = async () => {
    try { await createPaddock(db, { farmId: session.farmId, userId: session.userId, name, use, targetRestDays: Number(restDays) }); onSaved("El potrero quedó guardado en el celular."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo guardar el potrero."); }
  };
  return <EntryShell title="Agregar potrero" onClose={onClose}><div className="space-y-5"><p className="text-base text-stone-600">Define el nombre, el uso y el descanso esperado para poder seguir la rotación.</p>{error ? <Notice tone="error">{error}</Notice> : null}<Card><div><FieldLabel>Nombre</FieldLabel><TextInput value={name} onChange={(event) => setName(event.target.value)} placeholder="Ejemplo: La loma" /></div><div className="mt-5"><FieldLabel>Uso</FieldLabel><select className={selectClassName} value={use} onChange={(event) => setUse(event.target.value as PaddockUse)}>{Object.entries(useLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="mt-5"><FieldLabel>Días objetivo de descanso</FieldLabel><TextInput type="number" min="0" value={restDays} onChange={(event) => setRestDays(event.target.value)} /></div><Button type="button" className="mt-6 w-full bg-stone-900 text-white" onClick={() => void save()}><Plus size={20} aria-hidden="true" />Guardar potrero</Button></Card></div></EntryShell>;
};

const LotEntry = ({ session, onSaved, onClose }: { session: FarmSession; onSaved: (message: string) => void; onClose: () => void }) => {
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const save = async () => {
    try { await createGrazingLot(db, { farmId: session.farmId, userId: session.userId, name }); onSaved("El lote quedó listo para mover."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo guardar el lote."); }
  };
  return <EntryShell title="Agregar lote" onClose={onClose}><div className="space-y-5"><p className="text-base text-stone-600">Un lote reúne animales que se mueven juntos entre potreros.</p>{error ? <Notice tone="error">{error}</Notice> : null}<Card><div><FieldLabel>Nombre del lote</FieldLabel><TextInput value={name} onChange={(event) => setName(event.target.value)} placeholder="Ejemplo: Vacas de leche" /></div><Button type="button" className="mt-6 w-full bg-stone-900 text-white" onClick={() => void save()}><Plus size={20} aria-hidden="true" />Guardar lote</Button></Card></div></EntryShell>;
};

export const PaddocksPage = ({ session, onBack }: { session: FarmSession; onBack: () => void }) => {
  const { date } = nowInFarmTimezone();
  const [view, setView] = useState<DetailView>("summary");
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
  const finishEntry = (nextMessage: string) => { setMessage(nextMessage); setEntry(undefined); };
  const locationTitle = occupied.length === 0 ? "Ubicación pendiente" : `${occupied.length} ${occupied.length === 1 ? "lote ubicado" : "lotes ubicados"}`;

  return <div className="space-y-5"><header className="flex items-center gap-3 px-1"><Button type="button" className="min-h-11 shrink-0 bg-white px-3 text-stone-800 ring-1 ring-stone-200" onClick={onBack} aria-label="Volver al inicio"><ArrowLeft size={20} aria-hidden="true" /></Button><h1 className="text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">Potreros</h1></header>{message ? <Notice tone="success">{message}</Notice> : null}<SegmentedControl ariaLabel="Vista de potreros" value={view} onChange={setView} options={[{ id: "summary", label: "Resumen" }, { id: "paddocks", label: "Potreros" }, { id: "lots", label: "Lotes" }]} />
    {view === "summary" ? <section className="space-y-4"><section className="rounded-3xl bg-lime-800 p-5 text-white shadow-[0_14px_30px_rgba(77,124,15,0.22)]"><div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-lime-100"><MapPinned size={23} aria-hidden="true" /></span><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-lime-200">Rotación hoy</p><h2 className="mt-1 text-2xl font-black tracking-tight">{locationTitle}</h2><p className="mt-1 text-sm leading-snug text-lime-100">{occupied.length === 0 ? "Registra dónde quedó el rejo para empezar a seguir el descanso." : "Revisa la ubicación actual y el estado de los potreros."}</p></div></div><div className="mt-4 flex flex-wrap gap-2 border-t border-lime-700 pt-4"><span className="rounded-xl bg-white/10 px-2.5 py-2 text-sm font-bold">En uso <strong className="ml-1 rounded-md bg-white/15 px-1.5 py-0.5 text-xs">{occupied.length}</strong></span><span className="rounded-xl bg-white/10 px-2.5 py-2 text-sm font-bold">Listos <strong className="ml-1 rounded-md bg-white/15 px-1.5 py-0.5 text-xs">{ready.length}</strong></span><span className="rounded-xl bg-white/10 px-2.5 py-2 text-sm font-bold">Descansan <strong className="ml-1 rounded-md bg-white/15 px-1.5 py-0.5 text-xs">{resting.length}</strong></span></div></section><section><div className="flex items-end justify-between gap-3 px-1"><div><p className="text-sm font-bold uppercase tracking-wide text-stone-500">Ubicación actual</p><h2 className="mt-1 text-xl font-black text-stone-950">El rejo hoy</h2></div><span className="text-sm font-semibold text-stone-500">{occupied.length === 0 ? "Sin registro" : "Actualizado"}</span></div><div className="mt-3 overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-[0_8px_28px_rgba(28,25,23,0.06)]">{occupied.length === 0 ? <div className="p-5"><p className="font-black text-stone-950">Aún no hay una ubicación registrada.</p><p className="mt-1 text-sm leading-snug text-stone-600">Cuando muevas el rejo, anótalo aquí.</p></div> : occupied.map((decision, index) => <article key={decision.paddock.id} className={`flex min-h-20 items-center gap-3 px-4 py-3 sm:px-5 ${index ? "border-t border-stone-100" : ""}`}><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lime-100 text-lime-900"><MapPinned size={20} aria-hidden="true" /></span><div className="min-w-0 flex-1"><p className="font-black text-stone-950">{activeLotName(decision.activeLotId)}</p><p className="mt-1 text-sm text-stone-600">En {decision.paddock.name}</p></div><span className="rounded-lg bg-lime-100 px-2 py-1 text-xs font-bold text-lime-950">En uso</span></article>)}</div></section><Button type="button" className="w-full bg-lime-700 text-white" onClick={() => setEntry("move")}><MoveRight size={20} aria-hidden="true" />Mover el rejo</Button></section> : null}
    {view === "paddocks" ? <section><div className="flex items-end justify-between gap-3 px-1"><div><p className="text-sm font-bold uppercase tracking-wide text-stone-500">Estado de la rotación</p><h2 className="mt-1 text-xl font-black text-stone-950">Potreros</h2></div><Button type="button" className="min-h-11 bg-lime-700 px-3 text-white" onClick={() => setEntry("paddock")} aria-label="Agregar potrero"><Plus size={19} aria-hidden="true" />Agregar</Button></div><div className="mt-3 overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-[0_8px_28px_rgba(28,25,23,0.06)]">{decisions.length === 0 ? <div className="p-5"><p className="font-black text-stone-950">Aún no hay potreros registrados.</p><p className="mt-1 text-sm text-stone-600">Agrega el primero para organizar la rotación.</p></div> : decisions.map((decision, index) => <div key={decision.paddock.id} className={index ? "border-t border-stone-100" : ""}><PaddockStatusRow decision={decision} activeLotName={activeLotName} /></div>)}</div></section> : null}
    {view === "lots" ? <section><div className="flex items-end justify-between gap-3 px-1"><div><p className="text-sm font-bold uppercase tracking-wide text-stone-500">Animales que se mueven juntos</p><h2 className="mt-1 text-xl font-black text-stone-950">Lotes</h2></div><Button type="button" className="min-h-11 bg-lime-700 px-3 text-white" onClick={() => setEntry("lot")} aria-label="Agregar lote"><Plus size={19} aria-hidden="true" />Agregar</Button></div><div className="mt-3 overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-[0_8px_28px_rgba(28,25,23,0.06)]">{lots.length === 0 ? <div className="p-5"><p className="font-black text-stone-950">Aún no hay lotes registrados.</p><p className="mt-1 text-sm text-stone-600">Crea uno para registrar qué animales se mueven juntos.</p></div> : lots.map((lot, index) => <article key={lot.id} className={`flex min-h-20 items-center gap-3 px-4 py-3 sm:px-5 ${index ? "border-t border-stone-100" : ""}`}><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-900"><MapPinned size={20} aria-hidden="true" /></span><div className="min-w-0 flex-1"><p className="font-black text-stone-950">{lot.name}</p><p className="mt-1 text-sm text-stone-600">{activeLocationByLot.get(lot.id) ? `Está en ${activeLocationByLot.get(lot.id)}.` : "Sin ubicación registrada."}</p></div></article>)}</div></section> : null}
    {entry === "move" ? <MoveLotEntry session={session} lots={lots} paddocks={paddocks} onClose={() => setEntry(undefined)} onSaved={finishEntry} /> : null}{entry === "paddock" ? <PaddockEntry session={session} onClose={() => setEntry(undefined)} onSaved={finishEntry} /> : null}{entry === "lot" ? <LotEntry session={session} onClose={() => setEntry(undefined)} onSaved={finishEntry} /> : null}
  </div>;
};
