import { type ReactNode, useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Archive, ArrowDown, ArrowLeft, ArrowUp, Beef, Check, CirclePlus, ClipboardPenLine, Clock3, FolderOpen, HeartPulse, LoaderCircle, Milk, Pencil, Plus, Save, ShieldPlus, SlidersHorizontal, Stethoscope, Syringe, X } from "lucide-react";
import { Button, Card, FieldLabel, Notice, SegmentedControl, TextInput } from "@/components/ui";
import { TrendSparkline } from "@/components/trend-sparkline";
import type { Animal, AnimalPhotoCrop, AnimalSex, FarmSession, HerdGroup } from "@/domain/models";
import { db } from "@/db/rejo-db";
import { nowInFarmTimezone } from "@/domain/time";
import { archiveAnimal, saveAnimal } from "@/features/animals/animals";
import { AnimalPhotoPicker } from "@/features/animals/animal-photo";
import { AnimalPhotoFrame } from "@/features/animals/animal-photo-frame";
import { createHerdGroup, ensureDefaultHerdGroups, renameHerdGroup, reorderHerdGroup } from "@/features/animals/herd-groups";
import { recordCalving, recordDryOff, recordHeat, recordPregnancyCheck, recordService } from "@/features/reproduction/events";
import { computeReproductiveState } from "@/features/reproduction/reproductive-state";
import { recordHealthEvent } from "@/features/health/events";
import { computeMilkWithholdingUntil, isMilkWithheld } from "@/features/health/milk-withholding";
import { updateHealthPlanTask } from "@/features/health/plan-tasks";
import { buildAnimalMilkTrend } from "@/features/milk-control/milk-control";

interface AnimalsPageProps {
  session: FarmSession;
  onMilkControl?: () => void;
}

interface AnimalFormState {
  id?: string;
  name: string;
  sex: "" | AnimalSex;
  approximateAgeMonths: string;
  previousCalvingCount: string;
  photoUrl?: string;
  photoCrop?: AnimalPhotoCrop;
  herdGroupId?: string;
}

type DetailSection = "general" | "reproduction" | "health";

const emptyForm: AnimalFormState = { name: "", sex: "", approximateAgeMonths: "", previousCalvingCount: "" };

const toFormState = (animal: Animal): AnimalFormState => ({
  id: animal.id,
  name: animal.name,
  sex: animal.sex ?? "",
  approximateAgeMonths: "",
  previousCalvingCount: animal.previousCalvingCount?.toString() ?? "",
  photoUrl: animal.photoUrl,
  photoCrop: animal.photoCrop,
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

const screenShell = "fixed inset-0 z-[100] h-[100dvh] overflow-y-auto overscroll-contain bg-stone-100";

const AnimalPhotoViewer = ({ animal, onClose }: { animal: Animal; onClose: () => void }) => (
  <div className="fixed inset-0 z-[110] flex h-[100dvh] items-center justify-center bg-black" role="dialog" aria-modal="true" aria-label={`Foto completa de ${animal.name}`}>
    <img className="max-h-full max-w-full object-contain" src={animal.photoUrl} alt={`Foto completa de ${animal.name}`} />
    <Button type="button" className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] min-h-11 bg-white/95 px-3 text-stone-900 shadow-lg hover:bg-white" onClick={onClose} aria-label="Cerrar foto completa"><X size={20} aria-hidden="true" /></Button>
  </div>
);

const formatFarmDate = (date: string): string => new Intl.DateTimeFormat("es-EC", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "America/Guayaquil"
}).format(new Date(`${date}T12:00:00-05:00`));

const useDetailScrollLock = (): void => {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
    };
  }, []);
};

const FullScreenHeader = ({
  eyebrow,
  title,
  onClose,
  disabled = false
}: {
  eyebrow: string;
  title: string;
  onClose: () => void;
  disabled?: boolean;
}) => (
  <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-stone-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
    <Button type="button" disabled={disabled} className="min-h-11 shrink-0 bg-stone-100 px-3 text-stone-800" onClick={onClose} aria-label="Cerrar ficha">
      <X size={19} aria-hidden="true" />
    </Button>
    <div className="min-w-0">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-lime-800">{eyebrow}</p>
      <h1 className="truncate text-xl font-black text-stone-950 sm:text-2xl">{title}</h1>
    </div>
  </header>
);

