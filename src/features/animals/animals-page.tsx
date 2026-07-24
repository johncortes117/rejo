import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Archive, ArrowDown, ArrowUp, Beef, Check, CirclePlus, ClipboardPenLine, Clock3, FolderOpen, HeartPulse, Pencil, Save, ShieldPlus, SlidersHorizontal, Stethoscope, Syringe, X } from "lucide-react";
import { Button, Card, FieldLabel, Notice, TextInput } from "@/components/ui";
import type { Animal, AnimalSex, FarmSession, HerdGroup } from "@/domain/models";
import { db } from "@/db/rejo-db";
import { nowInFarmTimezone } from "@/domain/time";
import { archiveAnimal, saveAnimal } from "@/features/animals/animals";
import { createHerdGroup, ensureDefaultHerdGroups, renameHerdGroup, reorderHerdGroup } from "@/features/animals/herd-groups";
import { recordCalving, recordDryOff, recordHeat, recordPregnancyCheck, recordService } from "@/features/reproduction/events";
import { computeReproductiveState } from "@/features/reproduction/reproductive-state";
import { recordHealthEvent } from "@/features/health/events";
import { computeMilkWithholdingUntil, isMilkWithheld } from "@/features/health/milk-withholding";
import { updateHealthPlanTask } from "@/features/health/plan-tasks";

interface AnimalsPageProps {
  session: FarmSession;
  onMilkControl?: () => void;
}

interface AnimalFormState {
  id?: string;
  name: string;
  sex: "" | AnimalSex;
  approximateAgeMonths: string;
  herdGroupId?: string;
}

type DetailSection = "general" | "reproduction" | "health";

const emptyForm: AnimalFormState = { name: "", sex: "", approximateAgeMonths: "" };

const toFormState = (animal: Animal): AnimalFormState => ({
  id: animal.id,
  name: animal.name,
  sex: animal.sex ?? "",
  approximateAgeMonths: "",
  herdGroupId: animal.herdGroupId
});

const reproductiveLabel = (status: ReturnType<typeof computeReproductiveState>["status"]): string => ({
  open: "Vacía",
  in_heat: "En celo",
  served: "Servida",
  pregnant_presumed: "Parece preñada",
  pregnant_confirmed: "Preñez confirmada",
  fresh: "Recién parida",
  not_applicable: "No aplica"
})[status];

const screenShell = "fixed inset-0 z-50 overflow-y-auto bg-stone-100";

const FullScreenHeader = ({
  eyebrow,
  title,
  onClose
}: {
  eyebrow: string;
  title: string;
  onClose: () => void;
}) => (
  <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-stone-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
    <Button type="button" className="shrink-0 bg-stone-100 px-4 text-stone-800" onClick={onClose} aria-label="Cerrar ficha">
      <X size={19} aria-hidden="true" />
      Cerrar
    </Button>
    <div className="min-w-0">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-lime-800">{eyebrow}</p>
      <h1 className="truncate text-xl font-black text-stone-950 sm:text-2xl">{title}</h1>
    </div>
  </header>
);

