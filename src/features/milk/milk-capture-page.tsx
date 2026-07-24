import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Button, Card, FieldLabel, Notice, TextInput } from "@/components/ui";
import { nowInFarmTimezone } from "@/domain/time";
import { interpolateTankLiters } from "@/domain/tank";
import type { FarmSession } from "@/domain/models";
import { db } from "@/db/rejo-db";
import {
  captureDailyTankMeasurement,
  DuplicateTankReadingError
} from "@/features/milk/daily-capture";
import { getMilkDashboard } from "@/features/milk/dashboard";

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
  const numericValue = Number(value);
  const interpolation =
    mode === "mark" && Number.isFinite(numericValue)
      ? interpolateTankLiters(numericValue, calibrationPoints)
      : null;
  const liters = mode === "liters" ? numericValue : interpolation?.liters;

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
      setMessage("Guardado en el celular.");
      setValue("");
      setCalvesLiters("");
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
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-black text-stone-950">Anotar la leche</h1>
        <p className="mt-1 text-lg text-stone-700">Solo toma unos segundos.</p>
      </div>

      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      <Card>
        <div className="mb-5 grid grid-cols-2 gap-3">
          <Button
            type="button"
            className={mode === "liters" ? "bg-lime-700 text-white" : "bg-stone-100 text-stone-800"}
            onClick={() => setMode("liters")}
          >
            Litros
          </Button>
          <Button
            type="button"
            disabled={calibrationPoints.length === 0}
            className={mode === "mark" ? "bg-lime-700 text-white" : "bg-stone-100 text-stone-800"}
            onClick={() => setMode("mark")}
          >
            Marca de regla
          </Button>
        </div>

        {calibrationPoints.length === 0 ? (
          <Notice tone="info">
            Puedes usar litros desde hoy. Carga la tabla de aforo en Ajustes para usar la regla.
          </Notice>
        ) : null}

        <div className="mt-5">
          <FieldLabel>{mode === "liters" ? "¿Cuántos litros?" : "¿Qué marca dio la regla?"}</FieldLabel>
          <TextInput
            autoFocus
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

        <div className="mt-5">
          <FieldLabel>¿Cuántos litros sacaste para terneros? (opcional)</FieldLabel>
          <TextInput
            inputMode="decimal"
            min="0"
            step="0.1"
            type="number"
            value={calvesLiters}
            onChange={(event) => setCalvesLiters(event.target.value)}
            placeholder="Ejemplo: 4"
          />
        </div>

        <div className="mt-5">
          <FieldLabel>Fecha</FieldLabel>
          <TextInput type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </div>

        <Button
          type="button"
          className="mt-6 w-full bg-lime-700 text-white hover:bg-lime-800"
          disabled={isSaving}
          onClick={() => void save()}
        >
          {isSaving ? "Guardando…" : "Guardar la medida"}
        </Button>
      </Card>
    </div>
  );
};
