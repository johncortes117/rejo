import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, BarChart3, CalendarDays, Check, ClipboardPenLine, Save, TrendingDown, TrendingUp } from "lucide-react";
import { Button, Card, FieldLabel, Notice, TextInput } from "@/components/ui";
import { db } from "@/db/rejo-db";
import type { Animal, FarmSession, HerdGroup } from "@/domain/models";
import { nowInFarmTimezone } from "@/domain/time";
import { ensureDefaultHerdGroups } from "@/features/animals/herd-groups";
import { recordMilkControl, summarizeMilkControl, type MilkControlSummary } from "@/features/milk-control/milk-control";

const formatLiters = (value: number) => `${value.toFixed(1)} L`;
const formatDate = (value: string) => new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeZone: "America/Guayaquil" }).format(new Date(`${value}T12:00:00-05:00`));

const preferredMilkingGroup = (groups: HerdGroup[]) => groups.find((group) => group.name.trim().toLocaleLowerCase("es-EC") === "en ordeño") ?? groups[0];

const animalGroupId = (animal: Animal, groups: HerdGroup[]) => animal.herdGroupId ?? groups[0]?.id;

const ControlSummary = ({ milk }: { milk: MilkControlSummary }) => {
  const count = Object.keys(milk.bands).length;
  const change = milk.priorTotalLiters === undefined ? undefined : milk.totalLiters - milk.priorTotalLiters;
  const trendIsUp = milk.trend === "up";

  if (!milk.session) {
    return <section className="rounded-3xl bg-stone-950 p-5 text-white shadow-[0_14px_30px_rgba(28,25,23,0.16)]"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10"><ClipboardPenLine size={24} aria-hidden="true" /></span><h2 className="mt-4 text-2xl font-black">Todavía no hay un control</h2><p className="mt-2 max-w-md text-base leading-snug text-stone-300">Cuando midas los litros por vaca, guárdalos aquí para tener una referencia en el siguiente control.</p></section>;
  }

  return <section className="rounded-3xl bg-lime-800 p-5 text-white shadow-[0_14px_30px_rgba(77,124,15,0.22)]"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-lime-200">Último control</p><h2 className="mt-1 text-2xl font-black tracking-tight">{formatDate(milk.session.date)}</h2></div><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15"><BarChart3 size={23} aria-hidden="true" /></span></div><div className="mt-5 grid grid-cols-2 gap-3 border-t border-lime-700 pt-4"><div><p className="text-xs font-bold uppercase tracking-wide text-lime-200">Total</p><p className="mt-1 text-3xl font-black">{formatLiters(milk.totalLiters)}</p></div><div><p className="text-xs font-bold uppercase tracking-wide text-lime-200">Promedio</p><p className="mt-1 text-3xl font-black">{milk.averageLiters === undefined ? "—" : formatLiters(milk.averageLiters)}</p><p className="mt-1 text-xs font-semibold text-lime-100">{count} {count === 1 ? "vaca" : "vacas"}</p></div></div><div className="mt-4 flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 text-sm font-bold">{milk.trend === undefined ? <CalendarDays size={18} aria-hidden="true" /> : trendIsUp ? <TrendingUp size={18} aria-hidden="true" /> : milk.trend === "down" ? <TrendingDown size={18} aria-hidden="true" /> : <Check size={18} aria-hidden="true" />}<span>{change === undefined ? "El siguiente control permitirá comparar" : milk.trend === "steady" ? "Se mantiene frente al control anterior" : `${change > 0 ? "+" : ""}${formatLiters(change)} frente al anterior`}</span></div></section>;
};

const Distribution = ({ milk }: { milk: MilkControlSummary }) => {
  if (!milk.session) return null;
  const count = Object.values(milk.bands);
  const bands = [
    { label: "Por encima", count: count.filter((band) => band === "high").length, classes: "bg-lime-100 text-lime-950" },
    { label: "En el promedio", count: count.filter((band) => band === "medium").length, classes: "bg-sky-100 text-sky-950" },
    { label: "Por debajo", count: count.filter((band) => band === "low").length, classes: "bg-amber-100 text-amber-950" }
  ];
  return <Card><div className="flex items-center gap-2"><BarChart3 size={18} className="text-lime-800" aria-hidden="true" /><h2 className="text-lg font-black text-stone-950">Comparación del último control</h2></div><div className="mt-4 grid grid-cols-3 gap-2 text-center">{bands.map((band) => <div key={band.label} className={`rounded-2xl p-3 ${band.classes}`}><p className="text-2xl font-black">{band.count}</p><p className="mt-1 text-[11px] font-bold leading-tight">{band.label}</p></div>)}</div><p className="mt-3 text-sm leading-snug text-stone-600">Es una comparación con el promedio de esa jornada, no una clasificación permanente de la vaca.</p></Card>;
};

