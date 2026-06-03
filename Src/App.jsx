import { useState, useMemo, useEffect } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

const SETUPS = ["Breakout", "Pullback", "Reversión", "Soporte", "Resistencia", "Momentum", "Scalp", "Otro"];
const EMOTIONS = ["Neutral", "Confiado", "Ansioso", "FOMO", "Revenge", "Eufórico", "Miedoso"];
const SYMBOLS = ["EUR/USD", "GBP/USD", "USD/JPY", "BTC/USD", "ETH/USD", "SPX500", "NAS100", "XAU/USD", "Otro"];
const STORAGE_KEY = "tradelog-trades";

const emptyTrade = {
  date: new Date().toISOString().split("T")[0],
  symbol: "EUR/USD", direction: "LONG",
  entry: "", exit: "", size: "", result: "", pips: "", duration: "",
  setup: "Breakout", emotion: "Neutral", notes: "",
};

const fmt = (n) => (n >= 0 ? `+$${Number(n).toFixed(0)}` : `-$${Math.abs(Number(n)).toFixed(0)}`);
const fmtNum = (n) => (Number(n) >= 0 ? `+${n}` : `${n}`);

export default function TradingJournal() {
  const [tab, setTab] = useState("dashboard");
  const [trades, setTrades] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyTrade);
  const [editId, setEditId] = useState(null);
  const [filterSymbol, setFilterSymbol] = useState("Todos");
  const [filterDir, setFilterDir] = useState("Todos");
  const [filterSetup, setFilterSetup] = useState("Todos");
  const [deleteId, setDeleteId] = useState(null);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setTrades(JSON.parse(saved));
    } catch (_) {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } catch (_) {}
  }, [trades, loaded]);

  const stats = useMemo(() => {
    const wins = trades.filter((t) => Number(t.result) > 0);
    const losses = trades.filter((t) => Number(t.result) < 0);
    const totalPnL = trades.reduce((s, t) => s + Number(t.result), 0);
    const winRate = trades.length ? (wins.length / trades.length) * 100 : 0;
    const avgWin = wins.length ? wins.reduce((s, t) => s + Number(t.result), 0) / wins.length : 0;
    const avgLoss = losses.length ? losses.reduce((s, t) => s + Number(t.result), 0) / losses.length : 0;
    const rr = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0;
    let cum = 0;
    const equity = [...trades].sort((a,b) => a.date.localeCompare(b.date)).map((t) => {
      cum += Number(t.result);
      return { date: t.date.slice(5), pnl: cum };
    });
    let peak = 0, maxDD = 0;
    equity.forEach(({ pnl }) => {
      if (pnl > peak) peak = pnl;
      const dd = peak - pnl;
      if (dd > maxDD) maxDD = dd;
    });
    const bySymbol = {};
    trades.forEach((t) => {
      if (!bySymbol[t.symbol]) bySymbol[t.symbol] = { pnl: 0, count: 0 };
      bySymbol[t.symbol].pnl += Number(t.result);
      bySymbol[t.symbol].count += 1;
    });
    const bySetup = {};
    trades.forEach((t) => {
      if (!bySetup[t.setup]) bySetup[t.setup] = { pnl: 0, count: 0, wins: 0 };
      bySetup[t.setup].pnl += Number(t.result);
      bySetup[t.setup].count += 1;
      if (Number(t.result) > 0) bySetup[t.setup].wins += 1;
    });
    const byEmotion = {};
    trades.forEach((t) => {
      if (!byEmotion[t.emotion]) byEmotion[t.emotion] = { pnl: 0, count: 0 };
      byEmotion[t.emotion].pnl += Number(t.result);
      byEmotion[t.emotion].count += 1;
    });
    return {
      wins, losses, totalPnL, winRate, avgWin, avgLoss, rr, equity, maxDD,
      symbolData: Object.entries(bySymbol).map(([name, d]) => ({ name, ...d })),
      setupData: Object.entries(bySetup).map(([name, d]) => ({ name, ...d, wr: ((d.wins / d.count) * 100).toFixed(0) })),
      emotionData: Object.entries(byEmotion).map(([name, d]) => ({ name, ...d })),
    };
  }, [trades]);

  const filtered = useMemo(() => trades.filter((t) => {
    if (filterSymbol !== "Todos" && t.symbol !== filterSymbol) return false;
    if (filterDir !== "Todos" && t.direction !== filterDir) return false;
    if (filterSetup !== "Todos" && t.setup !== filterSetup) return false;
    return true;
  }), [trades, filterSymbol, filterDir, filterSetup]);

  const openNew = () => { setForm({ ...emptyTrade, date: new Date().toISOString().split("T")[0] }); setEditId(null); setShowForm(true); };
  const openEdit = (t) => { setForm({ ...t }); setEditId(t.id); setShowForm(true); };
  const saveTrade = () => {
    if (!form.symbol || form.entry === "" || form.result === "") return;
    const t = { ...form, entry: +form.entry, exit: +form.exit, size: +form.size, result: +form.result, pips: +form.pips };
    if (editId) {
      setTrades((prev) => prev.map((x) => (x.id === editId ? { ...t, id: editId } : x)));
    } else {
      setTrades((prev) => [...prev, { ...t, id: Date.now() }]);
    }
    setShowForm(false);
  };
  const deleteTrade = (id) => { setTrades((prev) => prev.filter((t) => t.id !== id)); setDeleteId(null); };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload?.length) return (
      <div style={{ background: "#0e1117", border: "1px solid #1e2d3d", borderRadius: 8, padding: "8px 14px", fontSize: 12,
