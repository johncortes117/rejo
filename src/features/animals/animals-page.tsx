import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Button, Card, FieldLabel, Notice, TextInput } from "@/components/ui";
import type { Animal, AnimalSex, FarmSession } from "@/domain/models";
import { db } from "@/db/rejo-db";
import { nowInFarmTimezone } from "@/domain/time";
import { archiveAnimal, saveAnimal } from "@/features/animals/animals";
import { recordHeat, recordPregnancyCheck, recordService } from "@/features/reproduction/events";
import { computeReproductiveState } from "@/features/reproduction/reproductive-state";
import { recordHealthEvent } from "@/features/health/events";
import { computeMilkWithholdingUntil, isMilkWithheld } from "@/features/health/milk-withholding";

interface AnimalsPageProps {
  session: FarmSession;
}

interface AnimalFormState {
  id?: string;
  name: string;
  sex: "" | AnimalSex;
  approximateAgeMonths: string;
}

const emptyForm: AnimalFormState = {
  name: "",
  sex: "",
  approximateAgeMonths: ""
};

const toFormState = (animal: Animal): AnimalFormState => ({
  id: animal.id,
  name: animal.name,
  sex: animal.sex ?? "",
  approximateAgeMonths: ""
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

  return (
    <div className="mt-6 border-t border-stone-200 pt-5">
      <h3 className="text-2xl font-black text-stone-950">Sanidad</h3>
      {milkWithheld ? (
        <div className="mt-4"><Notice tone="error">No se puede entregar su leche hasta {new Date(withholdingUntil!).toLocaleString("es-EC", { timeZone: "America/Guayaquil" })}.</Notice></div>
      ) : null}
      {message ? <div className="mt-4"><Notice tone="success">{message}</Notice></div> : null}
      {error ? <div className="mt-4"><Notice tone="error">{error}</Notice></div> : null}

      <div className="mt-5">
        <FieldLabel>Evento</FieldLabel>
        <select className="min-h-12 w-full rounded-lg border border-stone-300 bg-white px-3 text-lg" value={type} onChange={(event) => setType(event.target.value as typeof type)}>
          <option value="mastitis">Mastitis</option>
          <option value="deworming">Curada</option>
          <option value="vaccination">Vacuna</option>
          <option value="other">Otro</option>
        </select>
      </div>
      <div className="mt-5">
        <FieldLabel>Producto aplicado (opcional)</FieldLabel>
        <TextInput value={productName} onChange={(event) => setProductName(event.target.value)} placeholder="Ejemplo: medicamento aplicado" />
      </div>
      <div className="mt-5">
        <FieldLabel>Horas de retiro de leche (opcional)</FieldLabel>
        <TextInput inputMode="numeric" min="0" type="number" value={withdrawalHours} onChange={(event) => setWithdrawalHours(event.target.value)} placeholder="Ejemplo: 96" />
      </div>
      <div className="mt-5">
        <FieldLabel>Fecha</FieldLabel>
        <TextInput type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </div>
      <Button type="button" className="mt-6 w-full bg-red-800 text-white hover:bg-red-900" onClick={() => void save()}>
        Guardar evento sanitario
      </Button>
    </div>
  );
};

const ReproductionPanel = ({ animal, session }: { animal: Animal; session: FarmSession }) => {
  const { date: today } = nowInFarmTimezone();
  const [eventType, setEventType] = useState<"heat" | "service" | "check">("heat");
  const [date, setDate] = useState(today);
  const [serviceType, setServiceType] = useState<"natural" | "ai">("natural");
  const [checkResult, setCheckResult] = useState<"pregnant" | "open" | "doubtful">("pregnant");
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
  const state = computeReproductiveState({
    asOf: today,
    sex: animal.sex,
    heats,
    services,
    pregnancyChecks,
    calvings
  });

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
      } else {
        await recordPregnancyCheck(db, { ...input, result: checkResult });
        setMessage("La palpación quedó guardada en el celular.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar el evento.");
    }
  };

  return (
    <Card>
      <h2 className="text-2xl font-black text-stone-950">{animal.name}</h2>
      <p className="mt-1 text-lg font-bold text-lime-800">{reproductiveLabel(state.status)}</p>
      {state.isRepeatBreeder ? <Notice tone="warning">Vaca repetidora: conviene consultar la prueba de brucelosis.</Notice> : null}
      {state.expectedCalvingDate ? <p className="mt-2 text-lg text-stone-700">Parto estimado: {state.expectedCalvingDate}</p> : null}

      {message ? <div className="mt-4"><Notice tone="success">{message}</Notice></div> : null}
      {error ? <div className="mt-4"><Notice tone="error">{error}</Notice></div> : null}

      <div className="mt-5 grid grid-cols-3 gap-2">
        <Button type="button" className={eventType === "heat" ? "bg-lime-700 text-white" : "bg-stone-100 text-stone-800"} onClick={() => setEventType("heat")}>Celo</Button>
        <Button type="button" className={eventType === "service" ? "bg-lime-700 text-white" : "bg-stone-100 text-stone-800"} onClick={() => setEventType("service")}>Servicio</Button>
        <Button type="button" className={eventType === "check" ? "bg-lime-700 text-white" : "bg-stone-100 text-stone-800"} onClick={() => setEventType("check")}>Palpar</Button>
      </div>

      <div className="mt-5">
        <FieldLabel>Fecha</FieldLabel>
        <TextInput type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </div>

      {eventType === "service" ? (
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button type="button" className={serviceType === "natural" ? "bg-lime-700 text-white" : "bg-stone-100 text-stone-800"} onClick={() => setServiceType("natural")}>Natural</Button>
          <Button type="button" className={serviceType === "ai" ? "bg-lime-700 text-white" : "bg-stone-100 text-stone-800"} onClick={() => setServiceType("ai")}>Inseminación</Button>
        </div>
      ) : null}

      {eventType === "check" ? (
        <div className="mt-5 grid grid-cols-3 gap-2">
          <Button type="button" className={checkResult === "pregnant" ? "bg-lime-700 text-white" : "bg-stone-100 text-stone-800"} onClick={() => setCheckResult("pregnant")}>Preñada</Button>
          <Button type="button" className={checkResult === "open" ? "bg-lime-700 text-white" : "bg-stone-100 text-stone-800"} onClick={() => setCheckResult("open")}>Vacía</Button>
          <Button type="button" className={checkResult === "doubtful" ? "bg-lime-700 text-white" : "bg-stone-100 text-stone-800"} onClick={() => setCheckResult("doubtful")}>Dudosa</Button>
        </div>
      ) : null}

      <Button type="button" className="mt-6 w-full bg-lime-700 text-white hover:bg-lime-800" onClick={() => void save()}>
        Guardar evento
      </Button>
      <HealthPanel animal={animal} session={session} />
    </Card>
  );
};

