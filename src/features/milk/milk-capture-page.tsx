import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Baby, CalendarDays, CirclePlus, Droplets, History, Pencil, Save, Truck } from "lucide-react";
import { Button, Card, FieldLabel, Notice, TextInput } from "@/components/ui";
import { nowInFarmTimezone } from "@/domain/time";
import type { FarmSession } from "@/domain/models";
import { db } from "@/db/rejo-db";
import {
  captureDailyTankMeasurement,
  DuplicateTankReadingError,
  recordBuyerTankReading
} from "@/features/milk/daily-capture";
import { getMilkDashboard } from "@/features/milk/dashboard";
import { computeMilkBalance } from "@/features/milk/balance";
import { buildMilkHistory, type MilkHistoryEntry } from "@/features/milk/milk-history";

interface MilkCapturePageProps {
  session: FarmSession;
  onSaved: () => void;
}

const formatHistoryDate = (date: string) => new Intl.DateTimeFormat("es-EC", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));

const MilkHistoryPage = ({ entries, today, onBack, onEdit }: { entries: MilkHistoryEntry[]; today: string; onBack: () => void; onEdit: (entry: MilkHistoryEntry) => void }) => (
  <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-50" role="dialog" aria-modal="true" aria-label="Historial de medidas de leche">
    <div className="mx-auto min-h-full max-w-2xl p-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))] sm:p-6">
      <header className="flex items-center gap-3 border-b border-stone-200 pb-4">
        <Button type="button" className="min-h-11 shrink-0 bg-white px-3 text-stone-800 ring-1 ring-stone-200" onClick={onBack} aria-label="Volver a registrar leche"><ArrowLeft size={20} aria-hidden="true" /></Button>
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-lime-800">Registro diario</p><h1 className="text-2xl font-black tracking-tight text-stone-950">Historial de medidas</h1></div>
      </header>

      <div className="mt-6 space-y-3">
        {entries.length === 0 ? <Notice tone="info">Aún no hay medidas del tanque guardadas.</Notice> : entries.map((entry) => <article key={entry.date} className="rounded-3xl border border-stone-200 bg-white p-4 shadow-[0_8px_28px_rgba(28,25,23,0.06)]">
          <div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><p className="font-black text-stone-950">{formatHistoryDate(entry.date)}</p>{entry.date === today ? <span className="rounded-full bg-lime-100 px-2.5 py-1 text-xs font-bold text-lime-950">Hoy</span> : null}</div><p className="mt-1 text-2xl font-black tracking-tight text-lime-900">{entry.liters.toFixed(1)} L</p></div><Button type="button" className="min-h-10 shrink-0 bg-stone-100 px-3 py-2 text-sm text-stone-800" aria-label={`Editar medida del ${entry.date}`} onClick={() => onEdit(entry)}><Pencil size={17} aria-hidden="true" />Editar</Button></div>
          {entry.buyerLiters !== undefined || entry.calvesLiters !== undefined ? <div className="mt-4 flex flex-wrap gap-2 border-t border-stone-100 pt-3 text-sm font-semibold text-stone-600">{entry.buyerLiters !== undefined ? <span className="rounded-lg bg-sky-50 px-2.5 py-1 text-sky-900">Tanquero: {entry.buyerLiters.toFixed(1)} L</span> : null}{entry.calvesLiters !== undefined ? <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-amber-950">Terneros: {entry.calvesLiters.toFixed(1)} L</span> : null}</div> : null}
        </article>)}
      </div>
    </div>
  </div>
);

export const MilkCapturePage = ({ session, onSaved }: MilkCapturePageProps) => {
  const { date: today } = nowInFarmTimezone();
  const [date, setDate] = useState(today);
  const [value, setValue] = useState("");
  const [calvesLiters, setCalvesLiters] = useState("");
  const [buyerLiters, setBuyerLiters] = useState("");
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MilkHistoryEntry>();
  const dashboard = useLiveQuery(
    () => getMilkDashboard(db, session.farmId, date),
    [session.farmId, date]
  );
  const dateReadings = useLiveQuery(
    () => db.tankReadings.filter((reading) => reading.farmId === session.farmId && reading.date === date && !reading.deletedAt).toArray(),
    [session.farmId, date],
    []
  );
  const dateCalfUsages = useLiveQuery(
    () => db.milkUsages.filter((usage) => usage.farmId === session.farmId && usage.date === date && usage.type === "calves" && !usage.deletedAt).toArray(),
    [session.farmId, date],
    []
  );
  const history = useLiveQuery(async () => {
    const [readings, usages] = await Promise.all([
      db.tankReadings.filter((reading) => reading.farmId === session.farmId && !reading.deletedAt).toArray(),
      db.milkUsages.filter((usage) => usage.farmId === session.farmId && !usage.deletedAt).toArray()
    ]);
    return buildMilkHistory(readings, usages);
  }, [session.farmId], []);
  const numericValue = Number(value);
  const liters = numericValue;
  const savedFarmLiters = dateReadings.find((reading) => reading.readBy === "farm" && reading.moment === "at_pickup")?.liters;
  const savedBuyerLiters = dateReadings.find((reading) => reading.readBy === "buyer" && reading.moment === "at_pickup")?.liters;
  const balance = computeMilkBalance(savedFarmLiters, savedBuyerLiters);

  const editEntry = (entry: MilkHistoryEntry) => {
    setDate(entry.date);
    setValue(String(entry.liters));
    setCalvesLiters(entry.calvesLiters === undefined ? "" : String(entry.calvesLiters));
    setBuyerLiters(entry.buyerLiters === undefined ? "" : String(entry.buyerLiters));
    setEditingEntry(entry);
    setError(undefined);
    setMessage(undefined);
    setIsHistoryOpen(false);
  };

  const save = async (duplicateStrategy: "reject" | "replace" = "reject") => {
    setError(undefined);
    setMessage(undefined);

    if (!Number.isFinite(liters) || liters < 0) {
      setError("Ingresa los litros.");
      return;
    }

    if (
      dashboard?.sevenDayAverage &&
      dashboard.sevenDayAverage > 0 &&
      Math.abs(liters - dashboard.sevenDayAverage) / dashboard.sevenDayAverage > 0.3 &&
      !window.confirm("Esta medida es muy distinta al promedio. ¿Quieres guardarla de todos modos?")
    ) {
      return;
    }

    setIsSaving(true);

    try {
      await captureDailyTankMeasurement(db, {
        farmId: session.farmId,
        userId: session.userId,
        date,
        liters,
        milkForCalvesLiters: calvesLiters ? Number(calvesLiters) : undefined,
        duplicateStrategy: editingEntry ? "replace" : duplicateStrategy,
        replaceMilkUsageIds: (editingEntry || duplicateStrategy === "replace") ? dateCalfUsages.map((usage) => usage.id) : undefined
      });
      if (buyerLiters) {
        await recordBuyerTankReading(db, { farmId: session.farmId, userId: session.userId, date, liters: Number(buyerLiters) });
      }
      setMessage(editingEntry ? "Medida actualizada en el celular." : "Guardado en el celular.");
      setValue("");
      setCalvesLiters("");
      setBuyerLiters("");
      setEditingEntry(undefined);
      onSaved();
    } catch (caught) {
      if (caught instanceof DuplicateTankReadingError) {
        const replace = window.confirm(
          "Ya hay una medida para ese día. ¿Quieres reemplazarla y conservar la anterior como corregida?"
        );

        if (replace) {
          await save("replace");
          return;
        }
      }

      setError(caught instanceof Error ? caught.message : "No se pudo guardar la medida.");
    } finally {
      setIsSaving(false);
    }
  };

  return <>
    <div className="space-y-5 pb-24">
      <header className="flex items-start justify-between gap-3 px-1"><div><p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-lime-800"><Droplets size={16} aria-hidden="true" />Medida del tanque</p><h1 className="mt-1 text-3xl font-black tracking-tight text-stone-950">Registrar leche</h1></div><Button type="button" className="min-h-11 shrink-0 rounded-xl bg-white px-3 py-2 text-sm text-stone-800 ring-1 ring-stone-200" onClick={() => setIsHistoryOpen(true)}><History size={18} aria-hidden="true" />Historial</Button></header>

      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      <Card>
          <section className="rounded-2xl border border-lime-200 bg-lime-50 p-3.5">
          <div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-lime-800 shadow-sm"><CalendarDays size={20} aria-hidden="true" /></span><label htmlFor="milk-measurement-date" className="block text-sm font-black text-lime-950">Fecha de medida</label></div>
          <TextInput id="milk-measurement-date" className="mt-3 min-h-12 min-w-0 bg-white px-3 text-base font-bold" type="date" value={date} disabled={Boolean(editingEntry)} onChange={(event) => setDate(event.target.value)} />
        </section>
        {editingEntry ? <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-sky-50 px-3 py-2.5 text-sm font-semibold text-sky-950"><span>Corrigiendo la medida del {formatHistoryDate(editingEntry.date)}.</span><button type="button" className="shrink-0 font-black underline" onClick={() => setEditingEntry(undefined)}>Cancelar</button></div> : null}
        <section className="mt-5"><label htmlFor="milk-measurement-value" className="px-1 text-xs font-bold uppercase tracking-[0.14em] text-stone-500">Litros entregados</label><div className="relative mt-2"><TextInput id="milk-measurement-value" autoFocus className="min-h-28 border-2 border-lime-300 bg-white px-5 pr-20 text-5xl font-black tracking-tight placeholder:text-stone-300 focus:border-lime-700 sm:text-6xl" inputMode="decimal" min="0" step="0.1" type="number" value={value} onChange={(event) => setValue(event.target.value)} placeholder="0.0" /><span className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-2xl font-black text-stone-500">L</span></div></section>

        <details className="mt-5 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3.5">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-black text-stone-700"><CirclePlus size={19} aria-hidden="true" />Agregar datos opcionales</summary>
          <div className="mt-4 space-y-4">
            <div>
              <FieldLabel><span className="inline-flex items-center gap-1.5"><Truck size={16} aria-hidden="true" />Litros que declaró el tanquero</span></FieldLabel>
              <TextInput inputMode="decimal" min="0" step="0.1" type="number" value={buyerLiters} onChange={(event) => setBuyerLiters(event.target.value)} placeholder="Ejemplo: 203" />
            </div>
            <div>
              <FieldLabel><span className="inline-flex items-center gap-1.5"><Baby size={16} aria-hidden="true" />Litros para terneros</span></FieldLabel>
              <TextInput inputMode="decimal" min="0" step="0.1" type="number" value={calvesLiters} onChange={(event) => setCalvesLiters(event.target.value)} placeholder="Ejemplo: 4" />
            </div>
          </div>
        </details>

        {balance.varianceLiters !== undefined ? <Notice tone={balance.needsReview ? "warning" : "success"}>Diferencia con el tanquero: {balance.varianceLiters.toFixed(1)} L ({balance.variancePercent?.toFixed(1)}%).</Notice> : null}

        <Button
          type="button"
          className="mt-6 w-full bg-lime-700 text-white shadow-lg shadow-lime-200 hover:bg-lime-800"
          disabled={isSaving}
          onClick={() => void save()}
        >
          <Save size={20} aria-hidden="true" />
          {isSaving ? "Guardando…" : editingEntry ? "Guardar cambios" : "Guardar la medida"}
        </Button>
      </Card>
    </div>
    {isHistoryOpen ? <MilkHistoryPage entries={history} today={today} onBack={() => setIsHistoryOpen(false)} onEdit={editEntry} /> : null}
  </>;
};
