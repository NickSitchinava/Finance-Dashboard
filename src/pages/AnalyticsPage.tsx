import { useState, useEffect } from "react";
import StatCard from "../components/ui/StatCard";
import RevenueAreaChart from "../components/charts/RevenueAreaChart";
import NewClientsBarChart from "../components/charts/NewClientsBarChart";
import TopClientsTable from "../components/tables/TopClientsTable";
import { supabase } from "../lib/supabase";
import { useAuth } from "../components/auth/AuthProvider";
import { useCurrency } from "../hooks/useCurrency";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function AnalyticsPage() {
  const { user } = useAuth();
  const { format } = useCurrency();
  const [loading, setLoading] = useState(true);

  const [analyticsKPIs, setAnalyticsKPIs] = useState<any[]>([
    { label: "YTD Revenue", value: format(0) },
    { label: "YTD Clients", value: "0" },
    { label: "Avg Project Value", value: format(0) },
  ]);
  const [revenueAreaData, setRevenueAreaData] = useState<any[]>([]);
  const [newClientsPerMonth, setNewClientsPerMonth] = useState<any[]>([]);
  const [topClients, setTopClients] = useState<any[]>([]);

  useEffect(() => {
    async function fetchAnalytics() {
      if (!user) return;
      setLoading(true);

      const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();

      const [
        { data: clients },
        { data: transactions },
        { data: projects },
      ] = await Promise.all([
        supabase.from("clients").select("*"),
        supabase.from("transactions").select("*").eq("type", "Income"),
        supabase.from("projects").select("*, clients(name)"),
      ]);

      if (!clients || !transactions || !projects) {
        setLoading(false);
        return;
      }

      const ytdTransactions = transactions.filter(
        (t) => new Date(t.date) >= new Date(yearStart)
      );
      const ytdRevenue = ytdTransactions.reduce(
        (sum, t) => sum + Number(t.amount), 0
      );
      const ytdClientsCount = clients.filter(
        (c) => new Date(c.created_at) >= new Date(yearStart)
      ).length;
      const completedProjects = projects.filter(
        (p) => p.status === "Completed"
      ).length;
      const totalRevenue = transactions.reduce(
        (sum, t) => sum + Number(t.amount), 0
      );
      const avgProjValue =
        completedProjects > 0
          ? Math.round(totalRevenue / completedProjects)
          : 0;

      setAnalyticsKPIs([
        { label: "YTD Revenue", value: format(ytdRevenue) },
        { label: "YTD Clients", value: ytdClientsCount.toString() },
        { label: "Avg Project Value", value: format(avgProjValue) },
      ]);

      const revMap: Record<string, number> = {};
      const clientMap: Record<string, number> = {};

      transactions.forEach((t) => {
        const mStr = MONTHS[new Date(t.date).getUTCMonth()];
        revMap[mStr] = (revMap[mStr] || 0) + Number(t.amount);
      });

      clients.forEach((c) => {
        const mStr = MONTHS[new Date(c.created_at).getUTCMonth()];
        clientMap[mStr] = (clientMap[mStr] || 0) + 1;
      });

      const curMonth = new Date().getUTCMonth();
      const last12 = [];
      for (let i = 11; i >= 0; i--) {
        let mIndex = curMonth - i;
        if (mIndex < 0) mIndex += 12;
        const label = MONTHS[mIndex];
        last12.push({
          month: label,
          revenue: revMap[label] || 0,
          clients: clientMap[label] || 0,
        });
      }

      setRevenueAreaData(
        last12.map((item) => ({ month: item.month, revenue: item.revenue }))
      );
      setNewClientsPerMonth(
        last12.slice(6).map((item) => ({ month: item.month, clients: item.clients }))
      );

      const clientAgg: Record<string, any> = {};
      clients.forEach((c) => {
        clientAgg[c.id] = {
          client: c.name,
          projectsCompleted: 0,
          totalRevenue: 0,
          lastActive: c.created_at,
        };
      });

      projects.forEach((p) => {
        if (p.status === "Completed" && p.client_id && clientAgg[p.client_id]) {
          clientAgg[p.client_id].projectsCompleted += 1;
        }
      });

      transactions.forEach((t) => {
        if (t.client_id && clientAgg[t.client_id]) {
          clientAgg[t.client_id].totalRevenue += Number(t.amount);
          if (new Date(t.date) > new Date(clientAgg[t.client_id].lastActive)) {
            clientAgg[t.client_id].lastActive = t.date;
          }
        }
      });

      const sortedClients = Object.values(clientAgg)
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 5)
        .map((c) => ({
          client: c.client,
          projectsCompleted: c.projectsCompleted,
          totalRevenue: format(c.totalRevenue),
          lastActive: new Date(c.lastActive).toLocaleDateString([], {
            month: "short",
            day: "2-digit",
            year: "numeric",
          }),
        }));

      setTopClients(sortedClients);
      setLoading(false);
    }

    fetchAnalytics();
  }, [user]);

  return (
    <div className="page">
      <div className="page__row page__row--3">
        {analyticsKPIs.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </div>

      <div className="page__row page__row--full">
        {loading ? (
          <div className="page-loading">Loading analytics...</div>
        ) : (
          <RevenueAreaChart data={revenueAreaData} />
        )}
      </div>

      <div className="page__row page__row--1-1">
        <NewClientsBarChart data={newClientsPerMonth} />
        <TopClientsTable data={topClients} />
      </div>
    </div>
  );
}