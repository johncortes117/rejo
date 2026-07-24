import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Archive, ArrowDown, ArrowUp, ChevronRight, CirclePlus, ClipboardPenLine, Plus, SlidersHorizontal, X } from "lucide-react";
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

const screenShell = "fixed inset-0 z-50 overflow-y-auto bg-stone-100";
const emptyForm: NewAnimalForm = { name: "", sex: "", approximateAgeMonths: "" };

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

  return <div className={screenShell} role="dialog" aria-modal="true" aria-label="Agregar animal"><header className="sticky top-0 z-10 flex items-center gap-4 border-b border-stone-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6"><Button type="button" className="shrink-0 bg-stone-100 px-4 text-stone-800" onClick={onClose} aria-label="Cerrar"><X size={19} aria-hidden="true" />Cerrar</Button><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-lime-800">Agregar animal · paso {step + 1} de 3</p><h1 className="text-xl font-black text-stone-950 sm:text-2xl">{heading}</h1></div></header><main className="mx-auto max-w-2xl p-4 pb-10 pt-6 sm:p-6">{error ? <div className="mb-5"><Notice tone="error">{error}</Notice></div> : null}<Card>{step === 0 ? <><p className="text-base text-stone-600">El grupo organiza la lista; puedes cambiarlo más adelante desde la ficha.</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{groups.map((group) => <button key={group.id} type="button" aria-pressed={form.herdGroupId === group.id} className={`min-h-24 rounded-2xl border p-4 text-left transition ${form.herdGroupId === group.id ? "border-lime-700 bg-lime-100 text-lime-950 ring-2 ring-lime-300" : "border-stone-200 bg-stone-50 text-stone-950"}`} onClick={() => update({ herdGroupId: group.id })}><span className="block text-lg font-black">{group.name}</span><span className="mt-1 block text-sm leading-snug text-stone-600">{groupDescriptions[group.name] ?? "Grupo personalizado del rejo."}</span></button>)}</div><Button type="button" className="mt-6 w-full bg-lime-700 text-white" onClick={advance}><ChevronRight size={20} aria-hidden="true" />Continuar</Button></> : step === 1 ? <><div><FieldLabel>Nombre o apodo</FieldLabel><TextInput autoFocus value={form.name} onChange={(event) => update({ name: event.target.value })} placeholder="Ejemplo: Pintada" /></div><div className="mt-6"><FieldLabel>Sexo <span className="normal-case tracking-normal">(opcional)</span></FieldLabel><div className="grid grid-cols-2 gap-3"><Button type="button" aria-pressed={form.sex === "female"} className={form.sex === "female" ? "bg-lime-700 text-white" : "bg-stone-100 text-stone-800"} onClick={() => update({ sex: "female" })}>Hembra</Button><Button type="button" aria-pressed={form.sex === "male"} className={form.sex === "male" ? "bg-lime-700 text-white" : "bg-stone-100 text-stone-800"} onClick={() => update({ sex: "male" })}>Macho</Button></div></div><div className="mt-6 flex gap-3"><Button type="button" className="bg-stone-100 text-stone-800" onClick={() => setStep(0)}>Atrás</Button><Button type="button" className="flex-1 bg-lime-700 text-white" onClick={advance}>Siguiente<ChevronRight size={20} aria-hidden="true" /></Button></div></> : <><p className="text-base text-stone-600">Solo la edad es opcional. Lo demás ya está listo.</p><div className="mt-6"><FieldLabel>Edad aproximada en meses <span className="normal-case tracking-normal">(opcional)</span></FieldLabel><TextInput autoFocus inputMode="numeric" min="0" type="number" value={form.approximateAgeMonths} onChange={(event) => update({ approximateAgeMonths: event.target.value })} placeholder="Ejemplo: 36" /></div><div className="mt-6 rounded-2xl bg-stone-100 p-4"><p className="text-sm font-bold uppercase tracking-wide text-stone-500">Se agregará</p><p className="mt-1 text-2xl font-black text-stone-950">{form.name}</p><p className="mt-1 text-base text-stone-600">{selectedGroup?.name} · {form.sex === "female" ? "Hembra" : form.sex === "male" ? "Macho" : "Sexo pendiente"}</p><button type="button" className="mt-3 text-base font-bold text-lime-800 underline" onClick={() => setStep(0)}>Cambiar grupo</button></div><div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row"><Button type="button" className="bg-stone-100 text-stone-800" onClick={() => setStep(1)}>Atrás</Button><Button type="button" className="flex-1 bg-lime-700 text-white" onClick={() => void save()}><CirclePlus size={20} aria-hidden="true" />Agregar animal</Button></div></>}</Card></main></div>;
};

