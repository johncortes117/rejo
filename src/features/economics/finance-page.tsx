import { useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowDownCircle, ArrowUpCircle, BadgeDollarSign, Calculator, ChevronRight, CirclePlus, ReceiptText, Save, UsersRound, Wrench, X } from "lucide-react";
import { Button, Card, FieldLabel, Notice, TextInput } from "@/components/ui";
import { db } from "@/db/rejo-db";
import type { Farm, FarmSession, LaborRecord, Settlement, Transaction } from "@/domain/models";
import { nowInFarmTimezone } from "@/domain/time";
import { calculateCostSummary, recordAsset, recordLabor, recordTransaction } from "@/features/economics/costs";
import { ensureDefaultPriceSettings, recordSettlement } from "@/features/economics/settlements";

type FinanceSection = "summary" | "settlements" | "movements" | "costs";
type EntryKind = "settlement" | "movement" | "asset" | "labor";

const perLiter = (value: number | undefined) => value === undefined ? "—" : `$${value.toFixed(2)}`;

const FinanceTabs = ({ section, onSelect }: { section: FinanceSection; onSelect: (section: FinanceSection) => void }) => {
  const tabs: Array<{ id: FinanceSection; label: string }> = [
    { id: "summary", label: "Resumen" },
    { id: "settlements", label: "Liquidaciones" },
    { id: "movements", label: "Movimientos" },
    { id: "costs", label: "Costos" }
  ];

  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="Secciones de finanzas">
      <div className="flex min-w-max gap-2 rounded-2xl bg-stone-100 p-1.5">
        {tabs.map((tab) => <button key={tab.id} type="button" aria-pressed={section === tab.id} className={`min-h-11 rounded-xl px-4 text-sm font-bold transition ${section === tab.id ? "bg-white text-lime-950 shadow-sm" : "text-stone-600"}`} onClick={() => onSelect(tab.id)}>{tab.label}</button>)}
      </div>
    </div>
  );
};

const SectionLink = ({ title, description, value, icon: Icon, onClick, tone = "stone" }: {
  title: string;
  description: string;
  value?: string;
  icon: typeof BadgeDollarSign;
  onClick: () => void;
  tone?: "stone" | "lime" | "sky";
}) => {
  const toneClasses = {
    stone: "border-stone-200 bg-white hover:bg-stone-50",
    lime: "border-lime-200 bg-lime-50 hover:bg-lime-100",
    sky: "border-sky-200 bg-sky-50 hover:bg-sky-100"
  };

  return <button type="button" aria-label={`Abrir ${title}`} className={`flex min-h-28 w-full items-center gap-4 rounded-3xl border p-4 text-left shadow-[0_8px_28px_rgba(28,25,23,0.05)] transition active:scale-[0.99] ${toneClasses[tone]}`} onClick={onClick}><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/90 text-lime-800 shadow-sm"><Icon size={24} aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="block text-lg font-black text-stone-950">{title}</span><span className="mt-1 block text-sm leading-snug text-stone-600">{description}</span>{value ? <span className="mt-2 block text-base font-black text-lime-900">{value}</span> : null}</span><ChevronRight className="shrink-0 text-stone-400" size={22} aria-hidden="true" /></button>;
};

const EntryShell = ({ title, onClose, children }: PropsWithChildren<{ title: string; onClose: () => void }>) => (
  <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-50" role="dialog" aria-modal="true" aria-label={title}>
    <div className="mx-auto min-h-screen max-w-2xl p-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))] sm:p-6">
      <header className="flex items-center justify-between gap-4 border-b border-stone-200 pb-4">
        <div><p className="text-sm font-bold uppercase tracking-[0.16em] text-lime-800">Finanzas</p><h1 className="mt-1 text-3xl font-black tracking-tight text-stone-950">{title}</h1></div>
        <Button type="button" className="shrink-0 bg-white px-4 text-stone-800 ring-1 ring-stone-200" onClick={onClose} aria-label="Cerrar formulario"><X size={22} aria-hidden="true" /></Button>
      </header>
      <div className="pt-6">{children}</div>
    </div>
  </div>
);