export const AnimalsPage = ({ session }: AnimalsPageProps) => {
  const animals = useLiveQuery(
    () =>
      db.animals
        .filter((animal) => animal.farmId === session.farmId && !animal.deletedAt)
        .sortBy("name"),
    [session.farmId],
    []
  );
  const [form, setForm] = useState<AnimalFormState>(emptyForm);
  const [selectedAnimalId, setSelectedAnimalId] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  const updateForm = (update: Partial<AnimalFormState>) =>
    setForm((current) => ({ ...current, ...update }));

  const submit = async () => {
    setMessage(undefined);
    setError(undefined);

    try {
      await saveAnimal(db, {
        farmId: session.farmId,
        userId: session.userId,
        id: form.id,
        name: form.name,
        sex: form.sex || undefined,
        approximateAgeMonths: form.approximateAgeMonths
          ? Number(form.approximateAgeMonths)
          : undefined
      });
      setMessage(form.id ? "La información quedó corregida." : "La vaca quedó guardada.");
      setForm(emptyForm);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar la vaca.");
    }
  };

  const remove = async (animal: Animal) => {
    if (!window.confirm("¿Quieres sacar a " + animal.name + " de esta lista?")) {
      return;
    }

    await archiveAnimal(db, animal);
    setMessage(animal.name + " quedó fuera de la lista, pero su historial se conserva.");
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-black text-stone-950">Mis vacas</h1>
        <p className="mt-1 text-lg text-stone-700">Nómbralas como las conoces en la finca.</p>
      </div>

      {message ? <Notice tone="success">{message}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      <Card>
        <h2 className="text-2xl font-black">{form.id ? "Corregir vaca" : "Agregar una vaca"}</h2>
        <p className="mt-1 text-lg text-stone-700">Solo el nombre es obligatorio.</p>

        <div className="mt-5">
          <FieldLabel>Nombre</FieldLabel>
          <TextInput
            value={form.name}
            onChange={(event) => updateForm({ name: event.target.value })}
            placeholder="Ejemplo: Pintada"
          />
        </div>

        <div className="mt-5">
          <FieldLabel>Sexo (opcional)</FieldLabel>
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              className={form.sex === "female" ? "bg-lime-700 text-white" : "bg-stone-100 text-stone-800"}
              onClick={() => updateForm({ sex: "female" })}
            >
              Hembra
            </Button>
            <Button
              type="button"
              className={form.sex === "male" ? "bg-lime-700 text-white" : "bg-stone-100 text-stone-800"}
              onClick={() => updateForm({ sex: "male" })}
            >
              Macho
            </Button>
          </div>
        </div>

        <div className="mt-5">
          <FieldLabel>Edad aproximada en meses (opcional)</FieldLabel>
          <TextInput
            inputMode="numeric"
            min="0"
            type="number"
            value={form.approximateAgeMonths}
            onChange={(event) => updateForm({ approximateAgeMonths: event.target.value })}
            placeholder="Ejemplo: 36"
          />
          <p className="mt-2 text-lg text-stone-600">La guardamos como una estimación, no como fecha segura.</p>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button type="button" className="flex-1 bg-lime-700 text-white hover:bg-lime-800" onClick={() => void submit()}>
            {form.id ? "Guardar corrección" : "Guardar vaca"}
          </Button>
          {form.id ? (
            <Button type="button" className="bg-stone-100 text-stone-800" onClick={() => setForm(emptyForm)}>
              Cancelar
            </Button>
          ) : null}
        </div>
      </Card>

      <div className="space-y-3">
        {animals.length === 0 ? (
          <Notice tone="info">Aún no hay vacas anotadas. Puedes empezar con los nombres que recuerdes.</Notice>
        ) : (
          animals.map((animal) => (
            <Card key={animal.id}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-stone-950">{animal.name}</h2>
                  <p className="text-lg text-stone-700">
                    {animal.sex === "female" ? "Hembra" : animal.sex === "male" ? "Macho" : "Sexo pendiente"}
                    {animal.birthDateEstimated ? " · edad estimada" : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    className="bg-lime-100 text-lg text-lime-950"
                    onClick={() => setSelectedAnimalId((current) => current === animal.id ? undefined : animal.id)}
                  >
                    {selectedAnimalId === animal.id ? "Cerrar" : "Ficha"}
                  </Button>
                  <Button
                    type="button"
                    className="bg-stone-100 text-lg text-stone-800"
                    onClick={() => setForm(toFormState(animal))}
                  >
                    Corregir
                  </Button>
                  <Button
                    type="button"
                    className="bg-red-50 text-lg text-red-900"
                    onClick={() => void remove(animal)}
                  >
                    Sacar
                  </Button>
                </div>
              </div>
              {selectedAnimalId === animal.id ? <div className="mt-4"><ReproductionPanel animal={animal} session={session} /></div> : null}
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
