import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Baby, CalendarDays, CirclePlus, Droplets, Ruler, Save, Truck } from "lucide-react";
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

interface MilkCapturePageProps {
  session: FarmSession;
  onSaved: () => void;
}

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
  const numericValue = Number(value);
  const interpolation =
    mode === "mark" && Number.isFinite(numericValue)
      ? interpolateTankLiters(numericValue, calibrationPoints)
      : null;
  const liters = mode === "liters" ? numericValue : interpolation?.liters;
  const savedFarmLiters = dateReadings.find((reading) => reading.readBy === "farm" && reading.moment === "at_pickup")?.liters;
  const savedBuyerLiters = dateReadings.find((reading) => reading.readBy === "buyer" && reading.moment === "at_pickup")?.liters;
  const balance = computeMilkBalance(savedFarmLiters, savedBuyerLiters);

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
        duplicateStrategy
      });
      if (buyerLiters) {
        await recordBuyerTankReading(db, { farmId: session.farmId, userId: session.userId, date, liters: Number(buyerLiters) });
      }
      setMessage("Guardado en el celular.");
      setValue("");
      setCalvesLiters("");
      setBuyerLiters("");
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

  return (
    <div className="space-y-6">
      <div className="px-1">
        <p className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-[0.16em] text-lime-800"><Droplets size={16} aria-hidden="true" />Registro diario</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-stone-950">Anotar la leche</h1>
      </div>

      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      <Card>
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
            <div>
              <FieldLabel><span className="inline-flex items-center gap-1.5"><CalendarDays size={16} aria-hidden="true" />Fecha</span></FieldLabel>
              <TextInput type="date" value={date} onChange={(event) => setDate(event.target.value)} />
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
          {isSaving ? "Guardando…" : "Guardar la medida"}
        </Button>
      </Card>
    </div>
  );
};
