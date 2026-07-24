import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Button, Card, FieldLabel, Notice, TextInput } from "@/components/ui";
import type { Buyer, Farm, FarmSession } from "@/domain/models";
import type { CalibrationPoint } from "@/domain/tank";
import { db } from "@/db/rejo-db";
import { saveFarmSettings } from "@/features/settings/settings";
import { nowInFarmTimezone } from "@/domain/time";
import { createDefaultPreventivePlan } from "@/features/health/default-plan";

interface SettingsPageProps {
  session: FarmSession;
}

interface SettingsForm {
  farmName: string;
  ownerName: string;
  buyerName: string;
  calibration: CalibrationPoint[];
}

const toSettingsForm = (farm: Farm, buyer: Buyer, calibration: CalibrationPoint[]): SettingsForm => ({
  farmName: farm.name,
  ownerName: farm.ownerName ?? "",
  buyerName: buyer.name,
  calibration
});

export const SettingsPage = ({ session }: SettingsPageProps) => {
  const { date: today } = nowInFarmTimezone();
  const farm = useLiveQuery(() => db.farms.get(session.farmId), [session.farmId]);
  const buyer = useLiveQuery(
    () => db.buyers.filter((item) => item.farmId === session.farmId && !item.deletedAt).first(),
    [session.farmId]
  );
  const calibration = useLiveQuery(
    async () => {
      const points = await db.tankCalibrations
        .filter((point) => point.farmId === session.farmId && !point.deletedAt)
        .toArray();
      return points
        .sort((left, right) => left.mark - right.mark)
        .map((point) => ({ mark: point.mark, liters: point.liters }));
    },
    [session.farmId],
    []
  );
  const preventiveTasks = useLiveQuery(
    () => db.healthPlanTasks.filter((task) => task.farmId === session.farmId && task.isTemplate && !task.deletedAt).sortBy("dueDate"),
    [session.farmId],
    []
  );
  const [form, setForm] = useState<SettingsForm>();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (farm && buyer && form === undefined) {
      setForm(toSettingsForm(farm, buyer, calibration));
    }
  }, [buyer, calibration, farm, form]);

  if (!farm || !buyer || !form) {
    return <Notice tone="info">Cargando los ajustes…</Notice>;
  }

  const updateCalibration = (index: number, update: Partial<CalibrationPoint>) =>
    setForm((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        calibration: current.calibration.map((point, pointIndex) =>
          pointIndex === index ? { ...point, ...update } : point
        )
      };
    });

  const save = async () => {
    setMessage(undefined);
    setError(undefined);

    try {
      await saveFarmSettings(db, {
        farm: { ...farm, name: form.farmName.trim(), ownerName: form.ownerName.trim() || undefined },
        buyer: { ...buyer, name: form.buyerName.trim() || "Alpina" },
        calibrationPoints: form.calibration.filter(
          (point) => Number.isFinite(point.mark) && Number.isFinite(point.liters)
        ),
        userId: session.userId
      });
      setMessage("Los ajustes quedaron guardados en el celular.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron guardar los ajustes.");
    }
  };

  const activatePreventivePlan = async () => {
    setMessage(undefined);
    setError(undefined);
    try {
      const tasks = await createDefaultPreventivePlan(db, { farmId: session.farmId, userId: session.userId, startDate: today });
      setMessage(tasks.length === 0 ? "El plan sanitario mínimo ya estaba activo." : "El plan sanitario mínimo quedó guardado en el celular.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo activar el plan sanitario.");
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-black text-stone-950">Ajustes</h1>
        <p className="mt-1 text-lg text-stone-700">Solo cambia lo que ya conoces.</p>
      </div>

      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      <Card>
        <h2 className="text-2xl font-black">La finca</h2>
        <div className="mt-5">
          <FieldLabel>Nombre de la finca</FieldLabel>
          <TextInput
            value={form.farmName}
            onChange={(event) => setForm({ ...form, farmName: event.target.value })}
          />
        </div>
        <div className="mt-5">
          <FieldLabel>Nombre de quien la maneja (opcional)</FieldLabel>
          <TextInput
            value={form.ownerName}
            onChange={(event) => setForm({ ...form, ownerName: event.target.value })}
          />
        </div>
      </Card>

      <Card>
        <h2 className="text-2xl font-black">Quien compra la leche</h2>
        <div className="mt-5">
          <FieldLabel>Nombre</FieldLabel>
          <TextInput
            value={form.buyerName}
            onChange={(event) => setForm({ ...form, buyerName: event.target.value })}
          />
        </div>
      </Card>

      <Card>
        <h2 className="text-2xl font-black">Tabla de aforo del tanque</h2>
        <p className="mt-1 text-lg text-stone-700">
          Si todavía no tienes la tabla, no pasa nada: sigue anotando en litros.
        </p>
        <Notice tone="info">
          Para medir con regla: tanque nivelado, sin espuma y con el agitador apagado un minuto antes.
        </Notice>

        <div className="mt-5 space-y-3">
          {form.calibration.map((point, index) => (
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2" key={index}>
              <TextInput
                inputMode="decimal"
                min="0"
                step="0.1"
                type="number"
                value={point.mark}
                onChange={(event) => updateCalibration(index, { mark: Number(event.target.value) })}
                aria-label="Marca de regla"
              />
              <TextInput
                inputMode="decimal"
                min="0"
                step="0.1"
                type="number"
                value={point.liters}
                onChange={(event) => updateCalibration(index, { liters: Number(event.target.value) })}
                aria-label="Litros"
              />
              <Button
                type="button"
                className="bg-red-50 px-3 text-red-900"
                onClick={() =>
                  setForm({ ...form, calibration: form.calibration.filter((_, pointIndex) => pointIndex !== index) })
                }
              >
                Quitar
              </Button>
            </div>
          ))}
        </div>

        <Button
          type="button"
          className="mt-4 w-full bg-stone-100 text-stone-800"
          onClick={() => setForm({ ...form, calibration: [...form.calibration, { mark: 0, liters: 0 }] })}
        >
          Agregar una marca
        </Button>
      </Card>

      <Card>
        <h2 className="text-2xl font-black">Plan sanitario mínimo</h2>
        <p className="mt-1 text-lg text-stone-700">Incluye curada periódica y prueba anual de brucelosis. Puedes usarlo como guía, no es obligatorio.</p>
        {preventiveTasks.length === 0 ? (
          <Button type="button" className="mt-5 w-full bg-stone-100 text-stone-800" onClick={() => void activatePreventivePlan()}>
            Activar plan sanitario mínimo
          </Button>
        ) : (
          <div className="mt-5 space-y-3">
            {preventiveTasks.map((task) => (
              <div className="rounded-lg bg-amber-50 p-4" key={task.id}>
                <p className="text-lg font-bold">{task.taskType === "deworming" ? "Curada" : "Prueba anual de brucelosis"}</p>
                <p className="text-lg text-stone-700">Próxima fecha: {task.dueDate}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Button type="button" className="w-full bg-lime-700 text-white hover:bg-lime-800" onClick={() => void save()}>
        Guardar ajustes
      </Button>
    </div>
  );
};
