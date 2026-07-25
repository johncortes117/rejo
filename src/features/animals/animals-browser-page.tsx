import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowDown, ArrowLeft, ArrowUp, ChevronRight, CirclePlus, ClipboardPenLine, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { Button, Card, FieldLabel, Notice, TextInput } from "@/components/ui";
import { db } from "@/db/rejo-db";
import type { Animal, AnimalSex, FarmSession, HerdGroup } from "@/domain/models";
import { archiveAnimal, saveAnimal } from "@/features/animals/animals";
import { AnimalDetail, AnimalEditor } from "@/features/animals/animals-page";
import { createHerdGroup, ensureDefaultHerdGroups, renameHerdGroup, reorderHerdGroup } from "@/features/animals/herd-groups";

interface AnimalsBrowserPageProps {
  session: FarmSession;
  onMilkControl?: () => void;
}

interface NewAnimalForm {
  name: string;
  sex: "" | AnimalSex;
  approximateAgeMonths: string;
  herdGroupId?: string;
}

const groupDescriptions: Record<string, string> = {
  "En ordeño": "Vacas que están produciendo leche.",
  Secadas: "Vacas fuera de ordeño antes del parto.",
  Vaconas: "Animales jóvenes en desarrollo.",
  Terneros: "Crías y animales pequeños."
};

const screenShell = "fixed inset-0 z-50 overflow-y-auto bg-stone-50";
const emptyForm: NewAnimalForm = { name: "", sex: "", approximateAgeMonths: "" };

const groupForAnimal = (animal: Animal, groups: HerdGroup[]): string | undefined => animal.herdGroupId ?? groups[0]?.id;

