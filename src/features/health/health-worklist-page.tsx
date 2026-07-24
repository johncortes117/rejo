import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Check, ChevronRight, Clock3, HeartPulse, ShieldPlus, Stethoscope } from "lucide-react";
import { Button, Card, Notice } from "@/components/ui";
import { db } from "@/db/rejo-db";
import type { Animal, FarmSession, HealthPlanTask } from "@/domain/models";
import { nowInFarmTimezone } from "@/domain/time";
import { AnimalDetail, AnimalEditor } from "@/features/animals/animals-page";
import { createDefaultPreventivePlan } from "@/features/health/default-plan";
import { computeMilkWithholdingUntil, isMilkWithheld } from "@/features/health/milk-withholding";
import { updateHealthPlanTask } from "@/features/health/plan-tasks";

interface HealthWorklistPageProps {
  session: FarmSession;
  onBack: () => void;
}

const taskLabel = (task: HealthPlanTask): string => ({
  brucellosis_vaccination: "Vacuna de brucelosis",
  deworming: "Curada",
  annual_brucellosis_test: "Prueba anual de brucelosis"
})[task.taskType];

const addDays = (date: string, days: number): string => {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};

export const HealthWorklistPage = ({ session, onBack }: HealthWorklistPageProps) => {
  const { date: today } = nowInFarmTimezone();
  const [selectedAnimal, setSelectedAnimal] = useState<Animal>();
  const [editedAnimal, setEditedAnimal] = useState<Animal>();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const animals = useLiveQuery(
    () => db.animals.filter((item) => item.farmId === session.farmId && !item.deletedAt && item.status === "active").sortBy("name"),
    [session.farmId],
    []
  );
  const groups = useLiveQuery(
    () => db.herdGroups.filter((item) => item.farmId === session.farmId && !item.deletedAt).sortBy("sortOrder"),
    [session.farmId],
    []
  );
  const healthEvents = useLiveQuery(
    () => db.healthEvents.filter((item) => item.farmId === session.farmId && !item.deletedAt).toArray(),
    [session.farmId],
    []
  );
  const tasks = useLiveQuery(
    () => db.healthPlanTasks.filter((item) => item.farmId === session.farmId && !item.deletedAt && !item.completedAt && !item.ignoredAt).sortBy("dueDate"),
    [session.farmId],
    []
  );
  const withheldAnimals = useMemo(() => animals.map((animal) => {
    const events = healthEvents.filter((event) => event.animalId === animal.id);
    return { animal, until: computeMilkWithholdingUntil(events), withheld: isMilkWithheld(events, new Date()) };
  }).filter((item) => item.withheld), [animals, healthEvents]);
  const recentHealthEvents = healthEvents.filter((event) => event.date >= addDays(today, -30)).length;

  const activatePlan = async () => {
    setMessage(undefined);
    setError(undefined);
    try {
      const created = await createDefaultPreventivePlan(db, { farmId: session.farmId, userId: session.userId, startDate: today });
      setMessage(created.length === 0 ? "El plan sanitario mínimo ya estaba activo." : "El plan sanitario mínimo quedó guardado en el celular.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo activar el plan sanitario.");
    }
  };

  const updateTask = async (task: HealthPlanTask, action: "complete" | "postpone" | "ignore") => {
    setMessage(undefined);
    setError(undefined);
    try {
      await updateHealthPlanTask(db, task, action);
      setMessage(action === "complete" ? "La tarea quedó completada y la siguiente fecha fue programada." : action === "postpone" ? "La tarea se pospuso siete días." : "La tarea quedó ignorada.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo actualizar la tarea.");
    }
  };

  const openEditor = (animal: Animal) => {
    setSelectedAnimal(undefined);
    setEditedAnimal(animal);
  };

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <Button type="button" className="shrink-0 bg-white px-4 text-stone-800 ring-1 ring-stone-200" onClick={onBack} aria-label="Volver al rejo">
          <ArrowLeft size={20} aria-hidden="true" />
        </Button>
        <div>
          <p className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-[0.16em] text-lime-800"><Stethoscope size={16} aria-hidden="true" />El rejo</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-stone-950">Sanidad</h1>
          <p className="mt-2 text-base text-stone-600">Revisa primero la leche en retiro y las tareas pendientes; el tratamiento de cada vaca sigue en su ficha.</p>
        </div>
      </header>

      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      <section className="grid grid-cols-3 gap-3" aria-label="Resumen sanitario">
        <Card><p className="text-sm font-bold uppercase tracking-wide text-stone-500">En retiro</p><p className="mt-1 text-3xl font-black text-stone-950">{withheldAnimals.length}</p></Card>
        <Card><p className="text-sm font-bold uppercase tracking-wide text-stone-500">Pendientes</p><p className="mt-1 text-3xl font-black text-stone-950">{tasks.length}</p></Card>
        <Card><p className="text-sm font-bold uppercase tracking-wide text-stone-500">Atenciones 30d</p><p className="mt-1 text-3xl font-black text-stone-950">{recentHealthEvents}</p></Card>
      </section>

      <section>
        <div className="px-1"><p className="text-sm font-bold uppercase tracking-wide text-stone-500">Leche en retiro</p><h2 className="mt-1 text-2xl font-black text-stone-950">No entregar</h2></div>
        <div className="mt-3 space-y-3">
          {withheldAnimals.length === 0 ? <Notice tone="success">No hay leche en retiro registrada ahora.</Notice> : withheldAnimals.map((item) => <button key={item.animal.id} type="button" className="flex min-h-24 w-full items-center gap-3 rounded-3xl border border-red-200 bg-red-50 p-4 text-left transition active:scale-[0.99]" onClick={() => setSelectedAnimal(item.animal)}><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-red-900 shadow-sm"><HeartPulse size={21} aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="block text-lg font-black text-stone-950">{item.animal.name}</span><span className="mt-1 block text-sm text-red-900">No entregar hasta {item.until ? new Date(item.until).toLocaleString("es-EC", { timeZone: "America/Guayaquil" }) : "nuevo aviso"}.</span></span><ChevronRight className="shrink-0 text-red-500" size={22} aria-hidden="true" /></button>)}</div>
      </section>

      <section>
        <div className="px-1"><p className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-stone-500"><ShieldPlus size={16} aria-hidden="true" />Plan sanitario</p><h2 className="mt-1 text-2xl font-black text-stone-950">Pendientes</h2></div>
        {tasks.length === 0 ? <Card><p className="text-lg font-black text-stone-950">Aún no hay tareas del plan.</p><p className="mt-1 text-base text-stone-600">Puedes activar la guía mínima para organizar curadas y la prueba anual de brucelosis.</p><Button type="button" className="mt-5 w-full bg-stone-900 text-white" onClick={() => void activatePlan()}><ShieldPlus size={20} aria-hidden="true" />Activar plan sanitario mínimo</Button></Card> : <div className="mt-3 space-y-3">{tasks.map((task) => <Card key={task.id}><div className="flex items-start justify-between gap-3"><div><p className="text-lg font-black text-stone-950">{taskLabel(task)}</p><p className="mt-1 text-base text-stone-600">Programada para {task.dueDate}{task.animalId ? ` · ${animals.find((animal) => animal.id === task.animalId)?.name ?? "animal"}` : ""}</p></div><Clock3 className="shrink-0 text-amber-700" size={22} aria-hidden="true" /></div><div className="mt-4 grid grid-cols-3 gap-2"><Button type="button" className="min-h-11 bg-lime-700 px-2 text-sm text-white" onClick={() => void updateTask(task, "complete")}><Check size={17} aria-hidden="true" />Hecha</Button><Button type="button" className="min-h-11 bg-stone-100 px-2 text-sm text-stone-800" onClick={() => void updateTask(task, "postpone")}><Clock3 size={17} aria-hidden="true" />+7 días</Button><Button type="button" className="min-h-11 bg-red-50 px-2 text-sm text-red-900" onClick={() => void updateTask(task, "ignore")}>Ignorar</Button></div></Card>)}</div>}
      </section>

      {selectedAnimal ? <AnimalDetail animal={selectedAnimal} groups={groups} session={session} initialSection="health" onClose={() => setSelectedAnimal(undefined)} onEdit={() => openEditor(selectedAnimal)} /> : null}
      {editedAnimal ? <AnimalEditor animal={editedAnimal} groups={groups} session={session} onClose={() => setEditedAnimal(undefined)} onSaved={(nextMessage) => { setEditedAnimal(undefined); setMessage(nextMessage); }} /> : null}
    </div>
  );
};
