import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Baby, CalendarDays, CirclePlus, Droplets, History, Pencil, Ruler, Save, Truck } from "lucide-react";
import { Button, Card, FieldLabel, Notice, TextInput } from "@/components/ui";
import { nowInFarmTimezone } from "@/domain/time";
import { interpolateTankLiters } from "@/domain/tank";
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
          {entry.mark !== undefined || entry.buyerLiters !== undefined || entry.calvesLiters !== undefined ? <div className="mt-4 flex flex-wrap gap-2 border-t border-stone-100 pt-3 text-sm font-semibold text-stone-600">{entry.mark !== undefined ? <span className="rounded-lg bg-stone-100 px-2.5 py-1">Regla: {entry.mark}</span> : null}{entry.buyerLiters !== undefined ? <span className="rounded-lg bg-sky-50 px-2.5 py-1 text-sky-900">Tanquero: {entry.buyerLiters.toFixed(1)} L</span> : null}{entry.calvesLiters !== undefined ? <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-amber-950">Terneros: {entry.calvesLiters.toFixed(1)} L</span> : null}</div> : null}
        </article>)}
      </div>
    </div>
  </div>
);

export const MilkCapturePage = ({ session, onSaved }: MilkCapturePageProps) => {
  const { date: today } = nowInFarmTimezone();
  const [date, setDate] = useState(today);
  const [mode, setMode] = useState<"liters" | "mark">("liters");
  const [value, setValue] = useState("");
  const [calvesLiters, setCalvesLiters] = useState("");
  const [buyerLiters, setBuyerLiters] = useState("");
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MilkHistoryEntry>();
  const calibrationPoints = useLiveQuery(
    () =>
      db.tankCalibrations
        .filter((point) => point.farmId === session.farmId && !point.deletedAt)
        .toArray(),
    [session.farmId],
    []
  );
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
  const interpolation =
    mode === "mark" && Number.isFinite(numericValue)
      ? interpolateTankLiters(numericValue, calibrationPoints)
      : null;
  const liters = mode === "liters" ? numericValue : interpolation?.liters;
  const savedFarmLiters = dateReadings.find((reading) => reading.readBy === "farm" && reading.moment === "at_pickup")?.liters;
  const savedBuyerLiters = dateReadings.find((reading) => reading.readBy === "buyer" && reading.moment === "at_pickup")?.liters;
  const balance = computeMilkBalance(savedFarmLiters, savedBuyerLiters);

  const editEntry = (entry: MilkHistoryEntry) => {
    setDate(entry.date);
    setMode(entry.mark === undefined ? "liters" : "mark");
    setValue(String(entry.mark ?? entry.liters));
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

    if (!Number.isFinite(liters) || liters === undefined || liters < 0) {
      setError(mode === "mark" ? "Ingresa una marca que se pueda convertir." : "Ingresa los litros.");
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
        mark: mode === "mark" ? numericValue : undefined,
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
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 px-1"><div><p className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-[0.16em] text-lime-800"><Droplets size={16} aria-hidden="true" />Registro diario</p><h1 className="mt-1 text-3xl font-black tracking-tight text-stone-950">Anotar la leche</h1></div><Button type="button" className="min-h-11 shrink-0 bg-white px-3 py-2 text-sm text-stone-800 ring-1 ring-stone-200" onClick={() => setIsHistoryOpen(true)}><History size={18} aria-hidden="true" />Historial</Button></header>

      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      <Card>
        <div className="flex items-center gap-3 rounded-2xl border border-lime-200 bg-lime-50 p-3"><CalendarDays className="shrink-0 text-lime-800" size={20} aria-hidden="true" /><div className="min-w-0 flex-1"><label htmlFor="milk-measurement-date" className="block text-sm font-black text-lime-950">Fecha de la medida</label><p className="mt-0.5 text-xs font-semibold text-lime-800">{date === today ? "Hoy" : "Fecha elegida"}</p></div><TextInput id="milk-measurement-date" className="min-h-10 w-36 shrink-0 bg-white px-2 text-sm font-bold" type="date" value={date} disabled={Boolean(editingEntry)} onChange={(event) => setDate(event.target.value)} /></div>
        {editingEntry ? <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-950"><span>Corrigiendo la medida del {formatHistoryDate(editingEntry.date)}.</span><button type="button" className="shrink-0 font-black underline" onClick={() => setEditingEntry(undefined)}>Cancelar</button></div> : null}
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-stone-100 p-1.5">
          <Button
            type="button"
            className={mode === "liters" ? "bg-lime-700 text-white shadow-sm" : "text-stone-600"}
            onClick={() => setMode("liters")}
          >
            <Droplets size={19} aria-hidden="true" />
            Litros
          </Button>
          <Button
            type="button"
            disabled={calibrationPoints.length === 0}
            className={mode === "mark" ? "bg-lime-700 text-white shadow-sm" : "text-stone-600"}
            onClick={() => setMode("mark")}
          >
            <Ruler size={19} aria-hidden="true" />
            Marca de regla
          </Button>
        </div>

        {calibrationPoints.length === 0 ? <p className="mt-4 text-sm font-medium text-stone-500">La regla se habilita cuando cargues la tabla de aforo.</p> : null}

        <div className="mt-6">
          <FieldLabel>{mode === "liters" ? "¿Cuántos litros?" : "¿Qué marca dio la regla?"}</FieldLabel>
          <TextInput
            autoFocus
            className="min-h-20 text-3xl font-black"
            inputMode="decimal"
            min="0"
            step="0.1"
            type="number"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={mode === "liters" ? "Ejemplo: 205" : "Ejemplo: 34.5"}
          />
        </div>

        {mode === "mark" && interpolation ? (
          <Notice tone={interpolation.extrapolated ? "warning" : "success"}>
            La marca equivale a <strong>{interpolation.liters.toFixed(1)} litros</strong>.
            {interpolation.extrapolated
              ? " Está por encima de tu tabla; confirma que la marca es correcta."
              : ""}
          </Notice>
        ) : null}

        <details className="mt-6 rounded-2xl bg-stone-50 p-4">
          <summary className="flex cursor-pointer items-center gap-2 text-base font-bold text-stone-700"><CirclePlus size={19} aria-hidden="true" />Agregar datos opcionales</summary>
          <div className="mt-5 space-y-5">
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