const MilkControlEntry = ({ animals, groups, selectedGroupId, onSelectGroup, values, onChangeValue, latestValues, controlDate, onChangeDate, notes, onChangeNotes, onSave, onClose, error }: {
  animals: Animal[];
  groups: HerdGroup[];
  selectedGroupId: string | undefined;
  onSelectGroup: (groupId: string) => void;
  values: Record<string, string>;
  onChangeValue: (animalId: string, value: string) => void;
  latestValues: Map<string, number>;
  controlDate: string;
  onChangeDate: (value: string) => void;
  notes: string;
  onChangeNotes: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
  error?: string;
}) => {
  const selectedAnimals = animals.filter((animal) => !selectedGroupId || animalGroupId(animal, groups) === selectedGroupId);
  const currentRecorded = selectedAnimals.filter((animal) => values[animal.id] !== undefined && values[animal.id] !== "").length;
  const totalRecorded = animals.filter((animal) => values[animal.id] !== undefined && values[animal.id] !== "").length;
  const selectedGroup = groups.find((group) => group.id === selectedGroupId);

  return <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-50" role="dialog" aria-modal="true" aria-label="Registrar control lechero"><div className="mx-auto min-h-screen max-w-2xl"><header className="sticky top-0 z-10 flex items-center gap-3 border-b border-stone-200 bg-stone-50 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6"><Button type="button" className="min-h-11 shrink-0 bg-white px-3 text-stone-800 ring-1 ring-stone-200" onClick={onClose} aria-label="Volver al resumen de control"><ArrowLeft size={20} aria-hidden="true" /></Button><div className="min-w-0"><h1 className="truncate text-xl font-black tracking-tight text-stone-950">Hacer control</h1><p className="text-sm font-medium text-stone-500">Anota solo las vacas que mediste.</p></div></header><div className="space-y-5 px-4 pb-32 pt-5 sm:px-6"><div className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3"><div className="flex min-w-0 items-center gap-2"><CalendarDays size={19} className="shrink-0 text-lime-800" aria-hidden="true" /><div><label htmlFor="control-date" className="block text-xs font-bold uppercase tracking-wide text-stone-500">Fecha</label><p className="text-sm font-semibold text-stone-700">Jornada del control</p></div></div><div className="w-36"><TextInput id="control-date" className="min-h-10 px-2 text-sm" type="date" value={controlDate} onChange={(event) => onChangeDate(event.target.value)} /></div></div><section><div className="flex items-end justify-between gap-3"><div><p className="text-sm font-bold uppercase tracking-wide text-stone-500">Grupo a controlar</p><h2 className="mt-1 text-xl font-black text-stone-950">{selectedGroup?.name ?? "Todas las vacas"}</h2></div><span className="rounded-full bg-lime-100 px-3 py-1.5 text-sm font-bold text-lime-950">{currentRecorded}/{selectedAnimals.length}</span></div>{groups.length > 1 ? <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{groups.map((group) => { const groupCount = animals.filter((animal) => animalGroupId(animal, groups) === group.id).length; return <button key={group.id} type="button" aria-pressed={selectedGroupId === group.id} className={`min-h-10 shrink-0 rounded-xl px-3 text-sm font-bold ${selectedGroupId === group.id ? "bg-lime-700 text-white" : "bg-white text-stone-700 ring-1 ring-stone-200"}`} onClick={() => onSelectGroup(group.id)}>{group.name} <span className="opacity-70">{groupCount}</span></button>; })}</div> : null}<div className="mt-4 h-2 overflow-hidden rounded-full bg-stone-200" aria-label={`${currentRecorded} de ${selectedAnimals.length} vacas anotadas`} role="progressbar" aria-valuemin={0} aria-valuemax={selectedAnimals.length} aria-valuenow={currentRecorded}><div className="h-full rounded-full bg-lime-700 transition-all" style={{ width: `${selectedAnimals.length ? (currentRecorded / selectedAnimals.length) * 100 : 0}%` }} /></div></section>{error ? <Notice tone="error">{error}</Notice> : null}{selectedAnimals.length === 0 ? <Notice tone="info">No hay vacas activas para controlar en este grupo.</Notice> : <section className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-[0_8px_28px_rgba(28,25,23,0.06)]">{selectedAnimals.map((animal, index) => { const previous = latestValues.get(animal.id); return <div key={animal.id} className={`grid min-h-20 grid-cols-[1fr_6.5rem] items-center gap-3 px-4 py-3 sm:px-5 ${index ? "border-t border-stone-100" : ""}`}><div className="min-w-0"><label className="block truncate text-lg font-black text-stone-950" htmlFor={`milk-${animal.id}`}>{animal.name}</label><p className="mt-0.5 text-xs font-medium text-stone-500">{previous === undefined ? "Sin control anterior" : `Último: ${formatLiters(previous)}`}</p></div><div className="relative"><TextInput id={`milk-${animal.id}`} className="min-h-12 pr-7 text-center text-lg font-black" aria-label={`Litros de ${animal.name}`} inputMode="decimal" min="0" step="0.1" type="number" value={values[animal.id] ?? ""} onChange={(event) => onChangeValue(animal.id, event.target.value)} placeholder="0.0" /><span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-500">L</span></div></div>; })}</section>}<details className="rounded-2xl border border-stone-200 bg-white px-4 py-3"><summary className="cursor-pointer text-sm font-bold text-stone-700">Agregar una nota</summary><div className="mt-4"><FieldLabel>Nota <span className="normal-case tracking-normal">(opcional)</span></FieldLabel><TextInput value={notes} onChange={(event) => onChangeNotes(event.target.value)} placeholder="Ejemplo: control de la mañana" /></div></details><p className="px-1 text-sm leading-snug text-stone-500">Este control no reemplaza la medida diaria del tanque.</p></div><footer className="sticky bottom-0 border-t border-stone-200 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:px-6"><Button type="button" disabled={!totalRecorded} className="w-full bg-lime-700 text-white shadow-[0_10px_22px_rgba(77,124,15,0.2)]" onClick={onSave}><Save size={20} aria-hidden="true" />Guardar {totalRecorded ? `${totalRecorded} ${totalRecorded === 1 ? "lectura" : "lecturas"}` : "control"}</Button></footer></div></div>;
};

