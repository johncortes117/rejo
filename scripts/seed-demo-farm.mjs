import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const DEMO_EMAIL = process.env.REJO_DEMO_EMAIL ?? "demo.finca@rejo.test";
const suppliedPassword = process.env.REJO_DEMO_PASSWORD;
const DEMO_PASSWORD = suppliedPassword ?? `Rejo-${randomBytes(12).toString("base64url")}`;
const generatedPassword = !suppliedPassword;
const FARM_TIMEZONE = "America/Guayaquil";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required.");
}

const uuid = (key) => {
  const bytes = createHash("sha1").update(`rejo-demo:${key}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const dateInFarmTimezone = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: FARM_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
};

const addDays = (date, days) => {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};

const atNoon = (date) => `${date}T12:00:00.000Z`;
const round = (value, precision = 1) => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};
let today = process.env.REJO_DEMO_DATE ?? dateInFarmTimezone();
const now = new Date().toISOString();
const farmId = uuid("farm");
const idForGroup = (key) => uuid(`group:${key}`);
const idForAnimal = (name) => uuid(`animal:${name}`);

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

const requireSuccess = (error, operation) => {
  if (error) {
    throw new Error(`${operation}: ${error.message}`);
  }
};

const authenticateDemoUser = async () => {
  const { data: signUpData, error: signUpError } = await client.auth.signUp({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD
  });

  if (!signUpError && signUpData.session && signUpData.user) {
    return signUpData.user;
  }

  const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD
  });

  if (signInError || !signInData.user) {
    const detail = signInError?.message ?? signUpError?.message ?? "No session was returned.";
    throw new Error(`The demo account could not sign in. Disable Confirm Email for this pilot or provide the existing REJO_DEMO_PASSWORD. ${detail}`);
  }

  return signInData.user;
};

const record = (key, createdOn, userId, values) => ({
  id: uuid(key),
  farm_id: farmId,
  created_at: atNoon(createdOn),
  updated_at: now,
  created_by: userId,
  ...values
});

const upsertRows = async (table, rows) => {
  for (let index = 0; index < rows.length; index += 100) {
    const { error } = await client.from(table).upsert(rows.slice(index, index + 100), { onConflict: "id" });
    requireSuccess(error, `Could not seed ${table}`);
  }
};

const resolveScenarioDate = async () => {
  if (process.env.REJO_DEMO_DATE) {
    return process.env.REJO_DEMO_DATE;
  }

  const { data, error } = await client
    .from("tank_readings")
    .select("date")
    .eq("farm_id", farmId)
    .eq("notes", "Demo seed daily tank measurement.")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  requireSuccess(error, "Could not resolve the existing demo scenario date");
  return data?.date ?? today;
};

const createScenario = (userId) => {
  const groups = [
    { key: "milking", name: "En ordeño", sortOrder: 0, isDefault: true },
    { key: "dry", name: "Secadas", sortOrder: 1, isDefault: true },
    { key: "heifers", name: "Vaconas", sortOrder: 2, isDefault: true },
    { key: "calves", name: "Terneros", sortOrder: 3, isDefault: true },
    { key: "breeding", name: "Reproductores", sortOrder: 4, isDefault: false }
  ];

  const groupRows = groups.map((group) => record(`group:${group.key}`, addDays(today, -360), userId, {
    name: group.name,
    sort_order: group.sortOrder,
    is_default: group.isDefault
  }));

  const animals = [
    ["Lucero", "milking", "female", "2019-05-09"],
    ["Canela", "milking", "female", "2020-02-18"],
    ["Mora", "milking", "female", "2018-10-21"],
    ["Estrella", "milking", "female", "2020-03-14"],
    ["Nube", "milking", "female", "2019-09-02"],
    ["Brisa", "milking", "female", "2021-01-12"],
    ["Fresita", "milking", "female", "2020-11-28"],
    ["Manchita", "milking", "female", "2019-07-26"],
    ["Rosita", "milking", "female", "2020-06-03"],
    ["Carmela", "milking", "female", "2021-05-16"],
    ["Sultana", "milking", "female", "2019-12-08"],
    ["Luna", "milking", "female", "2020-01-30"],
    ["Paloma", "dry", "female", "2020-04-10"],
    ["Jazmín", "dry", "female", "2019-08-22"],
    ["Lluvia", "dry", "female", "2020-09-19"],
    ["Azucena", "heifers", "female", "2024-01-17"],
    ["Perla", "heifers", "female", "2024-03-03"],
    ["Dalia", "heifers", "female", "2024-05-11"],
    ["Milagro", "heifers", "female", "2024-06-24"],
    ["Nena", "heifers", "female", "2024-08-05"],
    ["Chispa", "calves", "female", addDays(today, -25), "Luna"],
    ["Copito", "calves", "male", addDays(today, -62), "Sultana"],
    ["Nela", "calves", "female", addDays(today, -108), "Rosita"],
    ["Trueno", "calves", "male", addDays(today, -137), "Brisa"],
    ["Miel", "calves", "female", addDays(today, -172), "Canela"],
    ["Pinta", "calves", "female", addDays(today, -205), "Manchita"],
    ["Rayo", "breeding", "male", "2022-02-15"]
  ];
  const animalRows = animals.map(([name, groupKey, sex, birthDate, motherName]) => record(`animal:${name}`, birthDate, userId, {
    name,
    sex,
    birth_date: birthDate,
    birth_date_estimated: false,
    mother_id: motherName ? idForAnimal(motherName) : null,
    herd_group_id: idForGroup(groupKey),
    status: "active"
  }));

  const tankCalibrations = [
    [0, 0], [10, 42], [20, 86], [30, 131], [40, 177], [50, 224], [60, 272], [70, 321], [80, 371]
  ].map(([mark, liters]) => record(`calibration:${mark}`, addDays(today, -370), userId, {
    mark,
    liters,
    unit_label: "cm"
  }));

  const tankReadings = Array.from({ length: 90 }, (_, index) => {
    const date = addDays(today, index - 89);
    const liters = round(176 + Math.sin(index / 5) * 4.2 + Math.cos(index / 13) * 2.6 + (index > 70 ? (index - 70) * 0.42 : 0));
    return record(`tank:${date}`, date, userId, {
      date,
      time: "16:30:00",
      moment: "at_pickup",
      liters,
      read_by: "farm",
      notes: "Demo seed daily tank measurement."
    });
  });

  const milkUsages = Array.from({ length: 45 }, (_, index) => {
    const date = addDays(today, -index * 2);
    const animalName = index % 2 ? "Chispa" : "Copito";
    return record(`milk-use:calves:${date}`, date, userId, {
      date,
      type: "calves",
      liters: index % 3 === 0 ? 7 : 6,
      animal_id: idForAnimal(animalName),
      notes: "Leche para terneros."
    });
  }).concat([
    record(`milk-use:household:${addDays(today, -7)}`, addDays(today, -7), userId, { date: addDays(today, -7), type: "household", liters: 2, notes: "Uso de la casa." }),
    record(`milk-use:household:${addDays(today, -21)}`, addDays(today, -21), userId, { date: addDays(today, -21), type: "household", liters: 2.5, notes: "Uso de la casa." })
  ]);

  const priceSettings = [
    record("price-setting:current", addDays(today, -365), userId, {
      effective_from: addDays(today, -365),
      support_price: 0.5,
      historical_floor: 0.42,
      fat_base: 3,
      fat_step: 0.2,
      fat_price_per_step: 0.0024,
      protein_base: 2.9,
      protein_step: 0.2,
      protein_price_per_step: 0.0045,
      ufc_base: 158000,
      ufc_step: 20000,
      ufc_price_per_step: 0.0031,
      ccs_base: 250000,
      ccs_step: 15000,
      ccs_price_per_step: 0.003,
      brucellosis_free_bonus: 0.01,
      bpp_bonus: 0,
      source_document: "Datos demostrativos basados en la tabla legal vigente."
    })
  ];

  const buyerId = uuid("buyer:lacteos-san-gabriel");
  const buyers = [record("buyer:lacteos-san-gabriel", addDays(today, -365), userId, {
    name: "Lácteos San Gabriel",
    type: "industry",
    contact: "Centro de acopio San Gabriel",
    payment_frequency: "biweekly",
    agreed_price_per_liter: 0.522,
    pays_quality_bonus: true
  })];

  const settlementIndexes = Array.from({ length: 10 }, (_, index) => index);
  const qualityTests = settlementIndexes.map((index) => {
    const end = addDays(today, -8 - index * 15);
    return record(`quality:${end}`, end, userId, {
      date: end,
      fat_pct: round(3.45 + (index % 3) * 0.08, 2),
      protein_pct: round(3.08 + (index % 2) * 0.06, 2),
      ufc: 122000 + index * 2300,
      ccs: 188000 + index * 6400,
      lab_name: "Lácteos San Gabriel",
      source: "buyer_reported"
    });
  });
  const buyerReadings = settlementIndexes.map((index) => {
    const end = addDays(today, -8 - index * 15);
    const liters = round(2610 + Math.sin(index) * 48 + index * 9);
    return record(`buyer-pickup:${end}`, end, userId, {
      date: end,
      time: "10:00:00",
      moment: "at_pickup",
      liters,
      read_by: "buyer",
      notes: "Volumen consignado en la liquidación quincenal."
    });
  });
  const settlements = settlementIndexes.map((index) => {
    const end = addDays(today, -8 - index * 15);
    const start = addDays(end, -14);
    const liters = buyerReadings[index].liters;
    const paidPrice = round(0.518 + (index % 4) * 0.001, 4);
    return record(`settlement:${end}`, end, userId, {
      buyer_id: buyerId,
      period_start: start,
      period_end: end,
      liters_paid: liters,
      price_per_liter_paid: paidPrice,
      total_paid: round(liters * paidPrice, 2),
      quality_test_id: qualityTests[index].id,
      reconciled: true,
      variance_liters: 0,
      variance_amount: round(liters * (0.524 - paidPrice), 2),
      legal_price_computed: 0.524,
      legal_variance_per_liter: round(0.524 - paidPrice, 4)
    });
  });

  const heats = [
    record(`heat:Estrella:${addDays(today, -1)}`, addDays(today, -1), userId, { animal_id: idForAnimal("Estrella"), date: addDays(today, -1), detected_by: "María", detected_where: "milking", signs: "Monta y moco claro.", served: false }),
    record(`heat:Mora:${addDays(today, -83)}`, addDays(today, -83), userId, { animal_id: idForAnimal("Mora"), date: addDays(today, -83), detected_by: "María", detected_where: "paddock", signs: "Celo observado.", served: true }),
    record(`heat:Mora:${addDays(today, -62)}`, addDays(today, -62), userId, { animal_id: idForAnimal("Mora"), date: addDays(today, -62), detected_by: "María", detected_where: "paddock", signs: "Retorno al celo.", served: true })
  ];
  const services = [
    ["Mora", -104, 1], ["Mora", -83, 2], ["Mora", -22, 3], ["Canela", -72, 1], ["Paloma", -264, 1], ["Jazmín", -275, 1], ["Lluvia", -160, 1], ["Sultana", -372, 1], ["Luna", -310, 1]
  ].map(([animalName, offset, serviceNumber]) => {
    const date = addDays(today, offset);
    return record(`service:${animalName}:${date}`, date, userId, {
      animal_id: idForAnimal(animalName),
      date,
      type: serviceNumber === 1 && animalName === "Canela" ? "ai" : "natural",
      bull_id: serviceNumber === 1 && animalName === "Canela" ? null : idForAnimal("Rayo"),
      straw_code: animalName === "Canela" ? "CARCHI-23" : null,
      straw_bull_name: animalName === "Canela" ? "Nevado" : null,
      technician: animalName === "Canela" ? "Dr. Rosero" : null,
      cost: animalName === "Canela" ? 18 : 0,
      service_number: serviceNumber
    });
  });
  const pregnancyChecks = [
    ["Paloma", -76, "pregnant", 205], ["Jazmín", -62, "pregnant", 215], ["Lluvia", -118, "pregnant", 55], ["Sultana", -288, "pregnant", 80], ["Luna", -280, "pregnant", 32], ["Mora", -48, "open", null]
  ].map(([animalName, offset, result, estimatedDays]) => {
    const date = addDays(today, offset);
    return record(`pregnancy:${animalName}:${date}`, date, userId, {
      animal_id: idForAnimal(animalName),
      date,
      method: "palpation",
      result,
      estimated_days: estimatedDays,
      technician: "Dr. Rosero",
      cost: 12
    });
  });
  const calvings = [
    ["Luna", -25, "Chispa"], ["Sultana", -62, "Copito"], ["Rosita", -108, "Nela"], ["Brisa", -137, "Trueno"], ["Canela", -172, "Miel"], ["Manchita", -205, "Pinta"]
  ].map(([animalName, offset, calfName]) => {
    const date = addDays(today, offset);
    return record(`calving:${animalName}:${date}`, date, userId, {
      animal_id: idForAnimal(animalName),
      date,
      type: "normal",
      outcome: "live",
      calf_ids: [idForAnimal(calfName)],
      notes: "Parto sin complicaciones."
    });
  });
  const dryOffs = [
    ["Paloma", -45, -264], ["Jazmín", -52, -275], ["Lluvia", -40, -160]
  ].map(([animalName, offset, serviceOffset]) => {
    const date = addDays(today, offset);
    return record(`dry-off:${animalName}:${date}`, date, userId, {
      animal_id: idForAnimal(animalName),
      date,
      planned_date: date,
      treatment_applied: "Sellador interno",
      expected_calving_date: addDays(today, serviceOffset + 280)
    });
  });

  const healthEvents = [
    ["Lucero", 0, "mastitis", "Cefa-Sec", "Cefapirina", 96, "Cuarto posterior izquierdo; no entregar leche."],
    ["Nube", -4, "lameness", "Meloxicam", "Meloxicam", 0, "Revisión de pezuña y descanso."],
    ["Canela", -7, "metabolic", "Calcio oral", "Calcio", 0, "Apoyo posparto."],
    ["Paloma", -14, "deworming", "Ivermectina", "Ivermectina", 0, "Curada antes del parto."],
    ["Chispa", -21, "vaccination", "Brucela Cepa 19", "Brucella abortus cepa 19", 0, "Vacuna registrada."],
    ["Miel", -29, "vitamin", "Complejo B", "Vitaminas B", 0, "Refuerzo de crecimiento."]
  ].map(([animalName, offset, type, productName, activeIngredient, milkWithdrawalHours, notes]) => {
    const date = addDays(today, offset);
    return record(`health:${animalName}:${date}:${type}`, date, userId, {
      animal_id: idForAnimal(animalName),
      date,
      type,
      product_name: productName,
      active_ingredient: activeIngredient,
      milk_withdrawal_hours: milkWithdrawalHours || null,
      notes
    });
  });
  const healthTasks = [
    record("task:curada-cows", addDays(today, -90), userId, { category: "cow", task_type: "deworming", due_date: addDays(today, -3), recurrence_days: 90, is_template: true }),
    record("task:brucellosis-chispa", addDays(today, -25), userId, { animal_id: idForAnimal("Chispa"), category: "calf", task_type: "brucellosis_vaccination", due_date: today, recurrence_days: null, is_template: false }),
    record("task:curada-vaconas", addDays(today, -92), userId, { category: "heifer", task_type: "deworming", due_date: addDays(today, -1), recurrence_days: 90, is_template: false }),
    record("task:brucellosis-annual", addDays(today, -340), userId, { category: "cow", task_type: "annual_brucellosis_test", due_date: addDays(today, 18), recurrence_days: 365, is_template: true })
  ];

  const paddocks = [
    ["La Loma", "pasture", 2.8, "Bebedero y cerca eléctrica", 21],
    ["El Molino", "pasture", 2.4, "Bebedero", 21],
    ["La Quebrada", "pasture", 2.1, "Sombra natural", 24],
    ["El Descanso", "rest", 1.6, "Cerca eléctrica", 21],
    ["Papa Nueva", "potato", 1.8, "Cultivo de papa", 45]
  ].map(([name, use, areaHectares, infrastructure, targetRestDays]) => record(`paddock:${name}`, addDays(today, -300), userId, {
    name,
    use,
    area_hectares: areaHectares,
    infrastructure,
    target_rest_days: targetRestDays
  }));
  const paddockId = (name) => uuid(`paddock:${name}`);
  const lots = [
    ["Vacas en ordeño", "Lote principal de producción."],
    ["Vaconas", "Animales en desarrollo."],
    ["Terneras", "Terneras y terneros de crecimiento."]
  ].map(([name, notes]) => record(`lot:${name}`, addDays(today, -300), userId, { name, notes }));
  const lotId = (name) => uuid(`lot:${name}`);
  const grazingRecords = [
    ["Vacas en ordeño", "El Molino", -24, -3], ["Vacas en ordeño", "La Loma", -2, null],
    ["Vaconas", "El Descanso", -30, -26], ["Vaconas", "La Quebrada", -3, null],
    ["Terneras", "La Quebrada", -27, -4], ["Terneras", "El Molino", -3, null]
  ].map(([lotName, paddockName, enteredOffset, exitedOffset]) => {
    const enteredAt = addDays(today, enteredOffset);
    return record(`grazing:${lotName}:${paddockName}:${enteredAt}`, enteredAt, userId, {
      lot_id: lotId(lotName),
      paddock_id: paddockId(paddockName),
      entered_at: enteredAt,
      exited_at: exitedOffset === null ? null : addDays(today, exitedOffset)
    });
  });

  const transactions = [
    [-2, "expense", "Molido", 168, "Compra de alimento para vacas en ordeño.", false],
    [-5, "expense", "Sal mineral", 48, "Bloques minerales.", false],
    [-9, "expense", "Medicina", 36, "Tratamiento y vitaminas.", false],
    [-14, "income", "Venta de ternero", 245, "Venta de un ternero macho destetado.", false],
    [-18, "expense", "Jornal", 52, "Limpieza de corral.", false],
    [-24, "expense", "Molido", 172, "Compra quincenal.", false],
    [-31, "expense", "Semilla de pasto", 84, "Resiembra de El Descanso.", false],
    [-38, "income", "Queso para feria", 96, "Ingreso complementario.", false],
    [-45, "expense", "Flete", 32, "Transporte de alimento.", false],
    [-52, "expense", "Molido", 165, "Compra quincenal.", false],
    [-65, "expense", "Reparación de cerca", 74, "Mantenimiento de cerca eléctrica.", false],
    [-78, "income", "Venta de estiércol", 58, "Abono vendido a vecino.", false],
    [-86, "expense", "Combustible", 40, "Traslado de insumos.", true]
  ].map(([offset, direction, category, amount, description, isEstimated]) => {
    const date = addDays(today, offset);
    return record(`transaction:${date}:${category}`, date, userId, { date, direction, category, amount, description, is_estimated: isEstimated });
  });
  const assets = [
    ["Tanque de frío 500 L", "Equipo de leche", "2022-07-14", 4200, 10, 600],
    ["Ordeñadora de dos puestos", "Equipo de ordeño", "2023-02-10", 2600, 8, 350],
    ["Picadora de forraje", "Equipo de alimentación", "2021-11-08", 1350, 7, 150]
  ].map(([name, category, purchaseDate, purchaseValue, usefulLifeYears, salvageValue]) => record(`asset:${name}`, purchaseDate, userId, {
    name,
    category,
    purchase_date: purchaseDate,
    purchase_value: purchaseValue,
    useful_life_years: usefulLifeYears,
    salvage_value: salvageValue
  }));
  const labor = [0, 1, 2].map((index) => {
    const period = addDays(today, -index * 30).slice(0, 7);
    return record(`labor:family:${period}`, `${period}-01`, userId, {
      worker_name: "Familia Rosero",
      type: "family",
      rate: 18,
      days_worked: 22,
      period
    });
  }).concat([record(`labor:daily:${today.slice(0, 7)}`, `${today.slice(0, 7)}-01`, userId, {
    worker_name: "José Mena",
    type: "daily",
    rate: 20,
    days_worked: 4,
    period: today.slice(0, 7)
  })]);

  const dairyAnimals = ["Lucero", "Canela", "Mora", "Estrella", "Nube", "Brisa", "Fresita", "Manchita", "Rosita", "Carmela", "Sultana", "Luna"];
  const controlOffsets = [-62, -32, -3];
  const milkControlSessions = controlOffsets.map((offset) => {
    const date = addDays(today, offset);
    return record(`milk-control-session:${date}`, date, userId, { date, notes: "Control mensual demostrativo." });
  });
  const milkControlRecords = controlOffsets.flatMap((offset, sessionIndex) => {
    const date = addDays(today, offset);
    return dairyAnimals.map((animalName, animalIndex) => record(`milk-control:${date}:${animalName}`, date, userId, {
      session_id: uuid(`milk-control-session:${date}`),
      animal_id: idForAnimal(animalName),
      liters: round(12.2 + (animalIndex % 5) * 1.1 + sessionIndex * 0.45 + (animalIndex === 0 ? 2.2 : 0))
    }));
  });

  return {
    buyers,
    tankCalibrations,
    herdGroups: groupRows,
    animals: animalRows,
    tankReadings: [...tankReadings, ...buyerReadings],
    milkUsages,
    heats,
    services,
    pregnancyChecks,
    calvings,
    dryOffs,
    healthEvents,
    healthPlanTasks: healthTasks,
    priceSettings,
    milkQualityTests: qualityTests,
    settlements,
    transactions,
    assets,
    labor,
    paddocks,
    grazingLots: lots,
    grazingRecords,
    milkControlSessions,
    milkControlRecords
  };
};

const seed = async () => {
  const user = await authenticateDemoUser();
  const { error: bootstrapError } = await client.rpc("bootstrap_farm", {
    p_farm_id: farmId,
    p_name: "Finca La Esperanza — Demo",
    p_owner_name: "María Fernanda Rosero",
    p_timezone: FARM_TIMEZONE,
    p_created_at: atNoon(addDays(today, -365))
  });
  requireSuccess(bootstrapError, "Could not bootstrap the demo farm");

  const { error: farmError } = await client.from("farms").update({
    name: "Finca La Esperanza — Demo",
    owner_name: "María Fernanda Rosero",
    province: "Carchi",
    canton: "Montúfar",
    sector: "Chitán de Navarrete",
    hectares: 14.8,
    altitude_m: 2890,
    timezone: FARM_TIMEZONE,
    brucellosis_free: true,
    bpp_certified: false,
    updated_at: now
  }).eq("id", farmId);
  requireSuccess(farmError, "Could not update the demo farm");

  today = await resolveScenarioDate();
  const scenario = createScenario(user.id);
  for (const [table, rows] of Object.entries(scenario)) {
    await upsertRows(table.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), rows);
  }

  const tablesToCount = ["animals", "tank_readings", "health_events", "heats", "services", "pregnancy_checks", "settlements", "transactions", "paddocks", "milk_control_records"];
  const counts = {};
  for (const table of tablesToCount) {
    const { count, error } = await client.from(table).select("id", { count: "exact", head: true }).eq("farm_id", farmId);
    requireSuccess(error, `Could not verify ${table}`);
    counts[table] = count ?? 0;
  }

  console.log(JSON.stringify({
    farm: "Finca La Esperanza — Demo",
    farmId,
    businessDate: today,
    email: DEMO_EMAIL,
    password: generatedPassword ? DEMO_PASSWORD : "Provided through REJO_DEMO_PASSWORD",
    counts
  }, null, 2));
};

void seed();