const SettlementEntry = ({ session, farm, buyer, onSaved, onClose }: { session: FarmSession; farm: Farm | undefined; buyer: { id: string; name: string } | undefined; onSaved: (message: string) => void; onClose: () => void }) => {
  const { date: today } = nowInFarmTimezone();
  const [periodStart, setPeriodStart] = useState(today);
  const [periodEnd, setPeriodEnd] = useState(today);
  const [liters, setLiters] = useState("");
  const [price, setPrice] = useState("");
  const [fat, setFat] = useState("");
  const [protein, setProtein] = useState("");
  const [ufc, setUfc] = useState("");
  const [ccs, setCcs] = useState("");
  const [error, setError] = useState<string>();

  const save = async () => {
    if (!farm || !buyer) {
      setError("Primero completa el comprador de la finca en Configuración.");
      return;
    }

    try {
      const settlement = await recordSettlement(db, {
        farmId: session.farmId,
        userId: session.userId,
        buyerId: buyer.id,
        farm,
        periodStart,
        periodEnd,
        litersPaid: Number(liters),
        pricePerLiterPaid: Number(price),
        quality: { fatPct: fat ? Number(fat) : undefined, proteinPct: protein ? Number(protein) : undefined, ufc: ufc ? Number(ufc) : undefined, ccs: ccs ? Number(ccs) : undefined }
      });
      onSaved(`Liquidación guardada. Precio justo calculado: $${settlement.legalPriceComputed?.toFixed(4)}/L.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar la liquidación.");
    }
  };

  return <EntryShell title="Registrar liquidación" onClose={onClose}><div className="space-y-5"><p className="text-base text-stone-600">Anota los datos de la factura de {buyer?.name ?? "tu comprador"}. Quedarán guardados en este celular.</p>{error ? <Notice tone="error">{error}</Notice> : null}<Card><div className="grid gap-5 sm:grid-cols-2"><div><FieldLabel>Inicio del período</FieldLabel><TextInput type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} /></div><div><FieldLabel>Fin del período</FieldLabel><TextInput type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></div><div><FieldLabel>Litros pagados</FieldLabel><TextInput inputMode="decimal" type="number" min="0" step="0.1" value={liters} onChange={(event) => setLiters(event.target.value)} placeholder="Ejemplo: 2800" /></div><div><FieldLabel>Precio pagado por litro</FieldLabel><TextInput inputMode="decimal" type="number" min="0" step="0.0001" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="Ejemplo: 0.4500" /></div></div><details className="mt-6 rounded-2xl bg-stone-50 p-4"><summary className="flex cursor-pointer items-center gap-2 text-base font-bold text-stone-700"><CirclePlus size={19} aria-hidden="true" />Agregar resultados de calidad</summary><p className="mt-2 text-sm text-stone-600">Cópialos de la factura para calcular el precio justo con más precisión.</p><div className="mt-5 grid gap-5 sm:grid-cols-2"><div><FieldLabel>Grasa %</FieldLabel><TextInput inputMode="decimal" type="number" step="0.01" value={fat} onChange={(event) => setFat(event.target.value)} /></div><div><FieldLabel>Proteína %</FieldLabel><TextInput inputMode="decimal" type="number" step="0.01" value={protein} onChange={(event) => setProtein(event.target.value)} /></div><div><FieldLabel>UFC/ml</FieldLabel><TextInput inputMode="numeric" type="number" value={ufc} onChange={(event) => setUfc(event.target.value)} /></div><div><FieldLabel>CCS/ml</FieldLabel><TextInput inputMode="numeric" type="number" value={ccs} onChange={(event) => setCcs(event.target.value)} /></div></div></details><Button type="button" className="mt-6 w-full bg-lime-700 text-white" onClick={() => void save()}><Save size={20} aria-hidden="true" />Guardar y conciliar</Button></Card></div></EntryShell>;
};

const MovementEntry = ({ session, onSaved, onClose }: { session: FarmSession; onSaved: (message: string) => void; onClose: () => void }) => {
  const { date } = nowInFarmTimezone();
  const [direction, setDirection] = useState<Transaction["direction"]>("expense");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string>();

  const save = async () => {
    try {
      await recordTransaction(db, { farmId: session.farmId, userId: session.userId, date, direction, category, amount: Number(amount), isEstimated: false });
      onSaved("El movimiento quedó guardado en el celular.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar el movimiento.");
    }
  };

  return <EntryShell title="Registrar movimiento" onClose={onClose}><div className="space-y-5"><p className="text-base text-stone-600">Registra un ingreso o egreso sin mezclarlo con las liquidaciones de leche.</p>{error ? <Notice tone="error">{error}</Notice> : null}<Card><div className="grid grid-cols-2 gap-3"><Button type="button" aria-pressed={direction === "expense"} className={direction === "expense" ? "bg-red-800 text-white" : "bg-stone-100 text-stone-800"} onClick={() => setDirection("expense")}><ArrowDownCircle size={19} aria-hidden="true" />Egreso</Button><Button type="button" aria-pressed={direction === "income"} className={direction === "income" ? "bg-lime-700 text-white" : "bg-stone-100 text-stone-800"} onClick={() => setDirection("income")}><ArrowUpCircle size={19} aria-hidden="true" />Ingreso</Button></div><div className="mt-5"><FieldLabel>Tipo</FieldLabel><TextInput value={category} onChange={(event) => setCategory(event.target.value)} placeholder={direction === "expense" ? "Ejemplo: Molido, medicamento o combustible" : "Ejemplo: Venta de animal"} /></div><div className="mt-5"><FieldLabel>Valor en dólares</FieldLabel><TextInput inputMode="decimal" min="0" step="0.01" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Ejemplo: 35.50" /></div><Button type="button" className="mt-6 w-full bg-lime-700 text-white" onClick={() => void save()}><Save size={20} aria-hidden="true" />Guardar movimiento</Button></Card></div></EntryShell>;
};

const AssetEntry = ({ session, onSaved, onClose }: { session: FarmSession; onSaved: (message: string) => void; onClose: () => void }) => {
  const { date } = nowInFarmTimezone();
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [years, setYears] = useState("5");
  const [error, setError] = useState<string>();

  const save = async () => {
    try {
      await recordAsset(db, { farmId: session.farmId, userId: session.userId, name, category: "Equipo", purchaseDate: date, purchaseValue: Number(value), usefulLifeYears: Number(years), salvageValue: 0 });
      onSaved("El activo quedó guardado para calcular su depreciación.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar el activo.");
    }
  };

  return <EntryShell title="Agregar activo" onClose={onClose}><div className="space-y-5"><p className="text-base text-stone-600">Incluye equipos importantes para reflejar su depreciación dentro del costo por litro.</p>{error ? <Notice tone="error">{error}</Notice> : null}<Card><div><FieldLabel>Nombre del equipo</FieldLabel><TextInput value={name} onChange={(event) => setName(event.target.value)} placeholder="Ejemplo: Ordeñadora" /></div><div className="mt-5"><FieldLabel>Valor de compra</FieldLabel><TextInput type="number" min="0" value={value} onChange={(event) => setValue(event.target.value)} placeholder="Ejemplo: 1200" /></div><div className="mt-5"><FieldLabel>Años de vida útil</FieldLabel><TextInput type="number" min="1" value={years} onChange={(event) => setYears(event.target.value)} /></div><Button type="button" className="mt-6 w-full bg-stone-900 text-white" onClick={() => void save()}><Save size={20} aria-hidden="true" />Guardar activo</Button></Card></div></EntryShell>;
};

const LaborEntry = ({ session, onSaved, onClose }: { session: FarmSession; onSaved: (message: string) => void; onClose: () => void }) => {
  const { date } = nowInFarmTimezone();
  const [workerName, setWorkerName] = useState("Trabajo familiar");
  const [laborType, setLaborType] = useState<LaborRecord["type"]>("family");
  const [rate, setRate] = useState("");
  const [days, setDays] = useState("");
  const [error, setError] = useState<string>();

  const save = async () => {
    try {
      await recordLabor(db, { farmId: session.farmId, userId: session.userId, workerName, type: laborType, rate: Number(rate), daysWorked: Number(days), period: date.slice(0, 7) });
      onSaved("El trabajo quedó guardado en el celular.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar el trabajo.");
    }
  };

  return <EntryShell title="Registrar trabajo" onClose={onClose}><div className="space-y-5"><p className="text-base text-stone-600">Registra el trabajo familiar o contratado para conocer el costo completo por litro.</p>{error ? <Notice tone="error">{error}</Notice> : null}<Card><div><FieldLabel>Quién trabajó</FieldLabel><TextInput value={workerName} onChange={(event) => setWorkerName(event.target.value)} /></div><div className="mt-5"><FieldLabel>Tipo</FieldLabel><select className="min-h-12 w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 text-lg text-stone-950 outline-none focus:border-lime-700 focus:bg-white focus:ring-4 focus:ring-lime-100" value={laborType} onChange={(event) => setLaborType(event.target.value as LaborRecord["type"])}><option value="family">Trabajo familiar</option><option value="daily">Jornal</option><option value="monthly">Mensual</option></select></div><div className="mt-5 grid grid-cols-2 gap-3"><div><FieldLabel>Valor diario</FieldLabel><TextInput type="number" min="0" value={rate} onChange={(event) => setRate(event.target.value)} /></div><div><FieldLabel>Días</FieldLabel><TextInput type="number" min="0" value={days} onChange={(event) => setDays(event.target.value)} /></div></div><Button type="button" className="mt-6 w-full bg-stone-900 text-white" onClick={() => void save()}><Save size={20} aria-hidden="true" />Guardar trabajo</Button></Card></div></EntryShell>;
};

const SettlementHistory = ({ settlements, onRegister }: { settlements: Settlement[]; onRegister: () => void }) => (
  <section className="space-y-4"><div className="flex items-end justify-between gap-3 px-1"><div><p className="text-sm font-bold uppercase tracking-wide text-stone-500">Pago de leche</p><h2 className="mt-1 text-2xl font-black text-stone-950">Liquidaciones</h2></div><Button type="button" className="bg-lime-700 text-white" onClick={onRegister}><ReceiptText size={19} aria-hidden="true" />Registrar liquidación</Button></div><p className="px-1 text-sm leading-snug text-stone-600">Consulta el pago que hizo tu comprador y su comparación con el precio justo.</p><div className="space-y-3">{settlements.length === 0 ? <Notice tone="info">Aún no hay liquidaciones registradas.</Notice> : settlements.map((settlement) => <Card key={settlement.id}><div className="flex items-start justify-between gap-3"><div><p className="text-lg font-black text-stone-950">{settlement.periodStart} al {settlement.periodEnd}</p><p className="mt-1 text-sm text-stone-600">{settlement.litersPaid.toFixed(1)} L · Pagado: ${settlement.pricePerLiterPaid.toFixed(4)}/L</p></div><Calculator className="shrink-0 text-lime-700" size={23} aria-hidden="true" /></div>{settlement.legalPriceComputed !== undefined ? <div className="mt-4 rounded-2xl bg-stone-100 p-4"><p className="text-sm font-bold uppercase tracking-wide text-stone-500">Precio justo calculado</p><p className="mt-1 text-2xl font-black text-stone-950">${settlement.legalPriceComputed.toFixed(4)}/L</p><p className={`mt-1 text-sm font-semibold ${settlement.legalVariancePerLiter && settlement.legalVariancePerLiter > 0 ? "text-amber-800" : "text-lime-800"}`}>{settlement.legalVariancePerLiter && settlement.legalVariancePerLiter > 0 ? `Diferencia: $${settlement.legalVariancePerLiter.toFixed(4)}/L por debajo.` : "El pago coincide o supera el cálculo."}</p></div> : null}</Card>)}</div></section>
);

const MovementHistory = ({ transactions, onRegister }: { transactions: Transaction[]; onRegister: () => void }) => (
  <section className="space-y-4"><div className="flex items-end justify-between gap-3 px-1"><div><p className="text-sm font-bold uppercase tracking-wide text-stone-500">Caja de la finca</p><h2 className="mt-1 text-2xl font-black text-stone-950">Movimientos</h2></div><Button type="button" className="bg-lime-700 text-white" onClick={onRegister}><CirclePlus size={19} aria-hidden="true" />Registrar</Button></div><p className="px-1 text-sm leading-snug text-stone-600">Anota ingresos y egresos distintos a la liquidación de leche.</p><div className="space-y-3">{transactions.length === 0 ? <Notice tone="info">Aún no hay movimientos registrados.</Notice> : transactions.slice(0, 12).map((transaction) => <Card key={transaction.id}><div className="flex items-center gap-3"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${transaction.direction === "expense" ? "bg-red-50 text-red-800" : "bg-lime-50 text-lime-800"}`}>{transaction.direction === "expense" ? <ArrowDownCircle size={22} aria-hidden="true" /> : <ArrowUpCircle size={22} aria-hidden="true" />}</span><div className="min-w-0 flex-1"><p className="truncate text-lg font-black text-stone-950">{transaction.category}</p><p className="mt-0.5 text-sm text-stone-600">{transaction.date}</p></div><p className={`shrink-0 text-lg font-black ${transaction.direction === "expense" ? "text-red-800" : "text-lime-800"}`}>{transaction.direction === "expense" ? "−" : "+"}${transaction.amount.toFixed(2)}</p></div></Card>)}</div></section>
);

