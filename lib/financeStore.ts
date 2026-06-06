import { supabase } from "./supabase";
import type {
  FinanceState,
  FundRecord,
  FxRiskInput,
  FxTrade,
  InvestmentRecord,
  MonthlyRecord,
  TickerHolding,
} from "../types/finance";

const USER_KEY = "personal";
const STORAGE_KEY = "finance-planner-state-v1";
const BACKUP_KEY = "finance-planner-state-v1-backup";
const LAST_GOOD_KEY = "finance-planner-state-v1-last-good";

export const investmentAccounts = [
  "WealthNavi",
  "ROBOPRO",
  "INDEX",
  "Active",
  "NISA",
  "NASDAQ100",
];
export const fundNames = ["eMAXIS Neo 宇宙開発", "ROBOPRO ファンド", "mega10"];

const id = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const defaultState: FinanceState = {
  monthly: [
    { id: id(), user_key: USER_KEY, month: "2024-08", age: 23, cash_prediction: 0, cash_actual: 2359881, income_budget: 0, income_actual: 0, outgo_budget: 0, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 0, invest_actual: 0, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":-5264898,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":0,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":0,\"incomeCashBudget\":0,\"incomeInvestmentBudget\":0,\"outgoBudget\":0,\"fundInvestmentBudget\":0,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2024-09", age: 23, cash_prediction: 1479881, cash_actual: 1505980, income_budget: 1100000, income_actual: 1122911, outgo_budget: 100000, outgo_cash: 165, outgo_card: 98414, outgo_other: 0, invest_budget: 0, invest_actual: 0, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":1122911,\"incomeInvestment\":-41110,\"outgoCash\":165,\"outgoPaypay\":0,\"outgoCard\":98414,\"fundInvestment\":0,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":1479881,\"incomeCashBudget\":1100000,\"incomeInvestmentBudget\":0,\"outgoBudget\":100000,\"fundInvestmentBudget\":0,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2024-10", age: 23, cash_prediction: 3305980, cash_actual: 3254077, income_budget: 0, income_actual: 40000, outgo_budget: 80000, outgo_cash: 165, outgo_card: 57798, outgo_other: 10000, invest_budget: 0, invest_actual: 0, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":40000,\"incomeInvestment\":-63324,\"outgoCash\":165,\"outgoPaypay\":10000,\"outgoCard\":57798,\"fundInvestment\":0,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":3305980,\"incomeCashBudget\":0,\"incomeInvestmentBudget\":0,\"outgoBudget\":80000,\"fundInvestmentBudget\":0,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2024-11", age: 23, cash_prediction: 2004077, cash_actual: 2028193, income_budget: 30000, income_actual: 53454, outgo_budget: 80000, outgo_cash: 0, outgo_card: 48656, outgo_other: 8000, invest_budget: 0, invest_actual: 0, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":53454,\"incomeInvestment\":-13540,\"outgoCash\":0,\"outgoPaypay\":8000,\"outgoCard\":48656,\"fundInvestment\":0,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":2004077,\"incomeCashBudget\":30000,\"incomeInvestmentBudget\":0,\"outgoBudget\":80000,\"fundInvestmentBudget\":0,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2024-12", age: 23, cash_prediction: 778193, cash_actual: 899043, income_budget: 30000, income_actual: 46066, outgo_budget: 80000, outgo_cash: 0, outgo_card: 42082, outgo_other: 3000, invest_budget: 0, invest_actual: 0, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":46066,\"incomeInvestment\":76440,\"outgoCash\":0,\"outgoPaypay\":3000,\"outgoCard\":42082,\"fundInvestment\":0,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":778193,\"incomeCashBudget\":30000,\"incomeInvestmentBudget\":0,\"outgoBudget\":80000,\"fundInvestmentBudget\":0,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2025-01", age: 23, cash_prediction: 1949043, cash_actual: 1608459, income_budget: 30000, income_actual: 1787, outgo_budget: 80000, outgo_cash: 0, outgo_card: 151876, outgo_other: 0, invest_budget: 1200000, invest_actual: 1200000, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":1787,\"incomeInvestment\":-350289,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":151876,\"fundInvestment\":1200000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":1949043,\"incomeCashBudget\":30000,\"incomeInvestmentBudget\":0,\"outgoBudget\":80000,\"fundInvestmentBudget\":1200000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2025-02", age: 23, cash_prediction: 1508459, cash_actual: 1113403, income_budget: 30000, income_actual: 0, outgo_budget: 80000, outgo_cash: 50000, outgo_card: 116387, outgo_other: 0, invest_budget: 0, invest_actual: 0, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":-243180,\"outgoCash\":50000,\"outgoPaypay\":0,\"outgoCard\":116387,\"fundInvestment\":0,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":1508459,\"incomeCashBudget\":30000,\"incomeInvestmentBudget\":0,\"outgoBudget\":80000,\"fundInvestmentBudget\":0,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2025-03", age: 23, cash_prediction: 1013403, cash_actual: 940982, income_budget: 30000, income_actual: 38886, outgo_budget: 80000, outgo_cash: -50000, outgo_card: 132301, outgo_other: 0, invest_budget: 0, invest_actual: 0, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":38886,\"incomeInvestment\":-94920,\"outgoCash\":-50000,\"outgoPaypay\":0,\"outgoCard\":132301,\"fundInvestment\":0,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":1013403,\"incomeCashBudget\":30000,\"incomeInvestmentBudget\":0,\"outgoBudget\":80000,\"fundInvestmentBudget\":0,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2025-04", age: 23, cash_prediction: 840982, cash_actual: 380213, income_budget: 30000, income_actual: 12278, outgo_budget: 80000, outgo_cash: 0, outgo_card: 129847, outgo_other: 1100, invest_budget: 0, invest_actual: 0, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":12278,\"incomeInvestment\":-389460,\"outgoCash\":0,\"outgoPaypay\":1100,\"outgoCard\":129847,\"fundInvestment\":0,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":840982,\"incomeCashBudget\":30000,\"incomeInvestmentBudget\":0,\"outgoBudget\":80000,\"fundInvestmentBudget\":0,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2025-05", age: 23, cash_prediction: 340113, cash_actual: 362819, income_budget: 40000, income_actual: 12000, outgo_budget: 80000, outgo_cash: 0, outgo_card: 105734, outgo_other: 0, invest_budget: 0, invest_actual: 0, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":12000,\"incomeInvestment\":100620,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":105734,\"fundInvestment\":0,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":340113,\"incomeCashBudget\":40000,\"incomeInvestmentBudget\":0,\"outgoBudget\":80000,\"fundInvestmentBudget\":0,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2025-06", age: 23, cash_prediction: 322719, cash_actual: 275385, income_budget: 40000, income_actual: 0, outgo_budget: 80000, outgo_cash: -30000, outgo_card: 67229, outgo_other: 5000, invest_budget: 0, invest_actual: 0, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":-6600,\"outgoCash\":-30000,\"outgoPaypay\":5000,\"outgoCard\":67229,\"fundInvestment\":0,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":322719,\"incomeCashBudget\":40000,\"incomeInvestmentBudget\":0,\"outgoBudget\":80000,\"fundInvestmentBudget\":0,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2025-07", age: 24, cash_prediction: 235285, cash_actual: 671636, income_budget: 40000, income_actual: 16130, outgo_budget: 80000, outgo_cash: 0, outgo_card: 187267, outgo_other: 0, invest_budget: 0, invest_actual: 0, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":16130,\"incomeInvestment\":447458,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":187267,\"fundInvestment\":0,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":235285,\"incomeCashBudget\":40000,\"incomeInvestmentBudget\":0,\"outgoBudget\":80000,\"fundInvestmentBudget\":0,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2025-08", age: 24, cash_prediction: 631536, cash_actual: 316532, income_budget: 40000, income_actual: 60275, outgo_budget: 80000, outgo_cash: -65000, outgo_card: 68041, outgo_other: 10000, invest_budget: 0, invest_actual: 0, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":60275,\"incomeInvestment\":-283012,\"outgoCash\":-65000,\"outgoPaypay\":10000,\"outgoCard\":68041,\"fundInvestment\":0,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":631536,\"incomeCashBudget\":40000,\"incomeInvestmentBudget\":0,\"outgoBudget\":80000,\"fundInvestmentBudget\":0,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2025-09", age: 24, cash_prediction: 1276532, cash_actual: 1311825, income_budget: 1140000, income_actual: 1190657, outgo_budget: 80000, outgo_cash: 3465, outgo_card: 80979, outgo_other: 15000, invest_budget: 0, invest_actual: 0, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":1190657,\"incomeInvestment\":-8858,\"outgoCash\":3465,\"outgoPaypay\":15000,\"outgoCard\":80979,\"fundInvestment\":0,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":1276532,\"incomeCashBudget\":1140000,\"incomeInvestmentBudget\":0,\"outgoBudget\":80000,\"fundInvestmentBudget\":0,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2025-10", age: 24, cash_prediction: 1171825, cash_actual: 1864078, income_budget: 40000, income_actual: 141344, outgo_budget: 80000, outgo_cash: 0, outgo_card: 146633, outgo_other: 5000, invest_budget: 0, invest_actual: 0, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":141344,\"incomeInvestment\":596888,\"outgoCash\":0,\"outgoPaypay\":5000,\"outgoCard\":146633,\"fundInvestment\":0,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":1171825,\"incomeCashBudget\":40000,\"incomeInvestmentBudget\":0,\"outgoBudget\":80000,\"fundInvestmentBudget\":0,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2025-11", age: 24, cash_prediction: 1774078, cash_actual: 1846392, income_budget: 50000, income_actual: 49634, outgo_budget: 90000, outgo_cash: 0, outgo_card: 132481, outgo_other: 0, invest_budget: 100000, invest_actual: 100000, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":49634,\"incomeInvestment\":179313,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":132481,\"fundInvestment\":0,\"activeInvestment\":100000,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":1774078,\"incomeCashBudget\":50000,\"incomeInvestmentBudget\":50000,\"outgoBudget\":90000,\"fundInvestmentBudget\":0,\"activeInvestmentBudget\":100000,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2025-12", age: 24, cash_prediction: 1756392, cash_actual: 1750291, income_budget: 50000, income_actual: 108390, outgo_budget: 90000, outgo_cash: 0, outgo_card: 110485, outgo_other: 0, invest_budget: 100000, invest_actual: 100000, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":108390,\"incomeInvestment\":27990,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":110485,\"fundInvestment\":0,\"activeInvestment\":100000,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":1756392,\"incomeCashBudget\":50000,\"incomeInvestmentBudget\":50000,\"outgoBudget\":90000,\"fundInvestmentBudget\":0,\"activeInvestmentBudget\":100000,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2026-01", age: 24, cash_prediction: 1460291, cash_actual: 1575030, income_budget: 50000, income_actual: 88650, outgo_budget: 90000, outgo_cash: 6306, outgo_card: 219779, outgo_other: 0, invest_budget: 150000, invest_actual: 150000, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":88650,\"incomeInvestment\":152880,\"outgoCash\":6306,\"outgoPaypay\":0,\"outgoCard\":219779,\"fundInvestment\":0,\"activeInvestment\":150000,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":1460291,\"incomeCashBudget\":50000,\"incomeInvestmentBudget\":50000,\"outgoBudget\":90000,\"fundInvestmentBudget\":0,\"activeInvestmentBudget\":150000,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2026-02", age: 24, cash_prediction: 495030, cash_actual: 435513, income_budget: 50000, income_actual: 107712, outgo_budget: 90000, outgo_cash: 0, outgo_card: 41313, outgo_other: 0, invest_budget: 1060000, invest_actual: 1060000, usd_capital: 1000000, usd_actual: 1603056, note: "{\"shortKActuals\":{\"incomeCash\":107712,\"incomeInvestment\":62550,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":41313,\"fundInvestment\":30000,\"activeInvestment\":30000,\"usdInvestment\":1000000},\"shortKBudgetOverrides\":{\"cashPrediction\":495030,\"incomeCashBudget\":50000,\"incomeInvestmentBudget\":50000,\"outgoBudget\":90000,\"fundInvestmentBudget\":30000,\"activeInvestmentBudget\":30000,\"usdInvestmentBudget\":1000000}}" },
    { id: id(), user_key: USER_KEY, month: "2026-03", age: 24, cash_prediction: 271789, cash_actual: 309983, income_budget: 50000, income_actual: 51168, outgo_budget: 90000, outgo_cash: 0, outgo_card: 102589, outgo_other: 0, invest_budget: 631797, invest_actual: 631797, usd_capital: 1800000, usd_actual: 2403056, note: "{\"shortKActuals\":{\"incomeCash\":51168,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":102589,\"fundInvestment\":30000,\"activeInvestment\":-198203,\"usdInvestment\":800000},\"shortKBudgetOverrides\":{\"cashPrediction\":271789,\"incomeCashBudget\":50000,\"incomeInvestmentBudget\":50000,\"outgoBudget\":90000,\"fundInvestmentBudget\":30000,\"activeInvestmentBudget\":-198203,\"usdInvestmentBudget\":800000}}" },
    { id: id(), user_key: USER_KEY, month: "2026-04", age: 24, cash_prediction: 1119583, cash_actual: 1067341, income_budget: 50000, income_actual: 60347, outgo_budget: 90000, outgo_cash: 0, outgo_card: 92026, outgo_other: 0, invest_budget: -799700, invest_actual: -799700, usd_capital: 1800000, usd_actual: 2403056, note: "{\"shortKActuals\":{\"incomeCash\":60347,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":92026,\"fundInvestment\":-799900,\"activeInvestment\":200,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":1119583,\"incomeCashBudget\":50000,\"incomeInvestmentBudget\":50000,\"outgoBudget\":90000,\"fundInvestmentBudget\":-799900,\"activeInvestmentBudget\":200,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2026-05", age: 24, cash_prediction: 1077241, cash_actual: 1079376, income_budget: 50000, income_actual: 104161, outgo_budget: 90000, outgo_cash: 0, outgo_card: 226901, outgo_other: 0, invest_budget: 100, invest_actual: 100, usd_capital: 1800000, usd_actual: 2303056, note: "{\"shortKActuals\":{\"incomeCash\":104161,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":226901,\"fundInvestment\":100,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":1077241,\"incomeCashBudget\":50000,\"incomeInvestmentBudget\":50000,\"outgoBudget\":90000,\"fundInvestmentBudget\":100,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2026-06", age: 24, cash_prediction: 339376, cash_actual: 152475, income_budget: 50000, income_actual: 50000, outgo_budget: 90000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 750000, invest_actual: 750000, usd_capital: 1000000, usd_actual: 1503056, note: "{\"shortKActuals\":{\"incomeCash\":50000,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":1500000,\"usdInvestment\":-800000},\"shortKBudgetOverrides\":{\"cashPrediction\":339376,\"incomeCashBudget\":50000,\"incomeInvestmentBudget\":50000,\"outgoBudget\":90000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":1500000,\"usdInvestmentBudget\":-800000}}" },
    { id: id(), user_key: USER_KEY, month: "2026-07", age: 25, cash_prediction: 362475, cash_actual: 0, income_budget: 50000, income_actual: 0, outgo_budget: 90000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 1000000, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":362475,\"incomeCashBudget\":50000,\"incomeInvestmentBudget\":300000,\"outgoBudget\":90000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2026-08", age: 25, cash_prediction: 272475, cash_actual: 0, income_budget: 50000, income_actual: 0, outgo_budget: 90000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 1000000, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":272475,\"incomeCashBudget\":50000,\"incomeInvestmentBudget\":0,\"outgoBudget\":90000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2026-09", age: 25, cash_prediction: 782475, cash_actual: 0, income_budget: 1150000, income_actual: 0, outgo_budget: 90000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 550000, invest_actual: 550000, usd_capital: 1000000, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":500000,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":782475,\"incomeCashBudget\":1150000,\"incomeInvestmentBudget\":0,\"outgoBudget\":90000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":500000,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2026-10", age: 25, cash_prediction: 692475, cash_actual: 0, income_budget: 50000, income_actual: 0, outgo_budget: 90000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 1000000, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":692475,\"incomeCashBudget\":50000,\"incomeInvestmentBudget\":0,\"outgoBudget\":90000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2026-11", age: 25, cash_prediction: 602475, cash_actual: 0, income_budget: 50000, income_actual: 0, outgo_budget: 90000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 1000000, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":602475,\"incomeCashBudget\":50000,\"incomeInvestmentBudget\":0,\"outgoBudget\":90000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2026-12", age: 25, cash_prediction: 102475, cash_actual: 0, income_budget: 50000, income_actual: 0, outgo_budget: 500000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 1000000, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":102475,\"incomeCashBudget\":50000,\"incomeInvestmentBudget\":0,\"outgoBudget\":500000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2027-01", age: 25, cash_prediction: 12475, cash_actual: 0, income_budget: 50000, income_actual: 0, outgo_budget: 90000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 1000000, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":12475,\"incomeCashBudget\":50000,\"incomeInvestmentBudget\":0,\"outgoBudget\":90000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2027-02", age: 25, cash_prediction: -77525, cash_actual: 0, income_budget: 50000, income_actual: 0, outgo_budget: 90000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 1000000, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":-77525,\"incomeCashBudget\":50000,\"incomeInvestmentBudget\":0,\"outgoBudget\":90000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2027-03", age: 25, cash_prediction: -167525, cash_actual: 0, income_budget: 50000, income_actual: 0, outgo_budget: 90000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 1000000, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":-167525,\"incomeCashBudget\":50000,\"incomeInvestmentBudget\":0,\"outgoBudget\":90000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2027-04", age: 25, cash_prediction: -337525, cash_actual: 0, income_budget: 180000, income_actual: 0, outgo_budget: 300000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 1000000, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":-337525,\"incomeCashBudget\":180000,\"incomeInvestmentBudget\":0,\"outgoBudget\":300000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2027-05", age: 25, cash_prediction: -387525, cash_actual: 0, income_budget: 180000, income_actual: 0, outgo_budget: 180000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 1000000, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":-387525,\"incomeCashBudget\":180000,\"incomeInvestmentBudget\":0,\"outgoBudget\":180000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2027-06", age: 25, cash_prediction: -437525, cash_actual: 0, income_budget: 180000, income_actual: 0, outgo_budget: 180000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 1000000, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":-437525,\"incomeCashBudget\":180000,\"incomeInvestmentBudget\":0,\"outgoBudget\":180000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2027-07", age: 26, cash_prediction: -182634, cash_actual: 0, income_budget: 180000, income_actual: 0, outgo_budget: 180000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 1000000, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":-182634,\"incomeCashBudget\":180000,\"incomeInvestmentBudget\":304891,\"outgoBudget\":180000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2027-08", age: 26, cash_prediction: -232634, cash_actual: 0, income_budget: 180000, income_actual: 0, outgo_budget: 180000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 1000000, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":-232634,\"incomeCashBudget\":180000,\"incomeInvestmentBudget\":0,\"outgoBudget\":180000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2027-09", age: 26, cash_prediction: -182634, cash_actual: 0, income_budget: 1280000, income_actual: 0, outgo_budget: 180000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 1050000, invest_actual: 1050000, usd_capital: 1000000, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":1000000,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":-182634,\"incomeCashBudget\":1280000,\"incomeInvestmentBudget\":0,\"outgoBudget\":180000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":1000000,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2027-10", age: 26, cash_prediction: -232634, cash_actual: 0, income_budget: 180000, income_actual: 0, outgo_budget: 180000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 1000000, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":-232634,\"incomeCashBudget\":180000,\"incomeInvestmentBudget\":0,\"outgoBudget\":180000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2027-11", age: 26, cash_prediction: -282634, cash_actual: 0, income_budget: 180000, income_actual: 0, outgo_budget: 180000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 1000000, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":-282634,\"incomeCashBudget\":180000,\"incomeInvestmentBudget\":0,\"outgoBudget\":180000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2027-12", age: 26, cash_prediction: -332634, cash_actual: 0, income_budget: 180000, income_actual: 0, outgo_budget: 180000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 1000000, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":-332634,\"incomeCashBudget\":180000,\"incomeInvestmentBudget\":0,\"outgoBudget\":180000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2028-01", age: 26, cash_prediction: 409846, cash_actual: 0, income_budget: 180000, income_actual: 0, outgo_budget: 180000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: -742480, invest_actual: -742480, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":1000000,\"usdInvestment\":-1792480},\"shortKBudgetOverrides\":{\"cashPrediction\":409846,\"incomeCashBudget\":180000,\"incomeInvestmentBudget\":0,\"outgoBudget\":180000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":1000000,\"usdInvestmentBudget\":-1792480}}" },
    { id: id(), user_key: USER_KEY, month: "2028-02", age: 26, cash_prediction: 359846, cash_actual: 0, income_budget: 180000, income_actual: 0, outgo_budget: 180000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":359846,\"incomeCashBudget\":180000,\"incomeInvestmentBudget\":0,\"outgoBudget\":180000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2028-03", age: 26, cash_prediction: 309846, cash_actual: 0, income_budget: 180000, income_actual: 0, outgo_budget: 180000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":309846,\"incomeCashBudget\":180000,\"incomeInvestmentBudget\":0,\"outgoBudget\":180000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2028-04", age: 26, cash_prediction: 259846, cash_actual: 0, income_budget: 180000, income_actual: 0, outgo_budget: 180000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":259846,\"incomeCashBudget\":180000,\"incomeInvestmentBudget\":0,\"outgoBudget\":180000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2028-05", age: 26, cash_prediction: 209846, cash_actual: 0, income_budget: 180000, income_actual: 0, outgo_budget: 180000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":209846,\"incomeCashBudget\":180000,\"incomeInvestmentBudget\":0,\"outgoBudget\":180000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2028-06", age: 26, cash_prediction: 159846, cash_actual: 0, income_budget: 180000, income_actual: 0, outgo_budget: 180000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":159846,\"incomeCashBudget\":180000,\"incomeInvestmentBudget\":0,\"outgoBudget\":180000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2028-07", age: 27, cash_prediction: 607840, cash_actual: 0, income_budget: 180000, income_actual: 0, outgo_budget: 180000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":607840,\"incomeCashBudget\":180000,\"incomeInvestmentBudget\":497995,\"outgoBudget\":180000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2028-08", age: 27, cash_prediction: 557840, cash_actual: 0, income_budget: 180000, income_actual: 0, outgo_budget: 180000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":557840,\"incomeCashBudget\":180000,\"incomeInvestmentBudget\":0,\"outgoBudget\":180000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2028-09", age: 27, cash_prediction: 607840, cash_actual: 0, income_budget: 1280000, income_actual: 0, outgo_budget: 180000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 1050000, invest_actual: 1050000, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":1000000,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":607840,\"incomeCashBudget\":1280000,\"incomeInvestmentBudget\":0,\"outgoBudget\":180000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":1000000,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2028-10", age: 27, cash_prediction: 557840, cash_actual: 0, income_budget: 180000, income_actual: 0, outgo_budget: 180000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":557840,\"incomeCashBudget\":180000,\"incomeInvestmentBudget\":0,\"outgoBudget\":180000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2028-11", age: 27, cash_prediction: 507840, cash_actual: 0, income_budget: 180000, income_actual: 0, outgo_budget: 180000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":507840,\"incomeCashBudget\":180000,\"incomeInvestmentBudget\":0,\"outgoBudget\":180000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2028-12", age: 27, cash_prediction: 457840, cash_actual: 0, income_budget: 180000, income_actual: 0, outgo_budget: 180000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":457840,\"incomeCashBudget\":180000,\"incomeInvestmentBudget\":0,\"outgoBudget\":180000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2029-01", age: 27, cash_prediction: 407840, cash_actual: 0, income_budget: 180000, income_actual: 0, outgo_budget: 180000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":407840,\"incomeCashBudget\":180000,\"incomeInvestmentBudget\":0,\"outgoBudget\":180000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2029-02", age: 27, cash_prediction: 357840, cash_actual: 0, income_budget: 180000, income_actual: 0, outgo_budget: 180000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":357840,\"incomeCashBudget\":180000,\"incomeInvestmentBudget\":0,\"outgoBudget\":180000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2029-03", age: 27, cash_prediction: 307840, cash_actual: 0, income_budget: 180000, income_actual: 0, outgo_budget: 180000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":307840,\"incomeCashBudget\":180000,\"incomeInvestmentBudget\":0,\"outgoBudget\":180000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2029-04", age: 27, cash_prediction: 277840, cash_actual: 0, income_budget: 200000, income_actual: 0, outgo_budget: 180000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":277840,\"incomeCashBudget\":200000,\"incomeInvestmentBudget\":0,\"outgoBudget\":180000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2029-05", age: 27, cash_prediction: 247840, cash_actual: 0, income_budget: 200000, income_actual: 0, outgo_budget: 180000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":247840,\"incomeCashBudget\":200000,\"incomeInvestmentBudget\":0,\"outgoBudget\":180000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2029-06", age: 27, cash_prediction: 217840, cash_actual: 0, income_budget: 200000, income_actual: 0, outgo_budget: 180000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":217840,\"incomeCashBudget\":200000,\"incomeInvestmentBudget\":0,\"outgoBudget\":180000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2029-07", age: 28, cash_prediction: 881316, cash_actual: 0, income_budget: 200000, income_actual: 0, outgo_budget: 180000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":881316,\"incomeCashBudget\":200000,\"incomeInvestmentBudget\":693476,\"outgoBudget\":180000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2029-08", age: 28, cash_prediction: 851316, cash_actual: 0, income_budget: 200000, income_actual: 0, outgo_budget: 180000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":851316,\"incomeCashBudget\":200000,\"incomeInvestmentBudget\":0,\"outgoBudget\":180000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2029-09", age: 28, cash_prediction: 1921316, cash_actual: 0, income_budget: 1300000, income_actual: 0, outgo_budget: 180000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":1921316,\"incomeCashBudget\":1300000,\"incomeInvestmentBudget\":0,\"outgoBudget\":180000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2029-10", age: 28, cash_prediction: 1891316, cash_actual: 0, income_budget: 200000, income_actual: 0, outgo_budget: 180000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":1891316,\"incomeCashBudget\":200000,\"incomeInvestmentBudget\":0,\"outgoBudget\":180000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2029-11", age: 28, cash_prediction: 1861316, cash_actual: 0, income_budget: 200000, income_actual: 0, outgo_budget: 180000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":1861316,\"incomeCashBudget\":200000,\"incomeInvestmentBudget\":0,\"outgoBudget\":180000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2029-12", age: 28, cash_prediction: 1831316, cash_actual: 0, income_budget: 200000, income_actual: 0, outgo_budget: 180000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":1831316,\"incomeCashBudget\":200000,\"incomeInvestmentBudget\":0,\"outgoBudget\":180000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2030-01", age: 28, cash_prediction: 1756316, cash_actual: 0, income_budget: 200000, income_actual: 0, outgo_budget: 225000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":1756316,\"incomeCashBudget\":200000,\"incomeInvestmentBudget\":0,\"outgoBudget\":225000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2030-02", age: 28, cash_prediction: 1681316, cash_actual: 0, income_budget: 200000, income_actual: 0, outgo_budget: 225000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":1681316,\"incomeCashBudget\":200000,\"incomeInvestmentBudget\":0,\"outgoBudget\":225000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2030-03", age: 28, cash_prediction: 1606316, cash_actual: 0, income_budget: 200000, income_actual: 0, outgo_budget: 225000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":1606316,\"incomeCashBudget\":200000,\"incomeInvestmentBudget\":0,\"outgoBudget\":225000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2030-04", age: 28, cash_prediction: 1531316, cash_actual: 0, income_budget: 200000, income_actual: 0, outgo_budget: 225000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":1531316,\"incomeCashBudget\":200000,\"incomeInvestmentBudget\":0,\"outgoBudget\":225000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2030-05", age: 28, cash_prediction: 1456316, cash_actual: 0, income_budget: 200000, income_actual: 0, outgo_budget: 225000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":1456316,\"incomeCashBudget\":200000,\"incomeInvestmentBudget\":0,\"outgoBudget\":225000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2030-06", age: 28, cash_prediction: 1381316, cash_actual: 0, income_budget: 200000, income_actual: 0, outgo_budget: 225000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":1381316,\"incomeCashBudget\":200000,\"incomeInvestmentBudget\":0,\"outgoBudget\":225000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2030-07", age: 29, cash_prediction: 2185306, cash_actual: 0, income_budget: 200000, income_actual: 0, outgo_budget: 225000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":2185306,\"incomeCashBudget\":200000,\"incomeInvestmentBudget\":878990,\"outgoBudget\":225000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2030-08", age: 29, cash_prediction: 2110306, cash_actual: 0, income_budget: 200000, income_actual: 0, outgo_budget: 225000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":2110306,\"incomeCashBudget\":200000,\"incomeInvestmentBudget\":0,\"outgoBudget\":225000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2030-09", age: 29, cash_prediction: 3135306, cash_actual: 0, income_budget: 1300000, income_actual: 0, outgo_budget: 225000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":3135306,\"incomeCashBudget\":1300000,\"incomeInvestmentBudget\":0,\"outgoBudget\":225000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2030-10", age: 29, cash_prediction: 3060306, cash_actual: 0, income_budget: 200000, income_actual: 0, outgo_budget: 225000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":3060306,\"incomeCashBudget\":200000,\"incomeInvestmentBudget\":0,\"outgoBudget\":225000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2030-11", age: 29, cash_prediction: 2985306, cash_actual: 0, income_budget: 200000, income_actual: 0, outgo_budget: 225000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":2985306,\"incomeCashBudget\":200000,\"incomeInvestmentBudget\":0,\"outgoBudget\":225000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2030-12", age: 29, cash_prediction: 2910306, cash_actual: 0, income_budget: 200000, income_actual: 0, outgo_budget: 225000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":2910306,\"incomeCashBudget\":200000,\"incomeInvestmentBudget\":0,\"outgoBudget\":225000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2031-01", age: 29, cash_prediction: 305306, cash_actual: 0, income_budget: 200000, income_actual: 0, outgo_budget: 2755000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":305306,\"incomeCashBudget\":200000,\"incomeInvestmentBudget\":0,\"outgoBudget\":2755000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2031-02", age: 29, cash_prediction: 200306, cash_actual: 0, income_budget: 200000, income_actual: 0, outgo_budget: 255000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":200306,\"incomeCashBudget\":200000,\"incomeInvestmentBudget\":0,\"outgoBudget\":255000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2031-03", age: 29, cash_prediction: 95306, cash_actual: 0, income_budget: 200000, income_actual: 0, outgo_budget: 255000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":95306,\"incomeCashBudget\":200000,\"incomeInvestmentBudget\":0,\"outgoBudget\":255000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2031-04", age: 29, cash_prediction: -9694, cash_actual: 0, income_budget: 200000, income_actual: 0, outgo_budget: 255000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":-9694,\"incomeCashBudget\":200000,\"incomeInvestmentBudget\":0,\"outgoBudget\":255000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2031-05", age: 29, cash_prediction: -114694, cash_actual: 0, income_budget: 200000, income_actual: 0, outgo_budget: 255000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":-114694,\"incomeCashBudget\":200000,\"incomeInvestmentBudget\":0,\"outgoBudget\":255000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
    { id: id(), user_key: USER_KEY, month: "2031-06", age: 29, cash_prediction: -219694, cash_actual: 0, income_budget: 200000, income_actual: 0, outgo_budget: 255000, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 50000, invest_actual: 50000, usd_capital: 0, usd_actual: 0, note: "{\"shortKActuals\":{\"incomeCash\":0,\"incomeInvestment\":0,\"outgoCash\":0,\"outgoPaypay\":0,\"outgoCard\":0,\"fundInvestment\":50000,\"activeInvestment\":0,\"usdInvestment\":0},\"shortKBudgetOverrides\":{\"cashPrediction\":-219694,\"incomeCashBudget\":200000,\"incomeInvestmentBudget\":0,\"outgoBudget\":255000,\"fundInvestmentBudget\":50000,\"activeInvestmentBudget\":0,\"usdInvestmentBudget\":0}}" },
  ],
  investments: [
    { id: id(), user_key: USER_KEY, month: "2024-09", account: "投資信託口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2024-09", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2024-10", account: "投資信託口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2024-10", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2024-11", account: "投資信託口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2024-11", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2024-12", account: "投資信託口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2024-12", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2025-01", account: "投資信託口座", deposit: 1300000, withdrawal: 0, capital: 1300000, predicted_balance: 1300000, actual_balance: 1307698, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2025-01", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2025-02", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 1350000, predicted_balance: 1362554, actual_balance: 1340579, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2025-02", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2025-03", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 1400000, predicted_balance: 1425807, actual_balance: 1373602, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2025-03", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2025-04", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 1450000, predicted_balance: 1489767, actual_balance: 1426268, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2025-04", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2025-05", account: "投資信託口座", deposit: 100, withdrawal: 0, capital: 1450100, predicted_balance: 1504542, actual_balance: 1469120, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2025-05", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2025-06", account: "投資信託口座", deposit: 100, withdrawal: 0, capital: 1450200, predicted_balance: 1519462, actual_balance: 1515308, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2025-06", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2025-07", account: "投資信託口座", deposit: 100, withdrawal: 0, capital: 1450300, predicted_balance: 1534531, actual_balance: 1592485, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2025-07", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2025-08", account: "投資信託口座", deposit: 100, withdrawal: 0, capital: 1450400, predicted_balance: 1549750, actual_balance: 1594137, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2025-08", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2025-09", account: "投資信託口座", deposit: 100000, withdrawal: 0, capital: 1550400, predicted_balance: 1665019, actual_balance: 1760447, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2025-09", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2025-10", account: "投資信託口座", deposit: 100000, withdrawal: 0, capital: 1650400, predicted_balance: 1781595, actual_balance: 1962813, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2025-10", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2025-11", account: "投資信託口座", deposit: 0, withdrawal: 0, capital: 1650400, predicted_balance: 1799490, actual_balance: 1974310, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2025-11", account: "アクティブ口座", deposit: 100000, withdrawal: 0, capital: 100000, predicted_balance: 101465, actual_balance: 97606, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2025-12", account: "投資信託口座", deposit: 0, withdrawal: 0, capital: 1650400, predicted_balance: 1817567, actual_balance: 1999369, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2025-12", account: "アクティブ口座", deposit: 100000, withdrawal: 0, capital: 200000, predicted_balance: 204416, actual_balance: 212860, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2026-01", account: "投資信託口座", deposit: 150000, withdrawal: 0, capital: 1800400, predicted_balance: 1985827, actual_balance: 2131370, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2026-01", account: "アクティブ口座", deposit: 150000, withdrawal: 0, capital: 350000, predicted_balance: 359608, actual_balance: 407644, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2026-02", account: "投資信託口座", deposit: 60000, withdrawal: 0, capital: 1860400, predicted_balance: 2066004, actual_balance: 2214313, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2026-02", account: "アクティブ口座", deposit: 30000, withdrawal: 0, capital: 380000, predicted_balance: 395316, actual_balance: 443325, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2026-03", account: "投資信託口座", deposit: -466412, withdrawal: 0, capital: 1393988, predicted_balance: 1620606, actual_balance: 1668450, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2026-03", account: "アクティブ口座", deposit: -198203, withdrawal: 0, capital: 181797, predicted_balance: 200001, actual_balance: 226673, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2026-04", account: "投資信託口座", deposit: -799800, withdrawal: 0, capital: 594188, predicted_balance: 836591, actual_balance: 938039, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2026-04", account: "アクティブ口座", deposit: 200, withdrawal: 0, capital: 181997, predicted_balance: 203133, actual_balance: 268956, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2026-05", account: "投資信託口座", deposit: 100, withdrawal: 0, capital: 594288, predicted_balance: 845033, actual_balance: 972006, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2026-05", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 181997, predicted_balance: 206109, actual_balance: 346501, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2026-06", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 644288, predicted_balance: 903459, actual_balance: 972252, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2026-06", account: "アクティブ口座", deposit: 1500000, withdrawal: 0, capital: 1681997, predicted_balance: 1731103, actual_balance: 1821483, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2026-07", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 694288, predicted_balance: 962445, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2026-07", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 1681997, predicted_balance: 1756463, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2026-08", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 744288, predicted_balance: 1021996, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2026-08", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 1681997, predicted_balance: 1782194, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2026-09", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 794288, predicted_balance: 1082118, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2026-09", account: "アクティブ口座", deposit: 500000, withdrawal: 0, capital: 2181997, predicted_balance: 2315627, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2026-10", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 844288, predicted_balance: 1142815, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2026-10", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 2181997, predicted_balance: 2349550, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2026-11", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 894288, predicted_balance: 1204094, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2026-11", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 2181997, predicted_balance: 2383970, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2026-12", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 944288, predicted_balance: 1265959, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2026-12", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 2181997, predicted_balance: 2418894, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2027-01", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 994288, predicted_balance: 1328418, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2027-01", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 2181997, predicted_balance: 2454329, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2027-02", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 1044288, predicted_balance: 1391474, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2027-02", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 2181997, predicted_balance: 2490284, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2027-03", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 1094288, predicted_balance: 1455135, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2027-03", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 2181997, predicted_balance: 2526766, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2027-04", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 1144288, predicted_balance: 1519406, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2027-04", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 2181997, predicted_balance: 2563781, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2027-05", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 1194288, predicted_balance: 1584292, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2027-05", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 2181997, predicted_balance: 2601340, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2027-06", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 1244288, predicted_balance: 1649801, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2027-06", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 2181997, predicted_balance: 2639448, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2027-07", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 1294288, predicted_balance: 1715936, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2027-07", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 2181997, predicted_balance: 2678115, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2027-08", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 1344288, predicted_balance: 1782706, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2027-08", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 2181997, predicted_balance: 2717348, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2027-09", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 1394288, predicted_balance: 1850115, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2027-09", account: "アクティブ口座", deposit: 1000000, withdrawal: 0, capital: 3181997, predicted_balance: 3771805, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2027-10", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 1444288, predicted_balance: 1918169, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2027-10", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 3181997, predicted_balance: 3827060, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2027-11", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 1494288, predicted_balance: 1986876, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2027-11", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 3181997, predicted_balance: 3883125, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2027-12", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 1544288, predicted_balance: 2056242, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2027-12", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 3181997, predicted_balance: 3940011, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2028-01", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 1594288, predicted_balance: 2126271, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2028-01", account: "アクティブ口座", deposit: 1000000, withdrawal: 0, capital: 4181997, predicted_balance: 5012379, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2028-02", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 1644288, predicted_balance: 2196972, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2028-02", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 4181997, predicted_balance: 5085808, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2028-03", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 1694288, predicted_balance: 2268351, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2028-03", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 4181997, predicted_balance: 5160313, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2028-04", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 1744288, predicted_balance: 2340413, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2028-04", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 4181997, predicted_balance: 5235909, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2028-05", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 1794288, predicted_balance: 2413166, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2028-05", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 4181997, predicted_balance: 5312613, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2028-06", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 1844288, predicted_balance: 2486616, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2028-06", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 4181997, predicted_balance: 5390440, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2028-07", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 1894288, predicted_balance: 2560769, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2028-07", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 4181997, predicted_balance: 5469407, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2028-08", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 1944288, predicted_balance: 2635634, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2028-08", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 4181997, predicted_balance: 5549531, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2028-09", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 1994288, predicted_balance: 2711215, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2028-09", account: "アクティブ口座", deposit: 1000000, withdrawal: 0, capital: 5181997, predicted_balance: 6645479, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2028-10", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 2044288, predicted_balance: 2787521, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2028-10", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 5181997, predicted_balance: 6742832, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2028-11", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 2094288, predicted_balance: 2864559, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2028-11", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 5181997, predicted_balance: 6841611, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2028-12", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 2144288, predicted_balance: 2942334, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2028-12", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 5181997, predicted_balance: 6941838, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2029-01", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 2194288, predicted_balance: 3020855, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2029-01", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 5181997, predicted_balance: 7043532, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2029-02", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 2244288, predicted_balance: 3100128, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2029-02", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 5181997, predicted_balance: 7146717, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2029-03", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 2294288, predicted_balance: 3180162, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2029-03", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 5181997, predicted_balance: 7251413, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2029-04", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 2344288, predicted_balance: 3260962, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2029-04", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 5181997, predicted_balance: 7357642, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2029-05", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 2394288, predicted_balance: 3342536, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2029-05", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 5181997, predicted_balance: 7465428, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2029-06", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 2444288, predicted_balance: 3424893, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2029-06", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 5181997, predicted_balance: 7574793, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2029-07", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 2494288, predicted_balance: 3508039, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2029-07", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 5181997, predicted_balance: 7685760, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2029-08", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 2544288, predicted_balance: 3591981, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2029-08", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 5181997, predicted_balance: 7798353, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2029-09", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 2594288, predicted_balance: 3676729, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2029-09", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 5181997, predicted_balance: 7912595, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2029-10", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 2644288, predicted_balance: 3762288, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2029-10", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 5181997, predicted_balance: 8028511, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2029-11", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 2694288, predicted_balance: 3848668, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2029-11", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 5181997, predicted_balance: 8146125, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2029-12", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 2744288, predicted_balance: 3935875, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2029-12", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 5181997, predicted_balance: 8265461, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2030-01", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 2794288, predicted_balance: 4023919, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2030-01", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 5181997, predicted_balance: 8386546, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2030-02", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 2844288, predicted_balance: 4112806, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2030-02", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 5181997, predicted_balance: 8509405, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2030-03", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 2894288, predicted_balance: 4202546, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2030-03", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 5181997, predicted_balance: 8634064, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2030-04", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 2944288, predicted_balance: 4293146, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2030-04", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 5181997, predicted_balance: 8760549, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2030-05", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 2994288, predicted_balance: 4384614, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2030-05", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 5181997, predicted_balance: 8888887, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2030-06", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 3044288, predicted_balance: 4476959, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2030-06", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 5181997, predicted_balance: 9019105, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2030-07", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 3094288, predicted_balance: 4570189, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2030-07", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 5181997, predicted_balance: 9151230, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2030-08", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 3144288, predicted_balance: 4664313, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2030-08", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 5181997, predicted_balance: 9285291, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2030-09", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 3194288, predicted_balance: 4759340, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2030-09", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 5181997, predicted_balance: 9421316, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2030-10", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 3244288, predicted_balance: 4855277, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2030-10", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 5181997, predicted_balance: 9559334, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2030-11", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 3294288, predicted_balance: 4952135, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2030-11", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 5181997, predicted_balance: 9699374, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2030-12", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 3344288, predicted_balance: 5049920, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2030-12", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 5181997, predicted_balance: 9841465, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2031-01", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 3394288, predicted_balance: 5148644, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2031-01", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 5181997, predicted_balance: 9985638, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2031-02", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 3444288, predicted_balance: 5248314, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2031-02", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 5181997, predicted_balance: 10131922, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2031-03", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 3494288, predicted_balance: 5348939, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2031-03", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 5181997, predicted_balance: 10280350, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2031-04", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 3544288, predicted_balance: 5450529, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2031-04", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 5181997, predicted_balance: 10430952, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2031-05", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 3594288, predicted_balance: 5553094, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2031-05", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 5181997, predicted_balance: 10583761, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2031-06", account: "投資信託口座", deposit: 50000, withdrawal: 0, capital: 3644288, predicted_balance: 5656641, actual_balance: 0, monthly_return_rate: 0.15 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2031-06", account: "アクティブ口座", deposit: 0, withdrawal: 0, capital: 5181997, predicted_balance: 10738808, actual_balance: 0, monthly_return_rate: 0.18 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2024-08", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2024-09", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2024-10", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2024-11", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2024-12", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2025-01", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2025-02", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2025-03", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2025-04", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2025-05", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2025-06", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2025-07", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2025-08", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2025-09", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2025-10", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2025-11", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2025-12", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2026-01", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2026-02", account: "FX口座", deposit: 1000000, withdrawal: 0, capital: 1000000, predicted_balance: 1000000, actual_balance: 1603056, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2026-03", account: "FX口座", deposit: 800000, withdrawal: 0, capital: 1800000, predicted_balance: 1831200, actual_balance: 2403056, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2026-04", account: "FX口座", deposit: 0, withdrawal: 0, capital: 1800000, predicted_balance: 1887360, actual_balance: 2403056, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2026-05", account: "FX口座", deposit: 0, withdrawal: 0, capital: 1800000, predicted_balance: 1943520, actual_balance: 2303056, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2026-06", account: "FX口座", deposit: -800000, withdrawal: 0, capital: 1000000, predicted_balance: 1199680, actual_balance: 1503056, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2026-07", account: "FX口座", deposit: 0, withdrawal: 0, capital: 1000000, predicted_balance: 1230880, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2026-08", account: "FX口座", deposit: 0, withdrawal: 0, capital: 1000000, predicted_balance: 1262080, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2026-09", account: "FX口座", deposit: 0, withdrawal: 0, capital: 1000000, predicted_balance: 1293280, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2026-10", account: "FX口座", deposit: 0, withdrawal: 0, capital: 1000000, predicted_balance: 1324480, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2026-11", account: "FX口座", deposit: 0, withdrawal: 0, capital: 1000000, predicted_balance: 1355680, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2026-12", account: "FX口座", deposit: 0, withdrawal: 0, capital: 1000000, predicted_balance: 1386880, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2027-01", account: "FX口座", deposit: 0, withdrawal: 0, capital: 1000000, predicted_balance: 1418080, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2027-02", account: "FX口座", deposit: 0, withdrawal: 0, capital: 1000000, predicted_balance: 1449280, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2027-03", account: "FX口座", deposit: 0, withdrawal: 0, capital: 1000000, predicted_balance: 1480480, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2027-04", account: "FX口座", deposit: 0, withdrawal: 0, capital: 1000000, predicted_balance: 1511680, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2027-05", account: "FX口座", deposit: 0, withdrawal: 0, capital: 1000000, predicted_balance: 1542880, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2027-06", account: "FX口座", deposit: 0, withdrawal: 0, capital: 1000000, predicted_balance: 1574080, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2027-07", account: "FX口座", deposit: 0, withdrawal: 0, capital: 1000000, predicted_balance: 1605280, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2027-08", account: "FX口座", deposit: 0, withdrawal: 0, capital: 1000000, predicted_balance: 1636480, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2027-09", account: "FX口座", deposit: 0, withdrawal: 0, capital: 1000000, predicted_balance: 1667680, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2027-10", account: "FX口座", deposit: 0, withdrawal: 0, capital: 1000000, predicted_balance: 1698880, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2027-11", account: "FX口座", deposit: 0, withdrawal: 0, capital: 1000000, predicted_balance: 1730080, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2027-12", account: "FX口座", deposit: 0, withdrawal: 0, capital: 1000000, predicted_balance: 1761280, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2028-01", account: "FX口座", deposit: -1792480, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2028-02", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2028-03", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2028-04", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2028-05", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2028-06", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2028-07", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2028-08", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2028-09", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2028-10", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2028-11", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2028-12", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2029-01", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2029-02", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2029-03", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2029-04", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2029-05", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2029-06", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2029-07", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2029-08", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2029-09", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2029-10", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2029-11", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2029-12", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2030-01", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2030-02", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2030-03", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2030-04", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2030-05", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2030-06", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2030-07", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2030-08", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2030-09", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2030-10", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2030-11", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2030-12", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2031-01", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2031-02", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2031-03", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2031-04", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2031-05", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
    { id: id(), user_key: USER_KEY, month: "2031-06", account: "FX口座", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.1 , note: "" },
  ],
  funds: [
    { id: id(), user_key: USER_KEY, date: "2026-06-02", name: "eMAXIS Neo 宇宙開発", price: 64599, change_amount: -3401, nav_million: 71112, units: 49766 },
    { id: id(), user_key: USER_KEY, date: "2026-06-02", name: "ROBOPRO ファンド", price: 15591, change_amount: -36, nav_million: 421084, units: 477209 },
    { id: id(), user_key: USER_KEY, date: "2026-06-02", name: "mega10", price: 11120, change_amount: -12, nav_million: 64524, units: 205248 },
  ],
  tickers: [
    { id: id(), user_key: USER_KEY, ticker: "SOXL", price: 164.18, shares: 0.0 },
    { id: id(), user_key: USER_KEY, ticker: "LUNR", price: 33.89, shares: 0.0 },
    { id: id(), user_key: USER_KEY, ticker: "RKLB", price: 124.77, shares: 0.0 },
    { id: id(), user_key: USER_KEY, ticker: "MU", price: 724.66, shares: 0.0 },
    { id: id(), user_key: USER_KEY, ticker: "LITE", price: 970.7, shares: 0.0 },
    { id: id(), user_key: USER_KEY, ticker: "BE", price: 275.95, shares: 0.0 },
    { id: id(), user_key: USER_KEY, ticker: "VRT", price: 370.94, shares: 0.0 },
    { id: id(), user_key: USER_KEY, ticker: "DDOG", price: 207.98, shares: 0.0 },
    { id: id(), user_key: USER_KEY, ticker: "PWR", price: 769.99, shares: 0.0 },
    { id: id(), user_key: USER_KEY, ticker: "RIOT", price: 23.47, shares: 0.0 },
    { id: id(), user_key: USER_KEY, ticker: "USDJPY", price: 156.635, shares: 0.0 },
  ],
  fxTrades: [
    { id: id(), user_key: USER_KEY, date: "2026-01-03", result: 800, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-01-03", result: 4200, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-01-05", result: 1300, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-01-05", result: 7100, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-01-05", result: 2500, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-01-07", result: 2950, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-01-07", result: 14400, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-01-07", result: 4000, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-01-07", result: 2300, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-01-07", result: 600, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-01-07", result: 1000, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-01-07", result: 6100, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-01-24", result: 20560, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-01-26", result: 2200, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-01-26", result: 2300, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-01-26", result: 4700, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-01-26", result: 1900, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-01-26", result: 3400, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-01-27", result: 3200, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-01-27", result: -4500, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-01-27", result: 1000, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-01-27", result: 10000, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-01-29", result: 21570, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-01-29", result: 5500, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-01-29", result: 5200, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-01-29", result: 1200, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-01-29", result: 9600, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-01-30", result: 6200, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-01-30", result: 5900, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-01-30", result: 600, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-01-30", result: 5100, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-02-12", result: 34720, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-02-12", result: 90800, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-02-13", result: 41900, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-02-13", result: 1500, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-02-18", result: 73280, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-02-19", result: 10000, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-02-19", result: 31400, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-02-19", result: 31000, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-02-19", result: 40900, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-02-20", result: 21500, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-02-20", result: 10800, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-02-20", result: 60150, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-02-20", result: 15300, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-02-20", result: 750, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-02-21", result: 53400, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-02-21", result: 20250, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-02-21", result: 2700, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-02-21", result: 22200, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-02-23", result: 62100, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-02-23", result: 4350, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-02-23", result: 6000, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-02-23", result: 10500, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-02-24", result: 20106, memo: null },
  ],
  fxRisk: {
    id: id(),
    user_key: USER_KEY,
    margin: 1603056,
    units: 180000,
    contract_rate: 154.673,
    current_rate: 155,
    leverage: 10,
    swap_per_unit: -140,
    holding_days: 0,
    extra_margin: 800000,
  },
};

function normalizeState(raw: Partial<FinanceState> | null | undefined): FinanceState {
  const state = raw ?? {};
  return {
    ...defaultState,
    ...state,
    monthly: Array.isArray(state.monthly) ? state.monthly : defaultState.monthly,
    investments: Array.isArray(state.investments) ? state.investments : defaultState.investments,
    funds: Array.isArray(state.funds) ? state.funds : defaultState.funds,
    tickers: Array.isArray(state.tickers) ? state.tickers : defaultState.tickers,
    fxTrades: Array.isArray(state.fxTrades) ? state.fxTrades : defaultState.fxTrades,
    fxRisk: state.fxRisk ?? defaultState.fxRisk,
  } as FinanceState;
}

function stateScore(state: FinanceState) {
  return (
    state.monthly.length * 10 +
    state.investments.length * 4 +
    state.funds.length * 3 +
    state.tickers.length * 3 +
    state.fxTrades.length
  );
}

function isMeaningfulState(state: FinanceState) {
  return stateScore(state) > stateScore(defaultState) ||
    state.monthly.some((row) => row.cash_actual || row.income_actual || row.outgo_cash || row.outgo_card || row.outgo_other || row.invest_actual || row.usd_actual) ||
    state.investments.some((row) => row.actual_balance || row.deposit || row.withdrawal) ||
    state.funds.some((row) => row.units || row.price) ||
    state.tickers.some((row) => row.shares || row.price) ||
    state.fxTrades.some((row) => row.result);
}

function readLocalKey(key: string): FinanceState | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    return normalizeState(JSON.parse(raw) as Partial<FinanceState>);
  } catch {
    return null;
  }
}

function loadLocal(): FinanceState {
  const candidates = [STORAGE_KEY, BACKUP_KEY, LAST_GOOD_KEY]
    .map(readLocalKey)
    .filter((item): item is FinanceState => Boolean(item));
  if (!candidates.length) return defaultState;
  const bestLocal = candidates.sort((a, b) => stateScore(b) - stateScore(a))[0];
  return stateScore(bestLocal) >= stateScore(defaultState) ? bestLocal : defaultState;
}

function saveLocal(state: FinanceState) {
  if (typeof window === "undefined") return;
  const serialized = JSON.stringify(state);
  window.localStorage.setItem(STORAGE_KEY, serialized);
  window.localStorage.setItem(BACKUP_KEY, serialized);
  if (isMeaningfulState(state)) {
    window.localStorage.setItem(LAST_GOOD_KEY, serialized);
  }
}

function hasRemoteData(state: FinanceState) {
  return Boolean(
    state.monthly.length ||
      state.investments.length ||
      state.funds.length ||
      state.tickers.length ||
      state.fxTrades.length ||
      state.fxRisk,
  );
}

export async function loadFinanceState(): Promise<FinanceState> {
  const local = loadLocal();
  if (!supabase) return local;

  const [monthly, investments, funds, tickers, fxTrades, fxRiskRows] = await Promise.all([
    supabase.from("finance_monthly_records").select("*").eq("user_key", USER_KEY).order("month", { ascending: true }),
    supabase.from("finance_investment_records").select("*").eq("user_key", USER_KEY).order("month", { ascending: true }),
    supabase.from("finance_fund_records").select("*").eq("user_key", USER_KEY).order("date", { ascending: false }),
    supabase.from("finance_ticker_holdings").select("*").eq("user_key", USER_KEY).order("ticker", { ascending: true }),
    supabase.from("finance_fx_trades").select("*").eq("user_key", USER_KEY).order("date", { ascending: false }),
    supabase.from("finance_fx_risk_inputs").select("*").eq("user_key", USER_KEY).limit(1),
  ]);

  const error = monthly.error || investments.error || funds.error || tickers.error || fxTrades.error || fxRiskRows.error;
  if (error) throw error;

  const remoteState = normalizeState({
    monthly: (monthly.data ?? []) as MonthlyRecord[],
    investments: (investments.data ?? []) as InvestmentRecord[],
    funds: (funds.data ?? []) as FundRecord[],
    tickers: (tickers.data ?? []) as TickerHolding[],
    fxTrades: (fxTrades.data ?? []) as FxTrade[],
    fxRisk: (fxRiskRows.data?.[0] as FxRiskInput | undefined) ?? undefined,
  });

  if (hasRemoteData(remoteState) && stateScore(remoteState) >= stateScore(defaultState)) {
    saveLocal(remoteState);
    return remoteState;
  }

  if (isMeaningfulState(local)) {
    return local;
  }

  return defaultState;
}

async function syncTable<T extends { id: string; user_key: string }>(
  table: string,
  rows: T[],
) {
  if (!supabase) return;

  if (rows.length) {
    const { error: upsertError } = await supabase.from(table).upsert(rows, { onConflict: "id" });
    if (upsertError) throw upsertError;
  }

  const existing = await supabase.from(table).select("id").eq("user_key", USER_KEY);
  if (existing.error) throw existing.error;

  const nextIds = new Set(rows.map((row) => row.id));
  const idsToDelete = (existing.data ?? [])
    .map((row) => row.id as string)
    .filter((existingId) => !nextIds.has(existingId));

  if (idsToDelete.length) {
    const { error: deleteError } = await supabase.from(table).delete().in("id", idsToDelete);
    if (deleteError) throw deleteError;
  }
}

export async function persistFinanceState(state: FinanceState): Promise<void> {
  const normalized = normalizeState(state);
  saveLocal(normalized);

  if (!supabase) return;

  await syncTable("finance_monthly_records", normalized.monthly);
  await syncTable("finance_investment_records", normalized.investments);
  await syncTable("finance_fund_records", normalized.funds);
  await syncTable("finance_ticker_holdings", normalized.tickers);
  await syncTable("finance_fx_trades", normalized.fxTrades);

  const { error: fxRiskError } = await supabase
    .from("finance_fx_risk_inputs")
    .upsert(normalized.fxRisk, { onConflict: "id" });
  if (fxRiskError) throw fxRiskError;
}

export function newMonthlyRecord(): MonthlyRecord {
  const month = new Date().toISOString().slice(0, 7);
  return {
    id: id(), user_key: USER_KEY, month, age: 25, cash_prediction: 0, cash_actual: 0, income_budget: 0, income_actual: 0,
    outgo_budget: 0, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 0, invest_actual: 0, usd_capital: 0, usd_actual: 0, note: null,
  };
}

export function newInvestmentRecord(): InvestmentRecord {
  const month = new Date().toISOString().slice(0, 7);
  return { id: id(), user_key: USER_KEY, month, account: "INDEX", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.0095, note: null };
}

export function newFundRecord(): FundRecord {
  return { id: id(), user_key: USER_KEY, date: new Date().toISOString().slice(0, 10), name: fundNames[0], price: 0, change_amount: 0, nav_million: 0, units: 0 };
}

export function newTickerHolding(): TickerHolding {
  return { id: id(), user_key: USER_KEY, ticker: "", price: 0, shares: 0 };
}

export function newFxTrade(): FxTrade {
  return { id: id(), user_key: USER_KEY, date: new Date().toISOString().slice(0, 10), result: 0, memo: null };
}
