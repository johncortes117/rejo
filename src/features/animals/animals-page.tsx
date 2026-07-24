import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Button, Card, FieldLabel, Notice, TextInput } from "@/components/ui";
import type { Animal, AnimalSex, FarmSession } from "@/domain/models";
import { db } from "@/db/rejo-db";
import { archiveAnimal, saveAnimal } from "@/features/animals/animals";

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
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
