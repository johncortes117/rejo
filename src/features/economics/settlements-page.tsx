import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { BadgeDollarSign, Calculator, CirclePlus, ReceiptText, Save } from "lucide-react";
import { Button, Card, FieldLabel, Notice, TextInput } from "@/components/ui";
import type { FarmSession } from "@/domain/models";
import { db } from "@/db/rejo-db";
import { nowInFarmTimezone } from "@/domain/time";
import { ensureDefaultPriceSettings, recordSettlement } from "@/features/economics/settlements";

export const SettlementsPage = ({ session }: { session: FarmSession }) => {
  const { date: today } = nowInFarmTimezone();
  const farm = useLiveQuery(() => db.farms.get(session.farmId), [session.farmId]);
  const buyer = useLiveQuery(() => db.buyers.filter((item) => item.farmId === session.farmId && !item.deletedAt).first(), [session.farmId]);
  const settlements = useLiveQuery(() => db.settlements.filter((item) => item.farmId === session.farmId && !item.deletedAt).reverse().sortBy("periodEnd"), [session.farmId], []);
  const [periodStart, setPeriodStart] = useState(today);
  const [periodEnd, setPeriodEnd] = useState(today);
  const [liters, setLiters] = useState("");
  const [price, setPrice] = useState("");
  const [fat, setFat] = useState("");
  const [protein, setProtein] = useState("");
  const [ufc, setUfc] = useState("");
  const [ccs, setCcs] = useState("");
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => { void ensureDefaultPriceSettings(db, session.farmId, session.userId); }, [session.farmId, session.userId]);

  const save = async () => {
    if (!farm || !buyer) return;
    setMessage(undefined); setError(undefined);
    try {
      const settlement = await recordSettlement(db, { farmId: session.farmId, userId: session.userId, buyerId: buyer.id, farm, periodStart, periodEnd, litersPaid: Number(liters), pricePerLiterPaid: Number(price), quality: { fatPct: fat ? Number(fat) : undefined, proteinPct: protein ? Number(protein) : undefined, ufc: ufc ? Number(ufc) : undefined, ccs: ccs ? Number(ccs) : undefined } });
      setMessage(`Liquidación guardada. Precio justo calculado: $${settlement.legalPriceComputed?.toFixed(4)}/L.`);
      setLiters(""); setPrice(""); setFat(""); setProtein(""); setUfc(""); setCcs("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo guardar la liquidación."); }
  };

  return <div className="space-y-5"><div className="px-1"><p className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-[0.16em] text-lime-800"><BadgeDollarSign size={16} aria-hidden="true" />Finanzas</p><h1 className="mt-1 text-3xl font-black tracking-tight text-stone-950">Liquidaciones</h1><p className="mt-2 text-base text-stone-600">Compara lo que pagó {buyer?.name ?? "el comprador"} con el precio justo de esa fecha.</p></div>{message ? <Notice tone="success">{message}</Notice> : null}{error ? <Notice tone="error">{error}</Notice> : null}<Card><p className="text-sm font-bold uppercase tracking-wide text-stone-500">Nueva factura</p><h2 className="mt-1 flex items-center gap-2 text-2xl font-black text-stone-950"><ReceiptText size={24} aria-hidden="true" />Registrar liquidación</h2><div className="mt-5 grid gap-5 sm:grid-cols-2"><div><FieldLabel>Inicio del período</FieldLabel><TextInput type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} /></div><div><FieldLabel>Fin del período</FieldLabel><TextInput type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></div><div><FieldLabel>Litros pagados</FieldLabel><TextInput inputMode="decimal" type="number" min="0" step="0.1" value={liters} onChange={(event) => setLiters(event.target.value)} placeholder="Ejemplo: 2800" /></div><div><FieldLabel>Precio pagado por litro</FieldLabel><TextInput inputMode="decimal" type="number" min="0" step="0.0001" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="Ejemplo: 0.4500" /></div></div><details className="mt-6 rounded-2xl bg-stone-50 p-4"><summary className="flex cursor-pointer items-center gap-2 text-base font-bold text-stone-700"><CirclePlus size={19} aria-hidden="true" />Agregar resultados de calidad</summary><p className="mt-2 text-sm text-stone-600">Cópialos de la factura para calcular el precio justo con más precisión.</p><div className="mt-5 grid gap-5 sm:grid-cols-2"><div><FieldLabel>Grasa %</FieldLabel><TextInput inputMode="decimal" type="number" step="0.01" value={fat} onChange={(event) => setFat(event.target.value)} /></div><div><FieldLabel>Proteína %</FieldLabel><TextInput inputMode="decimal" type="number" step="0.01" value={protein} onChange={(event) => setProtein(event.target.value)} /></div><div><FieldLabel>UFC/ml</FieldLabel><TextInput inputMode="numeric" type="number" value={ufc} onChange={(event) => setUfc(event.target.value)} /></div><div><FieldLabel>CCS/ml</FieldLabel><TextInput inputMode="numeric" type="number" value={ccs} onChange={(event) => setCcs(event.target.value)} /></div></div></details><Button type="button" className="mt-6 w-full bg-lime-700 text-white" onClick={() => void save()}><Save size={20} aria-hidden="true" />Guardar y conciliar</Button></Card><section><p className="px-1 text-sm font-bold uppercase tracking-wide text-stone-500">Historial</p><h2 className="mt-1 px-1 text-2xl font-black text-stone-950">Últimas liquidaciones</h2><div className="mt-3 space-y-3">{settlements.length === 0 ? <Notice tone="info">Aún no hay liquidaciones registradas.</Notice> : settlements.map((settlement) => <Card key={settlement.id}><div className="flex items-start justify-between gap-3"><div><p className="text-xl font-black text-stone-950">{settlement.periodStart} al {settlement.periodEnd}</p><p className="mt-1 text-base text-stone-600">{settlement.litersPaid.toFixed(1)} L · Pagado: ${settlement.pricePerLiterPaid.toFixed(4)}/L</p></div><Calculator className="shrink-0 text-lime-700" size={24} aria-hidden="true" /></div>{settlement.legalPriceComputed !== undefined ? <div className="mt-4 rounded-2xl bg-stone-100 p-4"><p className="text-sm font-bold uppercase tracking-wide text-stone-500">Precio justo calculado</p><p className="mt-1 text-2xl font-black text-stone-950">${settlement.legalPriceComputed.toFixed(4)}/L</p><p className={`mt-1 text-base font-semibold ${settlement.legalVariancePerLiter && settlement.legalVariancePerLiter > 0 ? "text-amber-800" : "text-lime-800"}`}>{settlement.legalVariancePerLiter && settlement.legalVariancePerLiter > 0 ? `Diferencia: $${settlement.legalVariancePerLiter.toFixed(4)}/L por debajo.` : "El pago coincide o supera el cálculo."}</p></div> : null}</Card>)}</div></section></div>;
};