const HealthPanel = ({ animal, session }: { animal: Animal; session: FarmSession }) => {
  const { date: today } = nowInFarmTimezone();
  const [date, setDate] = useState(today);
  const [type, setType] = useState<"mastitis" | "deworming" | "vaccination" | "other">("mastitis");
  const [productName, setProductName] = useState("");
  const [withdrawalHours, setWithdrawalHours] = useState("");
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const events = useLiveQuery(
    () => db.healthEvents.filter((item) => item.animalId === animal.id && !item.deletedAt).toArray(),
    [animal.id],
    []
  );
  const tasks = useLiveQuery(
    () => db.healthPlanTasks.filter((item) => item.animalId === animal.id && !item.deletedAt && !item.completedAt && !item.ignoredAt).sortBy("dueDate"),
    [animal.id],
    []
  );
  const withholdingUntil = computeMilkWithholdingUntil(events);
  const milkWithheld = isMilkWithheld(events, new Date());

  const save = async () => {
    setMessage(undefined);
    setError(undefined);
    const hours = withdrawalHours === "" ? undefined : Number(withdrawalHours);
    if (hours !== undefined && (!Number.isFinite(hours) || hours < 0)) {
      setError("Escribe horas de retiro válidas.");
      return;
    }
    try {
      await recordHealthEvent(db, {
        farmId: session.farmId,
        animalId: animal.id,
        userId: session.userId,
        date,
        type,
        productName,
        milkWithdrawalHours: hours
      });
      setMessage("El evento sanitario quedó guardado en el celular.");
      setProductName("");
      setWithdrawalHours("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar el evento sanitario.");
    }
  };

  const updateTask = async (task: typeof tasks[number], action: "complete" | "postpone" | "ignore") => {
    setMessage(undefined);
    setError(undefined);
    try {
      await updateHealthPlanTask(db, task, action);
      setMessage(action === "complete" ? "La tarea quedó completada." : action === "postpone" ? "La tarea se pospuso siete días." : "La tarea quedó ignorada.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo actualizar la tarea.");
    }
  };

  return (
    <div className="space-y-5">
      {milkWithheld ? <Notice tone="error">No se puede entregar su leche hasta {new Date(withholdingUntil!).toLocaleString("es-EC", { timeZone: "America/Guayaquil" })}.</Notice> : null}
      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      <Card>
        <p className="text-sm font-bold uppercase tracking-wide text-stone-500">Nuevo registro</p>
        <h2 className="mt-1 flex items-center gap-2 text-2xl font-black text-stone-950"><Stethoscope size={24} aria-hidden="true" />¿Qué atención recibió?</h2>
        <div className="mt-5">
          <FieldLabel>Evento</FieldLabel>
          <select className="min-h-12 w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 text-lg text-stone-950 outline-none focus:border-lime-700 focus:bg-white focus:ring-4 focus:ring-lime-100" value={type} onChange={(event) => setType(event.target.value as typeof type)}>
            <option value="mastitis">Mastitis</option>
            <option value="deworming">Curada</option>
            <option value="vaccination">Vacuna</option>
            <option value="other">Otro</option>
          </select>
        </div>
        <div className="mt-5">
          <FieldLabel>Producto aplicado <span className="normal-case tracking-normal">(opcional)</span></FieldLabel>
          <TextInput value={productName} onChange={(event) => setProductName(event.target.value)} placeholder="Ejemplo: medicamento aplicado" />
        </div>
        <div className="mt-5">
          <FieldLabel>Horas sin entregar leche <span className="normal-case tracking-normal">(opcional)</span></FieldLabel>
          <TextInput inputMode="numeric" min="0" type="number" value={withdrawalHours} onChange={(event) => setWithdrawalHours(event.target.value)} placeholder="Ejemplo: 96" />
        </div>
        <div className="mt-5">
          <FieldLabel>Fecha</FieldLabel>
          <TextInput type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </div>
        <Button type="button" className="mt-6 w-full bg-red-800 text-white hover:bg-red-900" onClick={() => void save()}>
          <Syringe size={20} aria-hidden="true" />
          Guardar atención sanitaria
        </Button>
      </Card>

      {tasks.length > 0 ? (
        <section>
          <p className="flex items-center gap-1.5 px-1 text-sm font-bold uppercase tracking-wide text-stone-500"><ShieldPlus size={16} aria-hidden="true" />Plan sanitario</p>
          <h2 className="mt-1 px-1 text-2xl font-black text-stone-950">Pendientes</h2>
          <div className="mt-3 space-y-3">
            {tasks.map((task) => (
              <Card key={task.id}>
                <p className="text-xl font-black text-stone-950">{task.taskType === "brucellosis_vaccination" ? "Vacuna de brucelosis" : task.taskType === "deworming" ? "Curada" : "Prueba anual de brucelosis"}</p>
                <p className="mt-1 text-base text-stone-600">Programada para {task.dueDate}</p>
                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Button type="button" className="bg-lime-700 text-white" onClick={() => void updateTask(task, "complete")}><Check size={19} aria-hidden="true" />Marcar hecha</Button>
                  <Button type="button" className="bg-stone-100 text-stone-800" onClick={() => void updateTask(task, "postpone")}><Clock3 size={19} aria-hidden="true" />Posponer 7 días</Button>
                  <Button type="button" className="bg-red-50 text-red-900" onClick={() => void updateTask(task, "ignore")}><Archive size={19} aria-hidden="true" />Ignorar</Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
};

const ReproductionPanel = ({ animal, session }: { animal: Animal; session: FarmSession }) => {
  const { date: today } = nowInFarmTimezone();
  const [eventType, setEventType] = useState<"heat" | "service" | "check" | "calving" | "dry-off">("heat");
  const [date, setDate] = useState(today);
  const [serviceType, setServiceType] = useState<"natural" | "ai">("natural");
  const [checkResult, setCheckResult] = useState<"pregnant" | "open" | "doubtful">("pregnant");
  const [calfName, setCalfName] = useState("");
  const [calfSex, setCalfSex] = useState<"female" | "male">("female");
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const facts = useLiveQuery(
    async () => Promise.all([
      db.heats.filter((item) => item.animalId === animal.id && !item.deletedAt).toArray(),
      db.services.filter((item) => item.animalId === animal.id && !item.deletedAt).toArray(),
      db.pregnancyChecks.filter((item) => item.animalId === animal.id && !item.deletedAt).toArray(),
      db.calvings.filter((item) => item.animalId === animal.id && !item.deletedAt).toArray()
    ]),
    [animal.id],
    [[], [], [], []]
  );
  const [heats, services, pregnancyChecks, calvings] = facts;
  const state = computeReproductiveState({ asOf: today, sex: animal.sex, heats, services, pregnancyChecks, calvings });

  const save = async () => {
    setError(undefined);
    setMessage(undefined);
    const input = { farmId: session.farmId, animalId: animal.id, userId: session.userId, date };
    try {
      if (eventType === "heat") {
        await recordHeat(db, input);
        setMessage("El celo quedó guardado en el celular.");
      } else if (eventType === "service") {
        await recordService(db, { ...input, type: serviceType });
        setMessage("El servicio quedó guardado en el celular.");
      } else if (eventType === "check") {
        await recordPregnancyCheck(db, { ...input, result: checkResult });
        setMessage("La palpación quedó guardada en el celular.");
      } else if (eventType === "calving") {
        await recordCalving(db, { ...input, calfName, calfSex });
        setMessage("El parto y la cría quedaron guardados en el celular.");
        setCalfName("");
      } else {
        await recordDryOff(db, input);
        setMessage("El secado quedó guardado en el celular.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar el evento.");
    }
  };

  const eventOptions: Array<{ value: typeof eventType; label: string }> = [
    { value: "heat", label: "Celo" }, { value: "service", label: "Servicio" }, { value: "check", label: "Palpar" }, { value: "calving", label: "Parto" }, { value: "dry-off", label: "Secar" }
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-lime-800 p-5 text-white shadow-[0_16px_35px_rgba(77,124,15,0.2)] sm:p-6">
        <p className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-[0.14em] text-lime-100"><HeartPulse size={16} aria-hidden="true" />Estado reproductivo</p>
        <p className="mt-2 text-3xl font-black">{reproductiveLabel(state.status)}</p>
        {state.expectedCalvingDate ? <p className="mt-2 text-base font-semibold text-lime-100">Parto estimado: {state.expectedCalvingDate}</p> : null}
      </section>
      {state.isRepeatBreeder ? <Notice tone="warning">Vaca repetidora: conviene consultar la prueba de brucelosis.</Notice> : null}
      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      <Card>
        <p className="text-sm font-bold uppercase tracking-wide text-stone-500">Registro rápido</p>
        <h2 className="mt-1 flex items-center gap-2 text-2xl font-black text-stone-950"><ClipboardPenLine size={24} aria-hidden="true" />¿Qué ocurrió?</h2>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {eventOptions.map((option) => <Button key={option.value} type="button" aria-pressed={eventType === option.value} className={eventType === option.value ? "bg-lime-700 text-white" : "bg-stone-100 text-stone-800"} onClick={() => setEventType(option.value)}>{option.label}</Button>)}
        </div>

        <div className="mt-5">
          <FieldLabel>Fecha</FieldLabel>
          <TextInput type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </div>
        {eventType === "service" ? <div className="mt-5"><FieldLabel>Tipo de servicio</FieldLabel><div className="grid grid-cols-2 gap-3"><Button type="button" aria-pressed={serviceType === "natural"} className={serviceType === "natural" ? "bg-lime-700 text-white" : "bg-stone-100 text-stone-800"} onClick={() => setServiceType("natural")}>Natural</Button><Button type="button" aria-pressed={serviceType === "ai"} className={serviceType === "ai" ? "bg-lime-700 text-white" : "bg-stone-100 text-stone-800"} onClick={() => setServiceType("ai")}>Inseminación</Button></div></div> : null}
        {eventType === "check" ? <div className="mt-5"><FieldLabel>Resultado de la palpación</FieldLabel><div className="grid grid-cols-1 gap-2 sm:grid-cols-3"><Button type="button" aria-pressed={checkResult === "pregnant"} className={checkResult === "pregnant" ? "bg-lime-700 text-white" : "bg-stone-100 text-stone-800"} onClick={() => setCheckResult("pregnant")}>Preñada</Button><Button type="button" aria-pressed={checkResult === "open"} className={checkResult === "open" ? "bg-lime-700 text-white" : "bg-stone-100 text-stone-800"} onClick={() => setCheckResult("open")}>Vacía</Button><Button type="button" aria-pressed={checkResult === "doubtful"} className={checkResult === "doubtful" ? "bg-lime-700 text-white" : "bg-stone-100 text-stone-800"} onClick={() => setCheckResult("doubtful")}>Dudosa</Button></div></div> : null}
        {eventType === "calving" ? <div className="mt-5 space-y-5"><div><FieldLabel>Nombre de la cría</FieldLabel><TextInput value={calfName} onChange={(event) => setCalfName(event.target.value)} placeholder="Ejemplo: Lucera" /></div><div><FieldLabel>Sexo de la cría</FieldLabel><div className="grid grid-cols-2 gap-3"><Button type="button" aria-pressed={calfSex === "female"} className={calfSex === "female" ? "bg-lime-700 text-white" : "bg-stone-100 text-stone-800"} onClick={() => setCalfSex("female")}>Hembra</Button><Button type="button" aria-pressed={calfSex === "male"} className={calfSex === "male" ? "bg-lime-700 text-white" : "bg-stone-100 text-stone-800"} onClick={() => setCalfSex("male")}>Macho</Button></div></div>{calfSex === "female" ? <Notice tone="info">REJO programará su vacuna de brucelosis para dentro de tres meses.</Notice> : null}</div> : null}
        <Button type="button" className="mt-6 w-full bg-lime-700 text-white hover:bg-lime-800" onClick={() => void save()}><Save size={20} aria-hidden="true" />Guardar evento</Button>
      </Card>
    </div>
  );
};

export const AnimalEditor = ({ animal, groups, defaultGroupId, session, onClose, onSaved }: { animal?: Animal; groups: HerdGroup[]; defaultGroupId?: string; session: FarmSession; onClose: () => void; onSaved: (message: string) => void }) => {
  const [form, setForm] = useState<AnimalFormState>({ ...(animal ? toFormState(animal) : emptyForm), herdGroupId: animal?.herdGroupId ?? defaultGroupId });
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string>();
  const isEditing = Boolean(animal);
  const updateForm = (update: Partial<AnimalFormState>) => setForm((current) => ({ ...current, ...update }));
  const save = async () => {
    setError(undefined);
    try {
      await saveAnimal(db, { farmId: session.farmId, userId: session.userId, id: form.id, name: form.name, sex: form.sex || undefined, approximateAgeMonths: form.approximateAgeMonths ? Number(form.approximateAgeMonths) : undefined, herdGroupId: form.herdGroupId });
      onSaved(isEditing ? "La información quedó corregida." : "La vaca quedó guardada.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar la vaca.");
    }
  };

  return <div className={screenShell} role="dialog" aria-modal="true" aria-label={isEditing ? "Corregir vaca" : "Registrar una vaca"}>
    <FullScreenHeader eyebrow={isEditing ? "Editar ficha" : `Registrar vaca · paso ${step} de 2`} title={isEditing ? animal!.name : step === 1 ? "¿Cómo la conoces?" : "Un poco más de información"} onClose={onClose} />
    <main className="mx-auto max-w-2xl p-4 pb-10 pt-6 sm:p-6">
      {error ? <div className="mb-5"><Notice tone="error">{error}</Notice></div> : null}
      <Card>
        {step === 1 ? <><p className="text-base text-stone-600">Empieza con lo esencial. Podrás completar o corregir el resto cuando quieras.</p><div className="mt-6"><FieldLabel>Nombre o apodo</FieldLabel><TextInput autoFocus value={form.name} onChange={(event) => updateForm({ name: event.target.value })} placeholder="Ejemplo: Pintada" /></div><div className="mt-6"><FieldLabel>Sexo <span className="normal-case tracking-normal">(opcional)</span></FieldLabel><div className="grid grid-cols-2 gap-3"><Button type="button" aria-pressed={form.sex === "female"} className={form.sex === "female" ? "bg-lime-700 text-white" : "bg-stone-100 text-stone-800"} onClick={() => updateForm({ sex: "female" })}>Hembra</Button><Button type="button" aria-pressed={form.sex === "male"} className={form.sex === "male" ? "bg-lime-700 text-white" : "bg-stone-100 text-stone-800"} onClick={() => updateForm({ sex: "male" })}>Macho</Button></div></div><Button type="button" className="mt-7 w-full bg-lime-700 text-white" onClick={() => form.name.trim() ? setStep(2) : setError("Escribe al menos el nombre de la vaca.")}><CirclePlus size={20} aria-hidden="true" />{isEditing ? "Continuar" : "Siguiente"}</Button></> : <><p className="text-base text-stone-600">Este dato es opcional y solo sirve como referencia.</p><div className="mt-6"><FieldLabel>Edad aproximada en meses <span className="normal-case tracking-normal">(opcional)</span></FieldLabel><TextInput autoFocus inputMode="numeric" min="0" type="number" value={form.approximateAgeMonths} onChange={(event) => updateForm({ approximateAgeMonths: event.target.value })} placeholder="Ejemplo: 36" /></div><div className="mt-6"><FieldLabel>Grupo del rejo</FieldLabel><select className="min-h-12 w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 text-lg" value={form.herdGroupId ?? ""} onChange={(event) => updateForm({ herdGroupId: event.target.value || undefined })}>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></div><div className="mt-7 rounded-2xl bg-stone-100 p-4"><p className="text-sm font-bold uppercase tracking-wide text-stone-500">Así quedará registrada</p><p className="mt-1 text-2xl font-black text-stone-950">{form.name}</p><p className="mt-1 text-base text-stone-600">{form.sex === "female" ? "Hembra" : form.sex === "male" ? "Macho" : "Sexo pendiente"} · {groups.find((group) => group.id === form.herdGroupId)?.name ?? "Sin grupo"}</p></div><div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row"><Button type="button" className="bg-stone-100 text-stone-800" onClick={() => setStep(1)}>Atrás</Button><Button type="button" className="flex-1 bg-lime-700 text-white" onClick={() => void save()}><Save size={20} aria-hidden="true" />{isEditing ? "Guardar cambios" : "Guardar vaca"}</Button></div></>}
      </Card>
    </main>
  </div>;
};

export const AnimalDetail = ({ animal, groups, session, onClose, onEdit }: { animal: Animal; groups: HerdGroup[]; session: FarmSession; onClose: () => void; onEdit: () => void }) => {
  const [section, setSection] = useState<DetailSection>("general");
  const sexLabel = animal.sex === "female" ? "Hembra" : animal.sex === "male" ? "Macho" : "Sexo pendiente";
  const groupName = groups.find((group) => group.id === animal.herdGroupId)?.name ?? groups[0]?.name ?? "Sin grupo";
  return <div className={screenShell} role="dialog" aria-modal="true" aria-label={`Ficha de ${animal.name}`}>
    <FullScreenHeader eyebrow="Ficha de la vaca" title={animal.name} onClose={onClose} />
    <main className="mx-auto max-w-2xl p-4 pb-10 pt-6 sm:p-6">
      <section className="rounded-3xl bg-stone-950 p-5 text-white sm:p-6"><p className="text-base text-stone-300">{sexLabel}{animal.birthDateEstimated ? " · edad estimada" : ""}</p><p className="mt-1 text-lg font-bold text-lime-200">Grupo: {groupName}</p><Button type="button" className="mt-4 bg-white text-stone-950 hover:bg-stone-100" onClick={onEdit}><Pencil size={19} aria-hidden="true" />Editar datos</Button></section>
      <div className="mt-5 grid grid-cols-3 rounded-2xl bg-stone-200 p-1" role="tablist" aria-label="Secciones de la ficha"><button type="button" role="tab" aria-selected={section === "general"} className={`min-h-12 rounded-xl px-2 text-sm font-bold ${section === "general" ? "bg-white text-lime-950 shadow-sm" : "text-stone-600"}`} onClick={() => setSection("general")}>General</button><button type="button" role="tab" aria-selected={section === "reproduction"} className={`min-h-12 rounded-xl px-2 text-sm font-bold ${section === "reproduction" ? "bg-white text-lime-950 shadow-sm" : "text-stone-600"}`} onClick={() => setSection("reproduction")}>Reproducción</button><button type="button" role="tab" aria-selected={section === "health"} className={`min-h-12 rounded-xl px-2 text-sm font-bold ${section === "health" ? "bg-white text-lime-950 shadow-sm" : "text-stone-600"}`} onClick={() => setSection("health")}>Sanidad</button></div>
      <div className="mt-5">{section === "general" ? <Card><p className="text-sm font-bold uppercase tracking-wide text-stone-500">Información general</p><h2 className="mt-1 text-2xl font-black text-stone-950">{animal.name}</h2><dl className="mt-5 space-y-3 text-base"><div className="flex justify-between gap-4"><dt className="text-stone-600">Grupo</dt><dd className="font-bold text-stone-950">{groupName}</dd></div><div className="flex justify-between gap-4"><dt className="text-stone-600">Sexo</dt><dd className="font-bold text-stone-950">{sexLabel}</dd></div><div className="flex justify-between gap-4"><dt className="text-stone-600">Edad</dt><dd className="font-bold text-stone-950">{animal.birthDateEstimated ? "Estimación guardada" : "Sin estimación"}</dd></div></dl></Card> : section === "reproduction" ? <ReproductionPanel animal={animal} session={session} /> : <HealthPanel animal={animal} session={session} />}</div>
    </main>
  </div>;
};

export const AnimalsPage = ({ session, onMilkControl }: AnimalsPageProps) => {
  const animals = useLiveQuery(() => db.animals.filter((animal) => animal.farmId === session.farmId && !animal.deletedAt).sortBy("name"), [session.farmId], []);
  const groups = useLiveQuery(() => db.herdGroups.filter((group) => group.farmId === session.farmId && !group.deletedAt).sortBy("sortOrder"), [session.farmId], []);
  const [selectedAnimal, setSelectedAnimal] = useState<Animal>();
  const [editedAnimal, setEditedAnimal] = useState<Animal>();
  const [isCreating, setIsCreating] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>();
  const [newGroupName, setNewGroupName] = useState("");
  const [isManagingGroups, setIsManagingGroups] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string>();
  const [editingGroupName, setEditingGroupName] = useState("");
  const [message, setMessage] = useState<string>();

  useEffect(() => { void ensureDefaultHerdGroups(db, session.farmId, session.userId); }, [session.farmId, session.userId]);
  const activeGroupId = selectedGroupId ?? groups[0]?.id;
  const visibleAnimals = animals.filter((animal) => (animal.herdGroupId ?? groups[0]?.id) === activeGroupId);

  const remove = async (animal: Animal) => {
    if (!window.confirm("¿Quieres sacar a " + animal.name + " de esta lista?")) return;
    await archiveAnimal(db, animal);
    setMessage(animal.name + " quedó fuera de la lista, pero su historial se conserva.");
  };
  const completeEditor = (nextMessage: string) => { setEditedAnimal(undefined); setIsCreating(false); setMessage(nextMessage); };
  const addGroup = async () => { try { const group = await createHerdGroup(db, session.farmId, session.userId, newGroupName); setNewGroupName(""); setSelectedGroupId(group.id); setMessage(`El grupo ${group.name} quedó creado.`); } catch (caught) { setMessage(caught instanceof Error ? caught.message : "No se pudo crear el grupo."); } };
  const saveGroupName = async () => { const group = groups.find((item) => item.id === editingGroupId); if (!group) return; try { const updated = await renameHerdGroup(db, group, editingGroupName); setEditingGroupId(undefined); setMessage(`El grupo ahora se llama ${updated.name}.`); } catch (caught) { setMessage(caught instanceof Error ? caught.message : "No se pudo cambiar el nombre."); } };

  return <div className="space-y-5">
    <div className="px-1"><p className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-[0.16em] text-lime-800"><Beef size={16} aria-hidden="true" />El rejo</p><h1 className="mt-1 text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">Tus vacas</h1><p className="mt-2 max-w-xl text-base text-stone-600">Abre una ficha para registrar lo que pasó o añade una vaca nueva.</p></div>
    {message ? <Notice tone="success">{message}</Notice> : null}
    <div className="grid gap-3 sm:grid-cols-2"><Button type="button" className="w-full bg-lime-700 text-white shadow-[0_12px_25px_rgba(77,124,15,0.2)] hover:bg-lime-800" onClick={() => setIsCreating(true)}><CirclePlus size={20} aria-hidden="true" />Registrar una vaca</Button>{onMilkControl ? <Button type="button" className="w-full bg-stone-900 text-white" onClick={onMilkControl}><ClipboardPenLine size={20} aria-hidden="true" />Control lechero</Button> : null}</div>
    <section><div className="flex items-center justify-between gap-3 px-1"><p className="text-sm font-bold uppercase tracking-wide text-stone-500">Grupos del rejo</p><Button type="button" className="min-h-10 bg-stone-100 px-3 text-sm text-stone-800" onClick={() => setIsManagingGroups((current) => !current)}><SlidersHorizontal size={18} aria-hidden="true" />Administrar</Button></div><div className="mt-3 flex gap-2 overflow-x-auto pb-1">{groups.map((group) => <button key={group.id} type="button" className={`min-h-11 shrink-0 rounded-2xl px-4 text-base font-bold ${activeGroupId === group.id ? "bg-lime-700 text-white" : "bg-stone-100 text-stone-700"}`} onClick={() => setSelectedGroupId(group.id)}>{group.name} <span className="opacity-70">{animals.filter((animal) => (animal.herdGroupId ?? groups[0]?.id) === group.id).length}</span></button>)}</div>{isManagingGroups ? <Card><p className="text-sm font-bold uppercase tracking-wide text-stone-500">Administrar grupos</p><p className="mt-1 text-base text-stone-600">Cambia nombres u ordena cómo aparecen en la lista.</p><div className="mt-4 space-y-3">{groups.map((group, index) => <div key={group.id} className="rounded-2xl bg-stone-50 p-3"><div className="flex items-center gap-2"><TextInput value={editingGroupId === group.id ? editingGroupName : group.name} disabled={editingGroupId !== group.id} onChange={(event) => setEditingGroupName(event.target.value)} /><Button type="button" className="bg-white px-3 text-stone-800" onClick={() => editingGroupId === group.id ? void saveGroupName() : (setEditingGroupId(group.id), setEditingGroupName(group.name))}>{editingGroupId === group.id ? "Guardar" : "Renombrar"}</Button></div><div className="mt-2 flex gap-2"><Button type="button" disabled={index === 0} className="min-h-10 bg-white px-3 text-stone-800" onClick={() => void reorderHerdGroup(db, groups, group.id, -1)}><ArrowUp size={18} aria-hidden="true" />Subir</Button><Button type="button" disabled={index === groups.length - 1} className="min-h-10 bg-white px-3 text-stone-800" onClick={() => void reorderHerdGroup(db, groups, group.id, 1)}><ArrowDown size={18} aria-hidden="true" />Bajar</Button></div></div>)}</div></Card> : null}<details className="mt-3 rounded-2xl bg-stone-50 p-4"><summary className="cursor-pointer text-base font-bold text-stone-700">Crear otro grupo</summary><div className="mt-4 flex gap-2"><TextInput value={newGroupName} onChange={(event) => setNewGroupName(event.target.value)} placeholder="Ejemplo: Toros" /><Button type="button" className="bg-stone-900 text-white" onClick={() => void addGroup()}>Crear</Button></div></details></section>
    {animals.length === 0 ? <Card><p className="text-xl font-black text-stone-950">Aún no hay vacas registradas.</p><p className="mt-2 text-base text-stone-600">Empieza con los nombres que recuerdes. Solo necesitas uno para crear la ficha.</p></Card> : <section><p className="px-1 text-sm font-bold uppercase tracking-wide text-stone-500">{groups.find((group) => group.id === activeGroupId)?.name ?? "Grupo"} · {visibleAnimals.length} {visibleAnimals.length === 1 ? "animal" : "animales"}</p><div className="mt-3 space-y-3">{visibleAnimals.length === 0 ? <Notice tone="info">No hay animales en este grupo todavía.</Notice> : visibleAnimals.map((animal) => <Card key={animal.id}><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-2xl font-black text-stone-950">{animal.name}</h2><p className="mt-1 text-base text-stone-600">{animal.sex === "female" ? "Hembra" : animal.sex === "male" ? "Macho" : "Sexo pendiente"}{animal.birthDateEstimated ? " · edad estimada" : ""}</p></div><div className="grid grid-cols-2 gap-2 sm:flex"><Button type="button" className="bg-lime-100 text-lime-950" onClick={() => setSelectedAnimal(animal)}><FolderOpen size={19} aria-hidden="true" />Abrir ficha</Button><Button type="button" className="bg-stone-100 text-stone-800" onClick={() => setEditedAnimal(animal)}><Pencil size={19} aria-hidden="true" />Editar</Button><Button type="button" className="col-span-2 bg-red-50 text-red-900 sm:col-auto" onClick={() => void remove(animal)}><Archive size={19} aria-hidden="true" />Sacar de la lista</Button></div></div></Card>)}</div></section>}
    {selectedAnimal ? <AnimalDetail animal={selectedAnimal} groups={groups} session={session} onClose={() => setSelectedAnimal(undefined)} onEdit={() => { setEditedAnimal(selectedAnimal); setSelectedAnimal(undefined); }} /> : null}
    {isCreating ? <AnimalEditor groups={groups} defaultGroupId={activeGroupId} session={session} onClose={() => setIsCreating(false)} onSaved={completeEditor} /> : null}
    {editedAnimal ? <AnimalEditor animal={editedAnimal} groups={groups} defaultGroupId={activeGroupId} session={session} onClose={() => setEditedAnimal(undefined)} onSaved={completeEditor} /> : null}
  </div>;
};