const CostsPage = ({ summary, calvesLiters, latestPrice, onAsset, onLabor }: { summary: ReturnType<typeof calculateCostSummary>; calvesLiters: number; latestPrice: number | undefined; onAsset: () => void; onLabor: () => void }) => (
  <section className="space-y-4"><div className="px-1"><p className="text-sm font-bold uppercase tracking-wide text-stone-500">Rentabilidad</p><h2 className="mt-1 text-2xl font-black text-stone-950">Costo por litro</h2><p className="mt-2 text-sm leading-snug text-stone-600">Se calcula con los egresos, los equipos, el trabajo familiar y los litros medidos en la finca.</p></div><div className="grid gap-3 sm:grid-cols-3"><Card><p className="text-sm font-bold uppercase tracking-wide text-stone-500">Caja</p><p className="mt-1 text-3xl font-black text-stone-950">{perLiter(summary.cashPerLiter)}</p></Card><Card><p className="text-sm font-bold uppercase tracking-wide text-stone-500">Con depreciación</p><p className="mt-1 text-3xl font-black text-stone-950">{perLiter(summary.withDepreciationPerLiter)}</p></Card><Card><p className="text-sm font-bold uppercase tracking-wide text-stone-500">Costo completo</p><p className="mt-1 text-3xl font-black text-stone-950">{perLiter(summary.fullPerLiter)}</p></Card></div>{calvesLiters > 0 ? <Notice tone="info">Leche para terneros: {calvesLiters.toFixed(1)} L{latestPrice ? ` · valor de referencia $${(calvesLiters * latestPrice).toFixed(2)} según la última liquidación.` : ". Registra una liquidación para calcular su valor de referencia."}</Notice> : null}<div className="grid gap-3 sm:grid-cols-2"><SectionLink title="Activo o equipo" description="Agrega equipos para incluir su depreciación." icon={Wrench} onClick={onAsset} tone="stone" /><SectionLink title="Trabajo" description="Registra trabajo familiar, jornal o mensual." icon={UsersRound} onClick={onLabor} tone="sky" /></div></section>
);