const GroupManager = ({
  groups,
  session,
  onClose,
  onCreated,
  onMessage
}: {
  groups: HerdGroup[];
  session: FarmSession;
  onClose: () => void;
  onCreated: (groupId: string) => void;
  onMessage: (message: string) => void;
}) => {
  const [editingGroupId, setEditingGroupId] = useState<string>();
  const [editingGroupName, setEditingGroupName] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [error, setError] = useState<string>();

  const saveGroupName = async () => {
    const group = groups.find((item) => item.id === editingGroupId);
    if (!group) return;
    setError(undefined);
    try {
      const updated = await renameHerdGroup(db, group, editingGroupName);
      setEditingGroupId(undefined);
      onMessage(`El grupo ahora se llama ${updated.name}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cambiar el nombre.");
    }
  };

  const moveGroup = async (groupId: string, direction: -1 | 1) => {
    setError(undefined);
    try {
      await reorderHerdGroup(db, groups, groupId, direction);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo ordenar los grupos.");
    }
  };

  const addGroup = async () => {
    setError(undefined);
    try {
      const group = await createHerdGroup(db, session.farmId, session.userId, newGroupName);
      setNewGroupName("");
      onCreated(group.id);
      onMessage(`El grupo ${group.name} quedó creado.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo crear el grupo.");
    }
  };

  return <div className={screenShell} role="dialog" aria-modal="true" aria-label="Administrar grupos">
    <div className="mx-auto min-h-full max-w-2xl p-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))] sm:p-6">
      <header className="flex items-center gap-3 border-b border-stone-200 pb-4">
        <Button type="button" className="min-h-11 shrink-0 bg-white px-3 text-stone-800 ring-1 ring-stone-200" onClick={onClose} aria-label="Volver a animales">
          <ArrowLeft size={20} aria-hidden="true" />
        </Button>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-lime-800">Organización</p>
          <h1 className="text-2xl font-black tracking-tight text-stone-950">Grupos de animales</h1>
        </div>
      </header>

      <div className="mt-6 space-y-5">
        <section className="rounded-3xl border border-stone-200 bg-white p-4 shadow-[0_8px_28px_rgba(28,25,23,0.06)]">
          <p className="text-sm font-bold uppercase tracking-wide text-stone-500">Orden de la lista</p>
          <p className="mt-1 text-sm leading-snug text-stone-600">Renombra los grupos o cambia el orden en que aparecen al abrir Animales.</p>
          {error ? <div className="mt-4"><Notice tone="error">{error}</Notice></div> : null}
          <div className="mt-4 overflow-hidden rounded-2xl border border-stone-100">
            {groups.map((group, index) => <div key={group.id} className={`p-4 ${index ? "border-t border-stone-100" : ""}`}>
              {editingGroupId === group.id ? <div className="flex gap-2"><TextInput autoFocus value={editingGroupName} onChange={(event) => setEditingGroupName(event.target.value)} aria-label={`Nuevo nombre para ${group.name}`} /><Button type="button" className="bg-lime-700 px-3 text-white" onClick={() => void saveGroupName()}>Guardar</Button></div> : <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-black text-stone-950">{group.name}</p><p className="mt-1 text-sm text-stone-600">{groupDescriptions[group.name] ?? "Grupo personalizado del rejo."}</p></div><Button type="button" className="min-h-10 shrink-0 bg-stone-100 px-3 text-sm text-stone-800" onClick={() => { setEditingGroupId(group.id); setEditingGroupName(group.name); }}>Renombrar</Button></div>}
              <div className="mt-3 flex gap-2">
                <Button type="button" disabled={index === 0} className="min-h-10 bg-stone-100 px-3 text-stone-800" aria-label={`Subir ${group.name}`} onClick={() => void moveGroup(group.id, -1)}><ArrowUp size={18} aria-hidden="true" /></Button>
                <Button type="button" disabled={index === groups.length - 1} className="min-h-10 bg-stone-100 px-3 text-stone-800" aria-label={`Bajar ${group.name}`} onClick={() => void moveGroup(group.id, 1)}><ArrowDown size={18} aria-hidden="true" /></Button>
              </div>
            </div>)}
          </div>
        </section>

        <section className="rounded-3xl border border-lime-200 bg-lime-50 p-4">
          <p className="text-sm font-bold uppercase tracking-wide text-lime-900">Nuevo grupo</p>
          <h2 className="mt-1 text-xl font-black text-stone-950">Crear otro grupo</h2>
          <div className="mt-4 flex gap-2"><TextInput value={newGroupName} onChange={(event) => setNewGroupName(event.target.value)} placeholder="Ejemplo: Toros" /><Button type="button" className="shrink-0 bg-lime-700 px-3 text-white" onClick={() => void addGroup()}><Plus size={19} aria-hidden="true" />Crear</Button></div>
        </section>
      </div>
    </div>
  </div>;
};

export const NewAnimalWizard = ({ groups, session, onClose, onSaved }: { groups: HerdGroup[]; session: FarmSession; onClose: () => void; onSaved: (message: string) => void }) => {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [form, setForm] = useState<NewAnimalForm>(emptyForm);
  const [error, setError] = useState<string>();
  const selectedGroup = groups.find((group) => group.id === form.herdGroupId);
  const update = (next: Partial<NewAnimalForm>) => setForm((current) => ({ ...current, ...next }));
  const advance = () => {
    setError(undefined);
    if (step === 0 && !form.herdGroupId) return setError("Elige el grupo al que se integra el animal.");
    if (step === 1 && !form.name.trim()) return setError("Escribe al menos el nombre o apodo.");
    setStep((current) => current === 0 ? 1 : 2);
  };
  const save = async () => {
    setError(undefined);
    try {
      await saveAnimal(db, { farmId: session.farmId, userId: session.userId, name: form.name, sex: form.sex || undefined, approximateAgeMonths: form.approximateAgeMonths ? Number(form.approximateAgeMonths) : undefined, herdGroupId: form.herdGroupId });
      onSaved(`${form.name.trim()} quedó agregada a ${selectedGroup?.name ?? "su grupo"}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar el animal.");
    }
  };
  const heading = step === 0 ? "¿A qué grupo se integra?" : step === 1 ? "¿Cómo la conoces?" : "Revisa antes de guardar";

  return <div className={screenShell} role="dialog" aria-modal="true" aria-label="Agregar animal">
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-stone-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
      <Button type="button" className="min-h-11 shrink-0 bg-stone-100 px-3 text-stone-800" onClick={onClose} aria-label="Cerrar agregar animal"><X size={19} aria-hidden="true" /></Button>
      <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-lime-800">Agregar animal · paso {step + 1} de 3</p><h1 className="text-xl font-black text-stone-950 sm:text-2xl">{heading}</h1></div>
    </header>
    <div className="mx-auto max-w-2xl p-4 pb-10 pt-6 sm:p-6">
      {error ? <div className="mb-5"><Notice tone="error">{error}</Notice></div> : null}
      <Card>
        {step === 0 ? <><p className="text-base text-stone-600">Primero organiza dónde verás al animal. Podrás cambiarlo luego desde la ficha.</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{groups.map((group) => <button key={group.id} type="button" aria-pressed={form.herdGroupId === group.id} className={`min-h-24 rounded-2xl border p-4 text-left transition ${form.herdGroupId === group.id ? "border-lime-700 bg-lime-100 text-lime-950 ring-2 ring-lime-300" : "border-stone-200 bg-stone-50 text-stone-950"}`} onClick={() => update({ herdGroupId: group.id })}><span className="block text-lg font-black">{group.name}</span><span className="mt-1 block text-sm leading-snug text-stone-600">{groupDescriptions[group.name] ?? "Grupo personalizado del rejo."}</span></button>)}</div><Button type="button" className="mt-6 w-full bg-lime-700 text-white" onClick={advance}><ChevronRight size={20} aria-hidden="true" />Continuar</Button></> : step === 1 ? <><div><FieldLabel>Nombre o apodo</FieldLabel><TextInput autoFocus value={form.name} onChange={(event) => update({ name: event.target.value })} placeholder="Ejemplo: Pintada" /></div><div className="mt-6"><FieldLabel>Sexo <span className="normal-case tracking-normal">(opcional)</span></FieldLabel><div className="grid grid-cols-2 gap-3"><Button type="button" aria-pressed={form.sex === "female"} className={form.sex === "female" ? "bg-lime-700 text-white" : "bg-stone-100 text-stone-800"} onClick={() => update({ sex: "female" })}>Hembra</Button><Button type="button" aria-pressed={form.sex === "male"} className={form.sex === "male" ? "bg-lime-700 text-white" : "bg-stone-100 text-stone-800"} onClick={() => update({ sex: "male" })}>Macho</Button></div></div><div className="mt-6 flex gap-3"><Button type="button" className="bg-stone-100 text-stone-800" onClick={() => setStep(0)}>Atrás</Button><Button type="button" className="flex-1 bg-lime-700 text-white" onClick={advance}>Siguiente<ChevronRight size={20} aria-hidden="true" /></Button></div></> : <><p className="text-base text-stone-600">La edad es opcional. Lo demás ya está listo.</p><div className="mt-6"><FieldLabel>Edad aproximada en meses <span className="normal-case tracking-normal">(opcional)</span></FieldLabel><TextInput autoFocus inputMode="numeric" min="0" type="number" value={form.approximateAgeMonths} onChange={(event) => update({ approximateAgeMonths: event.target.value })} placeholder="Ejemplo: 36" /></div><div className="mt-6 rounded-2xl bg-stone-100 p-4"><p className="text-sm font-bold uppercase tracking-wide text-stone-500">Se agregará</p><p className="mt-1 text-2xl font-black text-stone-950">{form.name}</p><p className="mt-1 text-base text-stone-600">{selectedGroup?.name} · {form.sex === "female" ? "Hembra" : form.sex === "male" ? "Macho" : "Sexo pendiente"}</p><button type="button" className="mt-3 text-base font-bold text-lime-800 underline" onClick={() => setStep(0)}>Cambiar grupo</button></div><div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row"><Button type="button" className="bg-stone-100 text-stone-800" onClick={() => setStep(1)}>Atrás</Button><Button type="button" className="flex-1 bg-lime-700 text-white" onClick={() => void save()}><CirclePlus size={20} aria-hidden="true" />Agregar animal</Button></div></>}
      </Card>
    </div>
  </div>;
};

const AnimalRow = ({ animal, groupName, showGroup, onOpen }: { animal: Animal; groupName: string; showGroup: boolean; onOpen: () => void }) => (
  <button type="button" aria-label={`Abrir ficha de ${animal.name}`} className="flex min-h-20 w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-lime-50 active:bg-lime-50 sm:px-5" onClick={onOpen}>
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lime-100 text-base font-black text-lime-950">{animal.name.slice(0, 1).toUpperCase()}</span>
    <span className="min-w-0 flex-1"><span className="block truncate text-base font-black text-stone-950">{animal.name}</span><span className="mt-1 block text-sm text-stone-600">{animal.sex === "female" ? "Hembra" : animal.sex === "male" ? "Macho" : "Sexo pendiente"}{showGroup ? ` · ${groupName}` : ""}</span></span>
    <ChevronRight className="shrink-0 text-stone-400" size={20} aria-hidden="true" />
  </button>
);

export const AnimalsBrowserPage = ({ session, onMilkControl }: AnimalsBrowserPageProps) => {
  const animals = useLiveQuery(() => db.animals.filter((animal) => animal.farmId === session.farmId && !animal.deletedAt).sortBy("name"), [session.farmId], []);
  const groups = useLiveQuery(() => db.herdGroups.filter((group) => group.farmId === session.farmId && !group.deletedAt).sortBy("sortOrder"), [session.farmId], []);
  const [activeGroupId, setActiveGroupId] = useState<string>();
  const [selectedAnimal, setSelectedAnimal] = useState<Animal>();
  const [editedAnimal, setEditedAnimal] = useState<Animal>();
  const [isCreating, setIsCreating] = useState(false);
  const [isManagingGroups, setIsManagingGroups] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  useEffect(() => { void ensureDefaultHerdGroups(db, session.farmId, session.userId); }, [session.farmId, session.userId]);

  const selectedGroupId = activeGroupId ?? groups[0]?.id;
  const selectedGroup = groups.find((group) => group.id === selectedGroupId);
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase("es-EC");
  const visibleAnimals = useMemo(() => normalizedQuery
    ? animals.filter((animal) => animal.name.toLocaleLowerCase("es-EC").includes(normalizedQuery))
    : animals.filter((animal) => groupForAnimal(animal, groups) === selectedGroupId), [animals, groups, normalizedQuery, selectedGroupId]);
  const visibleTitle = normalizedQuery ? "Resultados" : selectedGroup?.name ?? "Grupo";
  const visibleDetail = normalizedQuery ? `${visibleAnimals.length} ${visibleAnimals.length === 1 ? "animal encontrado" : "animales encontrados"}` : `${visibleAnimals.length} ${visibleAnimals.length === 1 ? "animal" : "animales"}`;
  const groupNameFor = (animal: Animal) => groups.find((group) => group.id === groupForAnimal(animal, groups))?.name ?? "Sin grupo";
  const groupCount = (groupId: string) => animals.filter((animal) => groupForAnimal(animal, groups) === groupId).length;

  const finishCreate = (nextMessage: string) => { setIsCreating(false); setMessage(nextMessage); };
  const archive = async (animal: Animal) => {
    if (!window.confirm(`¿Quieres sacar a ${animal.name} de la lista?`)) return;
    setMessage(undefined);
    setError(undefined);
    try {
      await archiveAnimal(db, animal);
      setSelectedAnimal(undefined);
      setMessage(`${animal.name} quedó fuera de la lista, pero su historial se conserva.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo sacar el animal de la lista.");
    }
  };

  return <div className="space-y-5">
    <header className="flex items-center justify-between gap-3 px-1">
      <div><h1 className="text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">Animales</h1><p className="mt-1 text-sm font-semibold text-stone-500">{animals.length} {animals.length === 1 ? "activo" : "activos"}</p></div>
      <div className="flex items-center gap-2"><Button type="button" className="min-h-11 bg-white px-3 text-stone-800 ring-1 ring-stone-200" aria-label="Buscar animal" onClick={() => setIsSearching(true)}><Search size={20} aria-hidden="true" /></Button><Button type="button" className="min-h-11 bg-white px-3 text-stone-800 ring-1 ring-stone-200" aria-label="Administrar grupos" onClick={() => setIsManagingGroups(true)}><SlidersHorizontal size={20} aria-hidden="true" /></Button></div>
    </header>

    {isSearching ? <div className="flex items-center gap-2 rounded-2xl border border-lime-200 bg-lime-50 p-2"><Search className="ml-2 shrink-0 text-lime-800" size={20} aria-hidden="true" /><TextInput autoFocus className="border-0 bg-transparent px-2 focus:bg-white" aria-label="Buscar por nombre" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Buscar por nombre" /><Button type="button" className="min-h-11 shrink-0 bg-white px-3 text-stone-800" aria-label="Cerrar búsqueda" onClick={() => { setIsSearching(false); setSearchQuery(""); }}><X size={19} aria-hidden="true" /></Button></div> : null}

    {message ? <Notice tone="success">{message}</Notice> : null}
    {error ? <Notice tone="error">{error}</Notice> : null}

    <Button type="button" className="w-full bg-lime-700 text-white shadow-[0_12px_25px_rgba(77,124,15,0.2)] hover:bg-lime-800" onClick={() => setIsCreating(true)}><CirclePlus size={20} aria-hidden="true" />Agregar animal</Button>

    <section aria-labelledby="animal-groups-title">
      <div className="flex items-center justify-between gap-3 px-1"><p id="animal-groups-title" className="text-sm font-bold uppercase tracking-wide text-stone-500">Grupos</p><button type="button" className="min-h-10 rounded-xl px-2 text-sm font-bold text-lime-800" onClick={() => setIsManagingGroups(true)}>Administrar</button></div>
      <div className="mt-2 flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Grupos de animales">{groups.map((group) => <button key={group.id} type="button" aria-pressed={selectedGroupId === group.id} className={`min-h-11 shrink-0 rounded-2xl px-4 text-base font-bold transition ${selectedGroupId === group.id && !normalizedQuery ? "bg-lime-700 text-white" : "bg-white text-stone-700 ring-1 ring-stone-200"}`} onClick={() => { setActiveGroupId(group.id); setSearchQuery(""); }}>{group.name} <span className="opacity-70">{groupCount(group.id)}</span></button>)}</div>
    </section>

    <section aria-labelledby="animal-list-title">
      <div className="flex items-end justify-between gap-3 px-1"><div><p className="text-sm font-bold uppercase tracking-wide text-stone-500">{normalizedQuery ? "Buscar en el rejo" : "Lista del grupo"}</p><h2 id="animal-list-title" className="mt-1 text-xl font-black text-stone-950">{visibleTitle}</h2></div><div className="flex items-center gap-1"><span className="text-sm font-semibold text-stone-500">{visibleDetail}</span>{onMilkControl ? <button type="button" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-2 text-sm font-bold text-lime-800" onClick={onMilkControl}><ClipboardPenLine size={17} aria-hidden="true" /><span className="hidden sm:inline">Control</span></button> : null}</div></div>
      <div className="mt-3 overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-[0_8px_28px_rgba(28,25,23,0.06)]">{visibleAnimals.length === 0 ? <div className="p-5"><p className="font-black text-stone-950">{normalizedQuery ? "No encontramos ese animal." : "Este grupo está vacío."}</p><p className="mt-1 text-sm leading-snug text-stone-600">{normalizedQuery ? "Prueba con otro nombre o abre el grupo donde está registrado." : "Agrega un animal y primero elige el grupo al que se integra."}</p></div> : visibleAnimals.map((animal, index) => <div key={animal.id} className={index ? "border-t border-stone-100" : ""}><AnimalRow animal={animal} groupName={groupNameFor(animal)} showGroup={Boolean(normalizedQuery)} onOpen={() => setSelectedAnimal(animal)} /></div>)}</div>
    </section>

    {selectedAnimal ? <AnimalDetail animal={selectedAnimal} groups={groups} session={session} onClose={() => setSelectedAnimal(undefined)} onEdit={() => { setEditedAnimal(selectedAnimal); setSelectedAnimal(undefined); }} onArchive={() => void archive(selectedAnimal)} /> : null}
    {editedAnimal ? <AnimalEditor animal={editedAnimal} groups={groups} defaultGroupId={selectedGroupId} session={session} onClose={() => setEditedAnimal(undefined)} onSaved={(nextMessage) => { setEditedAnimal(undefined); setMessage(nextMessage); }} /> : null}
    {isCreating ? <NewAnimalWizard groups={groups} session={session} onClose={() => setIsCreating(false)} onSaved={finishCreate} /> : null}
    {isManagingGroups ? <GroupManager groups={groups} session={session} onClose={() => setIsManagingGroups(false)} onCreated={(groupId) => { setActiveGroupId(groupId); setIsManagingGroups(false); }} onMessage={setMessage} /> : null}
  </div>;
};