export const MilkControlPage = ({ session, onBack }: { session: FarmSession; onBack: () => void }) => {
  const { date } = nowInFarmTimezone();
  const [controlDate, setControlDate] = useState(date);
  const [selectedGroupId, setSelectedGroupId] = useState<string>();
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  useEffect(() => { void ensureDefaultHerdGroups(db, session.farmId, session.userId); }, [session.farmId, session.userId]);
  const facts = useLiveQuery(async () => Promise.all([
    db.animals.filter((item) => item.farmId === session.farmId && !item.deletedAt && item.status === "active" && item.sex !== "male").sortBy("name"),
    db.herdGroups.filter((item) => item.farmId === session.farmId && !item.deletedAt).toArray(),
    db.milkControlSessions.filter((item) => item.farmId === session.farmId && !item.deletedAt).toArray(),
    db.milkControlRecords.filter((item) => item.farmId === session.farmId && !item.deletedAt).toArray()
  ]), [session.farmId], [[], [], [], []]);
  const [animals, herdGroups, sessions, records] = facts;
  const groups = useMemo(() => [...herdGroups].sort((left, right) => left.sortOrder - right.sortOrder), [herdGroups]);
  const defaultGroupId = preferredMilkingGroup(groups)?.id;
  const activeGroupId = groups.some((group) => group.id === selectedGroupId) ? selectedGroupId : defaultGroupId;
  const milk = useMemo(() => summarizeMilkControl(sessions, records), [records, sessions]);
  const latestValues = useMemo(() => new Map(records.filter((record) => record.sessionId === milk.session?.id).map((record) => [record.animalId, record.liters])), [milk.session?.id, records]);

  const save = async () => {
    setMessage(undefined);
    setError(undefined);
    try {
      await recordMilkControl(db, { farmId: session.farmId, userId: session.userId, date: controlDate, notes, readings: animals.filter((animal) => values[animal.id] !== undefined && values[animal.id] !== "").map((animal) => ({ animalId: animal.id, liters: Number(values[animal.id]) })) });
      setValues({});
      setNotes("");
      setIsCapturing(false);
      setMessage("El control lechero quedó guardado en el celular.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar el control.");
    }
  };

  return <div className="space-y-5"><header className="flex items-center gap-3 px-1"><Button type="button" className="min-h-11 shrink-0 bg-white px-3 text-stone-800 ring-1 ring-stone-200" onClick={onBack} aria-label="Volver"><ArrowLeft size={20} aria-hidden="true" /></Button><h1 className="text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">Control lechero</h1></header>{message ? <Notice tone="success">{message}</Notice> : null}<ControlSummary milk={milk} /><Button type="button" className="w-full bg-lime-700 text-white shadow-[0_12px_25px_rgba(77,124,15,0.2)] hover:bg-lime-800" onClick={() => { setError(undefined); setIsCapturing(true); }}><ClipboardPenLine size={20} aria-hidden="true" />{milk.session ? "Hacer control" : "Empezar control"}</Button><Distribution milk={milk} />{isCapturing ? <MilkControlEntry animals={animals} groups={groups} selectedGroupId={activeGroupId} onSelectGroup={setSelectedGroupId} values={values} onChangeValue={(animalId, value) => setValues((current) => ({ ...current, [animalId]: value }))} latestValues={latestValues} controlDate={controlDate} onChangeDate={setControlDate} notes={notes} onChangeNotes={setNotes} onSave={() => void save()} onClose={() => { setError(undefined); setIsCapturing(false); }} error={error} /> : null}</div>;
};
