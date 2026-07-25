import type { Settlement, Transaction } from "@/domain/models";

export type CashFlowPeriod = "three_days" | "week" | "month";
export type CashFlowStatus = "empty" | "positive" | "negative" | "balanced";

export interface CashFlowRange {
  startDate: string;
  endDate: string;
  label: string;
}

export interface CashFlowSummary {
  range: CashFlowRange;
  settlementIncome: number;
  otherIncome: number;
  totalIncome: number;
  totalExpenses: number;
  result: number;
  activityCount: number;
  status: CashFlowStatus;
}

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const addDays = (businessDate: string, days: number): string => {
  const [year, month, day] = businessDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export const getCashFlowRange = (endDate: string, period: CashFlowPeriod): CashFlowRange => {
  const daysByPeriod = { three_days: 3, week: 7, month: 30 } as const;
  const days = daysByPeriod[period];
  const labelByPeriod = { three_days: "Últimos 3 días", week: "Últimos 7 días", month: "Últimos 30 días" } as const;
  return { startDate: addDays(endDate, -(days - 1)), endDate, label: labelByPeriod[period] };
};

const isInside = (date: string, range: CashFlowRange) => date >= range.startDate && date <= range.endDate;

export const calculateCashFlowSummary = (settlements: Settlement[], transactions: Transaction[], range: CashFlowRange): CashFlowSummary => {
  const periodSettlements = settlements.filter((item) => !item.deletedAt && isInside(item.periodEnd, range));
  const periodTransactions = transactions.filter((item) => !item.deletedAt && isInside(item.date, range));
  const settlementIncome = money(periodSettlements.reduce((total, item) => total + item.totalPaid, 0));
  const otherIncome = money(periodTransactions.filter((item) => item.direction === "income").reduce((total, item) => total + item.amount, 0));
  const totalExpenses = money(periodTransactions.filter((item) => item.direction === "expense").reduce((total, item) => total + item.amount, 0));
  const totalIncome = money(settlementIncome + otherIncome);
  const result = money(totalIncome - totalExpenses);
  const activityCount = periodSettlements.length + periodTransactions.length;
  const status: CashFlowStatus = activityCount === 0 ? "empty" : result > 0 ? "positive" : result < 0 ? "negative" : "balanced";
  return { range, settlementIncome, otherIncome, totalIncome, totalExpenses, result, activityCount, status };
};