const ProfileCaptureScreen = ({
  eyebrow,
  title,
  onClose,
  disabled = false,
  children
}: {
  eyebrow: string;
  title: string;
  onClose: () => void;
  disabled?: boolean;
  children: ReactNode;
}) => (
  <div className="fixed inset-0 z-[60] h-[100dvh] overflow-y-auto overscroll-contain bg-stone-100" role="dialog" aria-modal="true" aria-label={title}>
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-stone-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
      <Button type="button" disabled={disabled} className="min-h-11 shrink-0 bg-stone-100 px-3 text-stone-800" onClick={onClose} aria-label="Volver a la ficha">
        <ArrowLeft size={20} aria-hidden="true" />
      </Button>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-lime-800">{eyebrow}</p>
        <h2 className="truncate text-xl font-black text-stone-950 sm:text-2xl">{title}</h2>
      </div>
    </header>
    <div className="mx-auto max-w-2xl p-4 pb-10 pt-6 sm:p-6">{children}</div>
  </div>
);

interface HistoryEntry {
  id: string;
  date: string;
  title: string;
  detail?: string;
  tone: "lime" | "red" | "stone";
}

const HistoryList = ({ entries, emptyMessage }: { entries: HistoryEntry[]; emptyMessage: string }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const visibleEntries = isExpanded ? entries : entries.slice(0, 4);

  return (
    <section>
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-stone-500">Historial</p>
          <h2 className="mt-1 text-xl font-black text-stone-950">Últimos registros</h2>
        </div>
        {entries.length > 4 ? <button type="button" className="min-h-10 rounded-xl px-2 text-sm font-bold text-lime-800 underline" onClick={() => setIsExpanded((current) => !current)}>{isExpanded ? "Ver menos" : `Ver todo (${entries.length})`}</button> : null}
      </div>
      {entries.length === 0 ? <p className="mt-3 rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-4 text-sm leading-snug text-stone-600">{emptyMessage}</p> : <div className="mt-3 overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-[0_8px_28px_rgba(28,25,23,0.06)]">{visibleEntries.map((entry, index) => <div key={entry.id} className={`flex gap-3 px-4 py-4 sm:px-5 ${index ? "border-t border-stone-100" : ""}`}><span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${entry.tone === "red" ? "bg-red-600" : entry.tone === "lime" ? "bg-lime-700" : "bg-stone-400"}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><p className="font-black text-stone-950">{entry.title}</p><time className="text-sm font-semibold text-stone-500">{formatFarmDate(entry.date)}</time></div>{entry.detail ? <p className="mt-1 text-sm leading-snug text-stone-600">{entry.detail}</p> : null}</div></div>)}</div>}
    </section>
  );
};

