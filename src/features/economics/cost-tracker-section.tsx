import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowDownCircle, ArrowUpCircle, Calculator, Save } from "lucide-react";
import { Button, Card, FieldLabel, Notice, TextInput } from "@/components/ui";
import type { FarmSession } from "@/domain/models";
import { db } from "@/db/rejo-db";
import { nowInFarmTimezone } from "@/domain/time";
import { calculateCostSummary, recordTransaction } from "@/features/economics/costs";

export const CostTrackerSection = ({ session }: { session: FarmSession }) => {
  const { date } = nowInFarmTimezone();
  const [direction, setDirection] = useState<"expense" | "income">("expense");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const transactions = useLiveQuery(() => db.transactions.filter((item) => item.farmId === session.farmId && !item.deletedAt).toArray(), [session.farmId], []);
  const assets = useLiveQuery(() => db.assets.filter((item) => item.farmId === session.farmId && !item.deletedAt).toArray(), [session.farmId], []);
  const labor = useLiveQuery(() => db.labor.filter((item) => item.farmId === session.farmId && !item.deletedAt).toArray(), [session.farmId], []);
  const readings = useLiveQuery(() => db.tankReadings.filter((item) => item.farmId === session.farmId && !item.deletedAt && item.readBy === "farm" && item.moment === "at_pickup").toArray(), [session.farmId], []);
  const summary = calculateCostSummary(transactions, assets, labor, readings.reduce((total, item) => total + item.liters, 0));
  const save = async () => { setMessage(undefined); setError(undefined); try { await recordTransaction(db, { farmId: session.farmId, userId: session.userId, date, direction, category, amount: Number(amount), isEstimated: false }); setCategory(""); setAmount(""); setMessage("El movimiento quedó guardado en el celular."); } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo guardar el movimiento."); } };

  return <section className="space-y-4"><div className="px-1"><p className="text-sm font-bold uppercase tracking-wide text-stone-500">Costos e ingresos</p><h2 className="mt-1 text-2xl font-black text-stone-950">Costo por litro</h2></div>{message ? <Notice tone="success">{message}</Notice> : null}{error ? <Notice tone="error">{error}</Notice> : null}<div className="grid gap-3 sm:grid-cols-3"><Card><p className="text-sm font-bold uppercase tracking-wide text-stone-500">Caja</p><p className="mt-1 text-3xl font-black text-stone-950">{summary.cashPerLiter === undefined ? "—" : `$${summary.cashPerLiter.toFixed(2)}`}</p></Card><Card><p className="text-sm font-bold uppercase tracking-wide text-stone-500">Con depreciación</p><p className="mt-1 text-3xl font-black text-stone-950">{summary.withDepreciationPerLiter === undefined ? "—" : `$${summary.withDepreciationPerLiter.toFixed(2)}`}</p></Card><Card><p className="text-sm font-bold uppercase tracking-wide text-stone-500">Con trabajo familiar</p><p className="mt-1 text-3xl font-black text-stone-950">{summary.fullPerLiter === undefined ? "—" : `$${summary.fullPerLiter.toFixed(2)}`}</p></Card></div><Card><p className="text-sm font-bold uppercase tracking-wide text-stone-500">Movimiento rápido</p><h3 className="mt-1 flex items-center gap-2 text-2xl font-black text-stone-950"><Calculator size={24} aria-hidden="true" />¿Qué pasó hoy?</h3><div className="mt-5 grid grid-cols-2 gap-3"><Button type="button" aria-pressed={direction === "expense"} className={direction === "expense" ? "bg-red-800 text-white" : "bg-stone-100 text-stone-800"} onClick={() => setDirection("expense")}><ArrowDownCircle size={19} aria-hidden="true" />Egreso</Button><Button type="button" aria-pressed={direction === "income"} className={direction === "income" ? "bg-lime-700 text-white" : "bg-stone-100 text-stone-800"} onClick={() => setDirection("income")}><ArrowUpCircle size={19} aria-hidden="true" />Ingreso</Button></div><div className="mt-5"><FieldLabel>Tipo</FieldLabel><TextInput value={category} onChange={(event) => setCategory(event.target.value)} placeholder={direction === "expense" ? "Ejemplo: Molido, medicamento o combustible" : "Ejemplo: Venta de animal"} /></div><div className="mt-5"><FieldLabel>Valor en dólares</FieldLabel><TextInput inputMode="decimal" min="0" step="0.01" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Ejemplo: 35.50" /></div><Button type="button" className="mt-6 w-full bg-lime-700 text-white" onClick={() => void save()}><Save size={20} aria-hidden="true" />Guardar movimiento</Button></Card></section>;
};