export const FinancePage = ({ session }: { session: FarmSession }) => {
  const [section, setSection] = useState<FinanceSection>("summary");
  const [entry, setEntry] = useState<EntryKind>();
  const [message, setMessage] = useState<string>();
  const farm = useLiveQuery(() => db.farms.get(session.farmId), [session.farmId]);
  const buyer = useLiveQuery(() => db.buyers.filter((item) => item.farmId === session.farmId && !item.deletedAt).first(), [session.farmId]);
  const settlements = useLiveQuery(() => db.settlements.filter((item) => item.farmId === session.farmId && !item.deletedAt).toArray(), [session.farmId], []);
  const transactions = useLiveQuery(() => db.transactions.filter((item) => item.farmId === session.farmId && !item.deletedAt).toArray(), [session.farmId], []);
  const assets = useLiveQuery(() => db.assets.filter((item) => item.farmId === session.farmId && !item.deletedAt).toArray(), [session.farmId], []);
  const labor = useLiveQuery(() => db.labor.filter((item) => item.farmId === session.farmId && !item.deletedAt).toArray(), [session.farmId], []);
  const readings = useLiveQuery(() => db.tankReadings.filter((item) => item.farmId === session.farmId && !item.deletedAt && item.readBy === "farm" && item.moment === "at_pickup").toArray(), [session.farmId], []);
  const calfMilk = useLiveQuery(() => db.milkUsages.filter((item) => item.farmId === session.farmId && !item.deletedAt && item.type === "calves").toArray(), [session.farmId], []);

  useEffect(() => { void ensureDefaultPriceSettings(db, session.farmId, session.userId); }, [session.farmId, session.userId]);

  const orderedSettlements = useMemo(() => [...settlements].sort((left, right) => right.periodEnd.localeCompare(left.periodEnd)), [settlements]);
  const orderedTransactions = useMemo(() => [...transactions].sort((left, right) => right.date.localeCompare(left.date) || right.updatedAt.localeCompare(left.updatedAt)), [transactions]);
  const costSummary = useMemo(() => calculateCostSummary(transactions, assets, labor, readings.reduce((total, item) => total + item.liters, 0)), [assets, labor, readings, transactions]);
  const latestSettlement = orderedSettlements[0];
  const calvesLiters = calfMilk.reduce((total, item) => total + item.liters, 0);

  const finishEntry = (nextMessage: string) => {
    setMessage(nextMessage);
    setEntry(undefined);
  };

  return <div className="space-y-5"><header className="px-1"><p className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-[0.16em] text-lime-800"><BadgeDollarSign size={16} aria-hidden="true" />Administración</p><h1 className="mt-1 text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">Finanzas</h1><p className="mt-2 max-w-xl text-base text-stone-600">Primero revisa el estado de la finca; luego entra solo a la operación que necesitas.</p></header><FinanceTabs section={section} onSelect={setSection} />{message ? <Notice tone="success">{message}</Notice> : null}{section === "summary" ? <section className="space-y-3"><div className="px-1"><p className="text-sm font-bold uppercase tracking-wide text-stone-500">Resumen de la finca</p><h2 className="mt-1 text-2xl font-black text-stone-950">Lo importante ahora</h2></div><SectionLink title="Liquidaciones" description={latestSettlement ? `Último pago: ${latestSettlement.periodEnd}.` : "Aún no has registrado un pago de leche."} value={latestSettlement ? `$${latestSettlement.totalPaid.toFixed(2)} · ${latestSettlement.litersPaid.toFixed(0)} L` : undefined} icon={ReceiptText} onClick={() => setSection("settlements")} tone="lime" /><SectionLink title="Movimientos" description={orderedTransactions.length ? `${orderedTransactions.length} registros guardados en la finca.` : "Anota aquí ingresos y egresos de la finca."} value={orderedTransactions.length ? `Último: ${orderedTransactions[0].category}` : undefined} icon={ArrowUpCircle} onClick={() => setSection("movements")} /><SectionLink title="Costo por litro" description="Mira la caja, depreciación y trabajo familiar por separado." value={perLiter(costSummary.fullPerLiter)} icon={Calculator} onClick={() => setSection("costs")} tone="sky" /></section> : null}{section === "settlements" ? <SettlementHistory settlements={orderedSettlements} onRegister={() => setEntry("settlement")} /> : null}{section === "movements" ? <MovementHistory transactions={orderedTransactions} onRegister={() => setEntry("movement")} /> : null}{section === "costs" ? <CostsPage summary={costSummary} calvesLiters={calvesLiters} latestPrice={latestSettlement?.pricePerLiterPaid} onAsset={() => setEntry("asset")} onLabor={() => setEntry("labor")} /> : null}{entry === "settlement" ? <SettlementEntry session={session} farm={farm} buyer={buyer} onClose={() => setEntry(undefined)} onSaved={finishEntry} /> : null}{entry === "movement" ? <MovementEntry session={session} onClose={() => setEntry(undefined)} onSaved={finishEntry} /> : null}{entry === "asset" ? <AssetEntry session={session} onClose={() => setEntry(undefined)} onSaved={finishEntry} /> : null}{entry === "labor" ? <LaborEntry session={session} onClose={() => setEntry(undefined)} onSaved={finishEntry} /> : null}</div>;
};