const HealthPanel = ({ animal, session }: { animal: Animal; session: FarmSession }) => {
  const { date: today } = nowInFarmTimezone();
  const [date, setDate] = useState(today);
  const [type, setType] = useState<"mastitis" | "deworming" | "vaccination" | "other">("mastitis");
  const [productName, setProductName] = useState("");
  const [withdrawalHours, setWithdrawalHours] = useState("");
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [isRecording, setIsRecording] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const saveRef = useRef(false);
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
  const healthHistory: HistoryEntry[] = [...events]
    .sort((left, right) => right.date.localeCompare(left.date))
    .map((event) => ({
      id: event.id,
      date: event.date,
      title: event.type === "mastitis" ? "Atención por mastitis" : event.type === "deworming" ? "Curada" : event.type === "vaccination" ? "Vacuna" : event.type === "lameness" ? "Atención por cojera" : "Atención sanitaria",
      detail: [event.productName, event.milkWithdrawalHours ? `${event.milkWithdrawalHours} h sin entregar leche` : undefined].filter(Boolean).join(" · ") || undefined,
      tone: event.milkWithdrawalHours ? "red" : "lime"
    }));

  const save = async () => {
    if (saveRef.current) return;
    setMessage(undefined);
    setError(undefined);
    const hours = withdrawalHours === "" ? undefined : Number(withdrawalHours);
    if (hours !== undefined && (!Number.isFinite(hours) || hours < 0)) {
      setError("Escribe horas de retiro válidas.");
      return;
    }
    saveRef.current = true;
    setIsSaving(true);
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
      setIsRecording(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar el evento sanitario.");
    } finally {
      saveRef.current = false;
      setIsSaving(false);
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

      <section className={`rounded-3xl border p-4 ${milkWithheld ? "border-red-200 bg-red-50 text-red-950" : "border-lime-200 bg-lime-50 text-lime-950"}`}>
        <p className="text-sm font-bold uppercase tracking-wide opacity-75">Estado de leche</p>
        <p className="mt-1 text-xl font-black">{milkWithheld ? "Retiro vigente" : "Leche habilitada"}</p>
        <p className="mt-1 text-sm leading-snug opacity-80">{milkWithheld ? `No se entrega hasta ${new Date(withholdingUntil!).toLocaleString("es-EC", { timeZone: "America/Guayaquil" })}.` : "No hay retiro de leche activo para este animal."}</p>
      </section>

      <Button type="button" className="w-full bg-red-800 text-white shadow-[0_12px_25px_rgba(153,27,27,0.16)] hover:bg-red-900" onClick={() => { setError(undefined); setIsRecording(true); }}>
        <Plus size={20} aria-hidden="true" />Registrar atención
      </Button>

      {isRecording ? <ProfileCaptureScreen eyebrow={animal.name} title="Registrar atención" disabled={isSaving} onClose={() => setIsRecording(false)}>
        {error ? <div className="mb-5"><Notice tone="error">{error}</Notice></div> : null}
        <Card>
          <p className="text-sm font-bold uppercase tracking-wide text-stone-500">Sanidad</p>
          <h2 className="mt-1 flex items-center gap-2 text-2xl font-black text-stone-950"><Stethoscope size={24} aria-hidden="true" />¿Qué atención recibió?</h2>
          <div className="mt-5">
            <FieldLabel>Evento</FieldLabel>
            <select disabled={isSaving} className="min-h-12 w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 text-lg text-stone-950 outline-none focus:border-lime-700 focus:bg-white focus:ring-4 focus:ring-lime-100 disabled:opacity-50" value={type} onChange={(event) => setType(event.target.value as typeof type)}>
              <option value="mastitis">Mastitis</option>
              <option value="deworming">Curada</option>
              <option value="vaccination">Vacuna</option>
              <option value="other">Otro</option>
            </select>
          </div>
          <div className="mt-5"><FieldLabel>Producto aplicado <span className="normal-case tracking-normal">(opcional)</span></FieldLabel><TextInput disabled={isSaving} value={productName} onChange={(event) => setProductName(event.target.value)} placeholder="Ejemplo: medicamento aplicado" /></div>
          <div className="mt-5"><FieldLabel>Horas sin entregar leche <span className="normal-case tracking-normal">(opcional)</span></FieldLabel><TextInput disabled={isSaving} inputMode="numeric" min="0" type="number" value={withdrawalHours} onChange={(event) => setWithdrawalHours(event.target.value)} placeholder="Ejemplo: 96" /></div>
          <div className="mt-5"><FieldLabel>Fecha</FieldLabel><TextInput disabled={isSaving} type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div>
          <Button type="button" disabled={isSaving} className="mt-6 w-full bg-red-800 text-white hover:bg-red-900" onClick={() => void save()}>{isSaving ? <><LoaderCircle className="animate-spin" size={20} aria-hidden="true" />Guardando atención…</> : <><Syringe size={20} aria-hidden="true" />Guardar atención sanitaria</>}</Button>
        </Card>
      </ProfileCaptureScreen> : null}

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
      <HistoryList entries={healthHistory} emptyMessage="Aún no hay atenciones sanitarias registradas para este animal." />
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
  const [isRecording, setIsRecording] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const saveRef = useRef(false);
  const facts = useLiveQuery(
    async () => Promise.all([
      db.heats.filter((item) => item.animalId === animal.id && !item.deletedAt).toArray(),
      db.services.filter((item) => item.animalId === animal.id && !item.deletedAt).toArray(),
      db.pregnancyChecks.filter((item) => item.animalId === animal.id && !item.deletedAt).toArray(),
      db.calvings.filter((item) => item.animalId === animal.id && !item.deletedAt).toArray(),
      db.dryOffs.filter((item) => item.animalId === animal.id && !item.deletedAt).toArray()
    ]),
    [animal.id],
    [[], [], [], [], []]
  );
  const [heats, services, pregnancyChecks, calvings, dryOffs] = facts;
  const state = computeReproductiveState({ asOf: today, sex: animal.sex, heats, services, pregnancyChecks, calvings });
  const reproductiveHistory: HistoryEntry[] = [
    ...heats.map((event) => ({ id: event.id, date: event.date, title: "Celo detectado", detail: event.served ? "Se registró como atendido." : undefined, tone: "red" as const })),
    ...services.map((event) => ({ id: event.id, date: event.date, title: event.type === "ai" ? "Inseminación" : "Servicio natural", detail: `Servicio #${event.serviceNumber}`, tone: "lime" as const })),
    ...pregnancyChecks.map((event) => ({ id: event.id, date: event.date, title: event.result === "pregnant" ? "Preñez confirmada" : event.result === "open" ? "Palpación: vacía" : "Palpación: dudosa", detail: event.method === "ultrasound" ? "Ecografía" : "Palpación", tone: event.result === "pregnant" ? "lime" as const : "stone" as const })),
    ...calvings.map((event) => ({ id: event.id, date: event.date, title: "Parto registrado", detail: event.calfIds.length === 1 ? "Una cría registrada." : `${event.calfIds.length} crías registradas.`, tone: "lime" as const })),
    ...dryOffs.map((event) => ({ id: event.id, date: event.date, title: "Secado", detail: event.expectedCalvingDate ? `Parto esperado: ${formatFarmDate(event.expectedCalvingDate)}.` : undefined, tone: "stone" as const }))
  ].sort((left, right) => right.date.localeCompare(left.date));

  const save = async () => {
    if (saveRef.current) return;
    setError(undefined);
    setMessage(undefined);
    const input = { farmId: session.farmId, animalId: animal.id, userId: session.userId, date };
    saveRef.current = true;
    setIsSaving(true);
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
      setIsRecording(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar el evento.");
    } finally {
      saveRef.current = false;
      setIsSaving(false);
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

      {animal.sex !== "male" ? <Button type="button" className="w-full bg-lime-700 text-white shadow-[0_12px_25px_rgba(77,124,15,0.2)] hover:bg-lime-800" onClick={() => { setError(undefined); setIsRecording(true); }}><Plus size={20} aria-hidden="true" />Registrar evento</Button> : null}

      {isRecording ? <ProfileCaptureScreen eyebrow={animal.name} title="Registrar evento" disabled={isSaving} onClose={() => setIsRecording(false)}>
        {error ? <div className="mb-5"><Notice tone="error">{error}</Notice></div> : null}
        <Card>
          <p className="text-sm font-bold uppercase tracking-wide text-stone-500">Reproducción</p>
          <h2 className="mt-1 flex items-center gap-2 text-2xl font-black text-stone-950"><ClipboardPenLine size={24} aria-hidden="true" />¿Qué ocurrió?</h2>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">{eventOptions.map((option) => <Button key={option.value} type="button" disabled={isSaving} aria-pressed={eventType === option.value} className={eventType === option.value ? "bg-lime-700 text-white" : "bg-stone-100 text-stone-800"} onClick={() => setEventType(option.value)}>{option.label}</Button>)}</div>
          <div className="mt-5"><FieldLabel>Fecha</FieldLabel><TextInput disabled={isSaving} type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div>
          {eventType === "service" ? <div className="mt-5"><FieldLabel>Tipo de servicio</FieldLabel><div className="grid grid-cols-2 gap-3"><Button type="button" disabled={isSaving} aria-pressed={serviceType === "natural"} className={serviceType === "natural" ? "bg-lime-700 text-white" : "bg-stone-100 text-stone-800"} onClick={() => setServiceType("natural")}>Natural</Button><Button type="button" disabled={isSaving} aria-pressed={serviceType === "ai"} className={serviceType === "ai" ? "bg-lime-700 text-white" : "bg-stone-100 text-stone-800"} onClick={() => setServiceType("ai")}>Inseminación</Button></div></div> : null}
          {eventType === "check" ? <div className="mt-5"><FieldLabel>Resultado de la palpación</FieldLabel><div className="grid grid-cols-1 gap-2 sm:grid-cols-3"><Button type="button" disabled={isSaving} aria-pressed={checkResult === "pregnant"} className={checkResult === "pregnant" ? "bg-lime-700 text-white" : "bg-stone-100 text-stone-800"} onClick={() => setCheckResult("pregnant")}>Preñada</Button><Button type="button" disabled={isSaving} aria-pressed={checkResult === "open"} className={checkResult === "open" ? "bg-lime-700 text-white" : "bg-stone-100 text-stone-800"} onClick={() => setCheckResult("open")}>Vacía</Button><Button type="button" disabled={isSaving} aria-pressed={checkResult === "doubtful"} className={checkResult === "doubtful" ? "bg-lime-700 text-white" : "bg-stone-100 text-stone-800"} onClick={() => setCheckResult("doubtful")}>Dudosa</Button></div></div> : null}
          {eventType === "calving" ? <div className="mt-5 space-y-5"><div><FieldLabel>Nombre de la cría</FieldLabel><TextInput disabled={isSaving} value={calfName} onChange={(event) => setCalfName(event.target.value)} placeholder="Ejemplo: Lucera" /></div><div><FieldLabel>Sexo de la cría</FieldLabel><div className="grid grid-cols-2 gap-3"><Button type="button" disabled={isSaving} aria-pressed={calfSex === "female"} className={calfSex === "female" ? "bg-lime-700 text-white" : "bg-stone-100 text-stone-800"} onClick={() => setCalfSex("female")}>Hembra</Button><Button type="button" disabled={isSaving} aria-pressed={calfSex === "male"} className={calfSex === "male" ? "bg-lime-700 text-white" : "bg-stone-100 text-stone-800"} onClick={() => setCalfSex("male")}>Macho</Button></div></div>{calfSex === "female" ? <Notice tone="info">REJO programará su vacuna de brucelosis para dentro de tres meses.</Notice> : null}</div> : null}
          <Button type="button" disabled={isSaving} className="mt-6 w-full bg-lime-700 text-white hover:bg-lime-800" onClick={() => void save()}>{isSaving ? <><LoaderCircle className="animate-spin" size={20} aria-hidden="true" />Guardando evento…</> : <><Save size={20} aria-hidden="true" />Guardar evento</>}</Button>
        </Card>
      </ProfileCaptureScreen> : null}
      <HistoryList entries={reproductiveHistory} emptyMessage="Aún no hay eventos reproductivos registrados para este animal." />
    </div>
  );
};

export const AnimalEditor = ({ animal, groups, defaultGroupId, session, onClose, onSaved }: { animal?: Animal; groups: HerdGroup[]; defaultGroupId?: string; session: FarmSession; onClose: () => void; onSaved: (message: string) => void }) => {
  const [form, setForm] = useState<AnimalFormState>({ ...(animal ? toFormState(animal) : emptyForm), herdGroupId: animal?.herdGroupId ?? defaultGroupId });
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string>();
  const [isPreparingPhoto, setIsPreparingPhoto] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const isEditing = Boolean(animal);
  const updateForm = (update: Partial<AnimalFormState>) => setForm((current) => ({ ...current, ...update }));
  const save = async () => {
    if (savingRef.current || isPreparingPhoto) return;
    savingRef.current = true;
    setIsSaving(true);
    setError(undefined);
    let didSave = false;
    try {
      await saveAnimal(db, { farmId: session.farmId, userId: session.userId, id: form.id, name: form.name, sex: form.sex || undefined, approximateAgeMonths: form.approximateAgeMonths ? Number(form.approximateAgeMonths) : undefined, previousCalvingCount: form.previousCalvingCount ? Number(form.previousCalvingCount) : animal?.previousCalvingCount !== undefined ? null : undefined, photoUrl: form.photoUrl ?? (animal?.photoUrl ? null : undefined), photoCrop: form.photoCrop ?? (animal?.photoUrl ? null : undefined), herdGroupId: form.herdGroupId });
      didSave = true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar la vaca.");
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
    if (didSave) onSaved(isEditing ? "La información quedó corregida." : "La vaca quedó guardada.");
  };

  return <div className={screenShell} role="dialog" aria-modal="true" aria-label={isEditing ? "Corregir vaca" : "Registrar una vaca"}>
    <FullScreenHeader eyebrow={isEditing ? "Editar ficha" : `Registrar vaca · paso ${step} de 2`} title={isEditing ? animal!.name : step === 1 ? "¿Cómo la conoces?" : "Un poco más de información"} onClose={onClose} disabled={isSaving || isPreparingPhoto} />
    <div className="mx-auto max-w-2xl p-4 pb-10 pt-6 sm:p-6">
      {error ? <div className="mb-5"><Notice tone="error">{error}</Notice></div> : null}
      <Card>
        {step === 1 ? (
          <>
            <p className="text-base text-stone-600">Empieza con lo esencial. Podrás completar o corregir el resto cuando quieras.</p>
            <div className="mt-6"><FieldLabel>Nombre o apodo</FieldLabel><TextInput autoFocus disabled={isSaving} value={form.name} onChange={(event) => updateForm({ name: event.target.value })} placeholder="Ejemplo: Pintada" /></div>
            <div className="mt-6"><FieldLabel>Sexo <span className="normal-case tracking-normal">(opcional)</span></FieldLabel><div className="grid grid-cols-2 gap-3"><Button type="button" disabled={isSaving} aria-pressed={form.sex === "female"} className={form.sex === "female" ? "bg-lime-700 text-white" : "bg-stone-100 text-stone-800"} onClick={() => updateForm({ sex: "female" })}>Hembra</Button><Button type="button" disabled={isSaving} aria-pressed={form.sex === "male"} className={form.sex === "male" ? "bg-lime-700 text-white" : "bg-stone-100 text-stone-800"} onClick={() => updateForm({ sex: "male" })}>Macho</Button></div></div>
            <Button type="button" disabled={isSaving} className="mt-7 w-full bg-lime-700 text-white" onClick={() => form.name.trim() ? setStep(2) : setError("Escribe al menos el nombre de la vaca.")}><CirclePlus size={20} aria-hidden="true" />{isEditing ? "Continuar" : "Siguiente"}</Button>
          </>
        ) : (
          <>
            <p className="text-base text-stone-600">La foto, la edad, los partos previos y el grupo son opcionales.</p>
            <div className="mt-6"><AnimalPhotoPicker value={form.photoUrl} crop={form.photoCrop} animalName={form.name} disabled={isSaving} onChange={(photoUrl, photoCrop) => updateForm({ photoUrl, photoCrop })} onPreparingChange={setIsPreparingPhoto} /></div>
            <div className="mt-6"><FieldLabel>Edad aproximada en meses <span className="normal-case tracking-normal">(opcional)</span></FieldLabel><TextInput autoFocus disabled={isSaving} inputMode="numeric" min="0" type="number" value={form.approximateAgeMonths} onChange={(event) => updateForm({ approximateAgeMonths: event.target.value })} placeholder="Ejemplo: 36" /></div>
            <div className="mt-6"><FieldLabel>Partos antes de registrarla <span className="normal-case tracking-normal">(opcional)</span></FieldLabel><TextInput aria-label="Partos antes de registrarla" disabled={isSaving} inputMode="numeric" min="0" type="number" value={form.previousCalvingCount} onChange={(event) => updateForm({ previousCalvingCount: event.target.value })} placeholder="Ejemplo: 2" /><p className="mt-2 text-sm text-stone-600">No incluye los partos que registrarás después en REJO.</p></div>
            <div className="mt-6"><FieldLabel>Grupo del rejo</FieldLabel><select disabled={isSaving} className="min-h-12 w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 text-lg disabled:cursor-not-allowed disabled:opacity-50" value={form.herdGroupId ?? ""} onChange={(event) => updateForm({ herdGroupId: event.target.value || undefined })}>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></div>
            <div className="mt-7 rounded-2xl bg-stone-100 p-4"><p className="text-sm font-bold uppercase tracking-wide text-stone-500">Así quedará registrada</p><p className="mt-1 text-2xl font-black text-stone-950">{form.name}</p><p className="mt-1 text-base text-stone-600">{form.sex === "female" ? "Hembra" : form.sex === "male" ? "Macho" : "Sexo pendiente"} · {groups.find((group) => group.id === form.herdGroupId)?.name ?? "Sin grupo"}</p></div>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row"><Button type="button" disabled={isSaving || isPreparingPhoto} className="bg-stone-100 text-stone-800" onClick={() => setStep(1)}>Atrás</Button><Button type="button" disabled={isSaving || isPreparingPhoto} className="flex-1 bg-lime-700 text-white" onClick={() => void save()}>{isSaving ? <><LoaderCircle className="animate-spin" size={20} aria-hidden="true" />{isEditing ? "Guardando cambios…" : "Guardando vaca…"}</> : isPreparingPhoto ? <><LoaderCircle className="animate-spin" size={20} aria-hidden="true" />Preparando foto…</> : <><Save size={20} aria-hidden="true" />{isEditing ? "Guardar cambios" : "Guardar vaca"}</>}</Button></div>
          </>
        )}
      </Card>
    </div>
  </div>;
};

const GeneralPanel = ({ animal, groupName, onArchive }: { animal: Animal; groupName: string; onArchive?: () => void }) => {
  const facts = useLiveQuery(
    async () => Promise.all([
      db.calvings.filter((item) => item.animalId === animal.id && !item.deletedAt).toArray(),
      db.milkControlSessions.filter((item) => item.farmId === animal.farmId && !item.deletedAt).toArray(),
      db.milkControlRecords.filter((item) => item.animalId === animal.id && !item.deletedAt).toArray()
    ]),
    [animal.farmId, animal.id],
    [[], [], []]
  );
  const [calvings, controlSessions, controlRecords] = facts;
  const milkTrend = buildAnimalMilkTrend(animal.id, controlSessions, controlRecords);
  const latestMilk = milkTrend.at(-1);
  const priorMilk = milkTrend.at(-2);
  const totalCalvings = (animal.previousCalvingCount ?? 0) + calvings.length;
  const birthLabel = animal.birthDate ? `${formatFarmDate(animal.birthDate)}${animal.birthDateEstimated ? " · estimada" : ""}` : "Sin estimación";

  return <div className="space-y-5">
    <Card>
      <p className="text-sm font-bold uppercase tracking-wide text-stone-500">Resumen</p>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5 text-base">
        <div><dt className="text-sm font-semibold text-stone-500">Grupo</dt><dd className="mt-1 font-black text-stone-950">{groupName}</dd></div>
        <div><dt className="text-sm font-semibold text-stone-500">Sexo</dt><dd className="mt-1 font-black text-stone-950">{animal.sex === "female" ? "Hembra" : animal.sex === "male" ? "Macho" : "Pendiente"}</dd></div>
        <div><dt className="text-sm font-semibold text-stone-500">Nacimiento</dt><dd className="mt-1 font-black leading-snug text-stone-950">{birthLabel}</dd></div>
        <div><dt className="text-sm font-semibold text-stone-500">Partos</dt><dd className="mt-1 font-black text-stone-950">{totalCalvings || "Sin dato"}</dd></div>
      </dl>
    </Card>

    <Card>
      <div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-lime-100 text-lime-900"><Milk size={22} aria-hidden="true" /></span><div className="min-w-0 flex-1"><p className="text-sm font-bold uppercase tracking-wide text-stone-500">Producción individual</p>{latestMilk ? <><div className="mt-1 flex flex-wrap items-baseline gap-x-2"><p className="text-3xl font-black tracking-tight text-stone-950">{latestMilk.liters.toFixed(1)} L</p><p className="text-sm font-semibold text-stone-500">último control</p></div><p className="mt-1 text-sm text-stone-600">{formatFarmDate(latestMilk.date)}{priorMilk ? ` · ${latestMilk.liters >= priorMilk.liters ? "+" : ""}${(latestMilk.liters - priorMilk.liters).toFixed(1)} L frente al anterior` : ""}</p></> : <><p className="mt-1 text-lg font-black text-stone-950">Aún sin controles</p><p className="mt-1 text-sm leading-snug text-stone-600">Cuando anotes litros por vaca, aquí verás cómo cambia su producción.</p></>}</div></div>{milkTrend.length >= 2 ? <div className="mt-4 text-lime-700"><TrendSparkline points={milkTrend.map((point) => ({ label: point.date, value: point.liters }))} ariaLabel={`Tendencia de producción de ${animal.name}: ${milkTrend.length} controles individuales`} /></div> : null}</Card>

    {onArchive ? <Button type="button" className="w-full bg-red-50 text-red-900 ring-1 ring-red-100" onClick={onArchive}><Archive size={20} aria-hidden="true" />Sacar de la lista</Button> : null}
  </div>;
};

export const AnimalDetail = ({ animal, groups, session, initialSection = "general", onClose, onEdit, onArchive }: { animal: Animal; groups: HerdGroup[]; session: FarmSession; initialSection?: DetailSection; onClose: () => void; onEdit: () => void; onArchive?: () => void }) => {
  const [section, setSection] = useState<DetailSection>(initialSection);
  const [isPhotoViewerOpen, setIsPhotoViewerOpen] = useState(false);
  const groupName = groups.find((group) => group.id === animal.herdGroupId)?.name ?? groups[0]?.name ?? "Sin grupo";
  useDetailScrollLock();

  return <div className={`${screenShell} isolate`} role="dialog" aria-modal="true" aria-label={`Ficha de ${animal.name}`}>
    <section data-testid="animal-profile-hero" className="mx-auto max-w-2xl bg-lime-950">
      {animal.photoUrl ? <button type="button" className="block w-full text-left" onClick={() => setIsPhotoViewerOpen(true)} aria-label={`Ver foto completa de ${animal.name}`}><AnimalPhotoFrame name={animal.name} photoUrl={animal.photoUrl} crop={animal.photoCrop} className="aspect-[4/3] w-full" /></button> : <div className="flex h-72 items-center justify-center bg-[radial-gradient(circle_at_72%_24%,#84cc16,transparent_36%),linear-gradient(145deg,#365314,#14532d)] text-lime-100"><Beef size={96} strokeWidth={1.25} aria-hidden="true" /></div>}
    </section>

    <div className="mx-auto max-w-2xl p-4 pb-10 sm:p-6">
      <header className="flex items-center gap-3 pb-5 pt-[max(0.25rem,env(safe-area-inset-top))]">
        <Button type="button" className="min-h-11 shrink-0 bg-white px-3 text-stone-900 ring-1 ring-stone-200 hover:bg-stone-50" onClick={onClose} aria-label="Cerrar ficha"><X size={20} aria-hidden="true" /></Button>
        <h1 className="min-w-0 flex-1 break-words text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">{animal.name}</h1>
        <Button type="button" className="min-h-11 shrink-0 bg-white px-3 text-stone-900 ring-1 ring-stone-200 hover:bg-stone-50" onClick={onEdit} aria-label={`Editar datos de ${animal.name}`}><Pencil size={19} aria-hidden="true" /></Button>
      </header>
      <div className="sticky top-0 z-20 -mx-4 border-b border-stone-200 bg-stone-100/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <SegmentedControl ariaLabel="Secciones de la ficha" value={section} onChange={setSection} options={[{ id: "general", label: "General" }, { id: "reproduction", label: "Reproducción" }, { id: "health", label: "Sanidad" }]} />
      </div>
      <div className="pt-5">{section === "general" ? <GeneralPanel animal={animal} groupName={groupName} onArchive={onArchive} /> : section === "reproduction" ? <ReproductionPanel animal={animal} session={session} /> : <HealthPanel animal={animal} session={session} />}</div>
    </div>
    {isPhotoViewerOpen && animal.photoUrl ? <AnimalPhotoViewer animal={animal} onClose={() => setIsPhotoViewerOpen(false)} /> : null}
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