export const AnimalsBrowserPage = ({ session, onMilkControl }: AnimalsBrowserPageProps) => {
  const animals = useLiveQuery(() => db.animals.filter((animal) => animal.farmId === session.farmId && !animal.deletedAt).sortBy("name"), [session.farmId], []);
  const groups = useLiveQuery(() => db.herdGroups.filter((group) => group.farmId === session.farmId && !group.deletedAt).sortBy("sortOrder"), [session.farmId], []);
  const [activeGroupId, setActiveGroupId] = useState<string>();
  const [selectedAnimal, setSelectedAnimal] = useState<Animal>();
  const [editedAnimal, setEditedAnimal] = useState<Animal>();
  const [isCreating, setIsCreating] = useState(false);
  const [isManagingGroups, setIsManagingGroups] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string>();
  const [editingGroupName, setEditingGroupName] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [message, setMessage] = useState<string>();
  useEffect(() => { void ensureDefaultHerdGroups(db, session.farmId, session.userId); }, [session.farmId, session.userId]);
  const selectedGroupId = activeGroupId ?? groups[0]?.id;
  const selectedGroup = groups.find((group) => group.id === selectedGroupId);
  const visibleAnimals = animals.filter((animal) => (animal.herdGroupId ?? groups[0]?.id) === selectedGroupId);
  const finishCreate = (nextMessage: string) => { setIsCreating(false); setMessage(nextMessage); };
  const archive = async (animal: Animal) => {
    if (!window.confirm(`¿Quieres sacar a ${animal.name} de la lista?`)) return;
    await archiveAnimal(db, animal);
    setSelectedAnimal(undefined);
    setMessage(`${animal.name} quedó fuera de la lista, pero su historial se conserva.`);
  };
  const addGroup = async () => { try { const group = await createHerdGroup(db, session.farmId, session.userId, newGroupName); setNewGroupName(""); setActiveGroupId(group.id); setMessage(`El grupo ${group.name} quedó creado.`); } catch (caught) { setMessage(caught instanceof Error ? caught.message : "No se pudo crear el grupo."); } };
  const saveGroupName = async () => { const group = groups.find((item) => item.id === editingGroupId); if (!group) return; try { const updated = await renameHerdGroup(db, group, editingGroupName); setEditingGroupId(undefined); setMessage(`El grupo ahora se llama ${updated.name}.`); } catch (caught) { setMessage(caught instanceof Error ? caught.message : "No se pudo cambiar el nombre."); } };

  return <div className="space-y-5"><header className="flex items-center justify-between gap-3 px-1"><h1 className="text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">Tus vacas</h1><Button type="button" className="min-h-11 bg-stone-100 px-3 text-stone-800" aria-label="Administrar grupos" onClick={() => setIsManagingGroups((current) => !current)}><SlidersHorizontal size={20} aria-hidden="true" /></Button></header>{message ? <Notice tone="success">{message}</Notice> : null}<div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{groups.map((group) => <button key={group.id} type="button" aria-pressed={selectedGroupId === group.id} className={`min-h-11 shrink-0 rounded-2xl px-4 text-base font-bold ${selectedGroupId === group.id ? "bg-lime-700 text-white" : "bg-white text-stone-700 ring-1 ring-stone-200"}`} onClick={() => setActiveGroupId(group.id)}>{group.name} <span className="opacity-70">{animals.filter((animal) => (animal.herdGroupId ?? groups[0]?.id) === group.id).length}</span></button>)}</div>{isManagingGroups ? <Card><p className="text-sm font-bold uppercase tracking-wide text-stone-500">Administrar grupos</p><div className="mt-4 space-y-3">{groups.map((group, index) => <div key={group.id} className="rounded-2xl bg-stone-50 p-3"><div className="flex gap-2"><TextInput value={editingGroupId === group.id ? editingGroupName : group.name} disabled={editingGroupId !== group.id} onChange={(event) => setEditingGroupName(event.target.value)} /><Button type="button" className="bg-white px-3 text-stone-800" onClick={() => editingGroupId === group.id ? void saveGroupName() : (setEditingGroupId(group.id), setEditingGroupName(group.name))}>{editingGroupId === group.id ? "Guardar" : "Renombrar"}</Button></div><div className="mt-2 flex gap-2"><Button type="button" disabled={index === 0} className="min-h-10 bg-white px-3 text-stone-800" onClick={() => void reorderHerdGroup(db, groups, group.id, -1)}><ArrowUp size={18} aria-hidden="true" />Subir</Button><Button type="button" disabled={index === groups.length - 1} className="min-h-10 bg-white px-3 text-stone-800" onClick={() => void reorderHerdGroup(db, groups, group.id, 1)}><ArrowDown size={18} aria-hidden="true" />Bajar</Button></div></div>)}</div><div className="mt-5 flex gap-2"><TextInput value={newGroupName} onChange={(event) => setNewGroupName(event.target.value)} placeholder="Nuevo grupo" /><Button type="button" className="bg-stone-900 text-white" onClick={() => void addGroup()}><Plus size={19} aria-hidden="true" />Crear</Button></div></Card> : null}<div className="flex items-center justify-between gap-3"><p className="text-sm font-bold uppercase tracking-wide text-stone-500">{selectedGroup?.name ?? "Grupo"} · {visibleAnimals.length} {visibleAnimals.length === 1 ? "animal" : "animales"}</p>{onMilkControl ? <button type="button" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-2 text-sm font-bold text-lime-800" onClick={onMilkControl}><ClipboardPenLine size={17} aria-hidden="true" />Control</button> : null}</div><section className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-[0_8px_28px_rgba(28,25,23,0.06)]">{visibleAnimals.length === 0 ? <div className="p-5 text-base text-stone-600">No hay animales en este grupo todavía.</div> : visibleAnimals.map((animal, index) => <button key={animal.id} type="button" className={`flex min-h-20 w-full items-center gap-3 px-5 text-left transition hover:bg-lime-50 active:bg-lime-100 ${index ? "border-t border-stone-100" : ""}`} onClick={() => setSelectedAnimal(animal)}><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-lime-100 text-lg font-black text-lime-950">{animal.name.slice(0, 1).toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate text-xl font-black text-stone-950">{animal.name}</span>{animal.sex ? <span className="mt-0.5 block text-sm font-medium text-stone-500">{animal.sex === "female" ? "Hembra" : "Macho"}</span> : null}</span><ChevronRight className="shrink-0 text-stone-400" size={22} aria-hidden="true" /></button>)}</section><Button type="button" className="w-full bg-lime-700 text-white shadow-[0_12px_25px_rgba(77,124,15,0.2)] hover:bg-lime-800" onClick={() => setIsCreating(true)}><CirclePlus size={20} aria-hidden="true" />Agregar</Button>{selectedAnimal ? <><AnimalDetail animal={selectedAnimal} groups={groups} session={session} onClose={() => setSelectedAnimal(undefined)} onEdit={() => { setEditedAnimal(selectedAnimal); setSelectedAnimal(undefined); }} /><Button type="button" className="fixed bottom-5 left-4 right-4 z-[60] bg-red-800 text-white shadow-lg sm:left-auto sm:right-6" onClick={() => void archive(selectedAnimal)}><Archive size={20} aria-hidden="true" />Sacar de la lista</Button></> : null}{editedAnimal ? <AnimalEditor animal={editedAnimal} groups={groups} defaultGroupId={selectedGroupId} session={session} onClose={() => setEditedAnimal(undefined)} onSaved={(nextMessage) => { setEditedAnimal(undefined); setMessage(nextMessage); }} /> : null}{isCreating ? <NewAnimalWizard groups={groups} session={session} onClose={() => setIsCreating(false)} onSaved={finishCreate} /> : null}</div>;
};
