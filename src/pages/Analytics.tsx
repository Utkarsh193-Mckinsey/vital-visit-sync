import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageContainer, PageHeader } from '@/components/layout/PageContainer';
import { TabletCard } from '@/components/ui/tablet-card';
import { Badge } from '@/components/ui/badge';
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from '@/components/ui/chart';
import {
  PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, BarChart, Bar, Tooltip,
} from 'recharts';
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns';
import { TrendingUp, Users, PhoneCall, BarChart3 } from 'lucide-react';

const COLORS = ['hsl(122, 39%, 45%)', 'hsl(207, 77%, 51%)', 'hsl(33, 96%, 49%)', 'hsl(1, 76%, 55%)'];

export default function Analytics() {
  const [loading, setLoading] = useState(true);

  // Confirmation method breakdown
  const [confirmMethods, setConfirmMethods] = useState<{ name: string; value: number }[]>([]);
  // No-show trend (last 30 days)
  const [noShowTrend, setNoShowTrend] = useState<{ date: string; count: number }[]>([]);
  // Recovery stats
  const [totalNoShows, setTotalNoShows] = useState(0);
  const [recoveredNoShows, setRecoveredNoShows] = useState(0);
  // New vs returning no-show
  const [newPatientNoShows, setNewPatientNoShows] = useState(0);
  const [returningNoShows, setReturningNoShows] = useState(0);
  // Busiest hours
  const [hourlyData, setHourlyData] = useState<{ hour: string; count: number }[]>([]);
  // Day of week data
  const [dowData, setDowData] = useState<{ day: string; count: number; noShows: number }[]>([]);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
    const today = format(new Date(), 'yyyy-MM-dd');

    const [allAptsRes, commsRes, noShowAptsRes] = await Promise.all([
      supabase.from('appointments').select('*').gte('appointment_date', thirtyDaysAgo).lte('appointment_date', today),
      supabase.from('appointment_communications').select('channel, ai_parsed_intent').gte('created_at', subDays(new Date(), 30).toISOString()),
      supabase.from('appointments').select('*').eq('status', 'no_show').gte('appointment_date', thirtyDaysAgo),
    ]);

    const allApts = allAptsRes.data || [];
    const comms = commsRes.data || [];
    const noShowApts = noShowAptsRes.data || [];

    // 1. Confirmation method breakdown
    const confirmed = allApts.filter((a: any) => a.confirmation_status && a.confirmation_status !== 'unconfirmed' && a.confirmation_status !== 'message_sent');
    const whatsappCount = confirmed.filter((a: any) => a.confirmation_status === 'confirmed_whatsapp').length;
    const callCount = confirmed.filter((a: any) => ['confirmed_call', 'double_confirmed'].includes(a.confirmation_status)).length;
    const manualCount = confirmed.filter((a: any) => a.confirmation_status === 'confirmed_manual').length;
    const neverCount = allApts.filter((a: any) => !a.confirmation_status || a.confirmation_status === 'unconfirmed' || a.confirmation_status === 'message_sent').length;
    setConfirmMethods([
      { name: 'WhatsApp', value: whatsappCount },
      { name: 'VAPI Call', value: callCount },
      { name: 'Manual', value: manualCount },
      { name: 'Never Confirmed', value: neverCount },
    ].filter(m => m.value > 0));

    // 2. No-show trend
    const trendMap: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = format(subDays(new Date(), i), 'yyyy-MM-dd');
      trendMap[d] = 0;
    }
    noShowApts.forEach((a: any) => {
      if (trendMap[a.appointment_date] !== undefined) trendMap[a.appointment_date]++;
    });
    setNoShowTrend(Object.entries(trendMap).map(([date, count]) => ({
      date: format(new Date(date + 'T00:00:00'), 'MMM d'),
      count,
    })));

    // 3. Recovery
    setTotalNoShows(noShowApts.length);
    const recovered = noShowApts.filter((a: any) => a.followup_status === 'stopped' || a.followup_status === 'completed').length;
    setRecoveredNoShows(recovered);

    // 4. New vs Returning no-show rate
    setNewPatientNoShows(noShowApts.filter((a: any) => a.is_new_patient).length);
    setReturningNoShows(noShowApts.filter((a: any) => !a.is_new_patient).length);

    // 5. Busiest time slots
    const hourMap: Record<string, number> = {};
    allApts.forEach((a: any) => {
      const h = (a.appointment_time || '09:00').slice(0, 2);
      hourMap[h] = (hourMap[h] || 0) + 1;
    });
    setHourlyData(
      Object.entries(hourMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([hour, count]) => ({ hour: `${hour}:00`, count }))
    );

    // 6. Day of week
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dowMap: Record<number, { count: number; noShows: number }> = {};
    for (let i = 0; i < 7; i++) dowMap[i] = { count: 0, noShows: 0 };
    allApts.forEach((a: any) => {
      const dow = new Date(a.appointment_date + 'T00:00:00').getDay();
      dowMap[dow].count++;
      if (a.status === 'no_show') dowMap[dow].noShows++;
    });
    setDowData(Object.entries(dowMap).map(([k, v]) => ({
      day: dayNames[Number(k)],
      count: v.count,
      noShows: v.noShows,
    })));

    setLoading(false);
  };

  const recoveryRate = totalNoShows > 0 ? Math.round((recoveredNoShows / totalNoShows) * 100) : 0;
  const totalConfirmMethods = confirmMethods.reduce((s, m) => s + m.value, 0);

  if (loading) {
    return (
      <PageContainer maxWidth="full">
        <div className="flex justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="full">
      <PageHeader title="Analytics" subtitle="Last 30 days overview" />

      {/* Top summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <TabletCard className="p-5">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="h-5 w-5 text-success" />
            <span className="text-sm font-medium text-muted-foreground">Follow-up Recovery Rate</span>
          </div>
          <p className="text-3xl font-bold text-foreground">{recoveryRate}%</p>
          <p className="text-xs text-muted-foreground">{recoveredNoShows} of {totalNoShows} no-shows recovered</p>
        </TabletCard>

        <TabletCard className="p-5">
          <div className="flex items-center gap-3 mb-2">
            <Users className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">New Patient No-Shows</span>
          </div>
          <p className="text-3xl font-bold text-foreground">{newPatientNoShows}</p>
          <p className="text-xs text-muted-foreground">vs {returningNoShows} returning patient no-shows</p>
        </TabletCard>

        <TabletCard className="p-5">
          <div className="flex items-center gap-3 mb-2">
            <BarChart3 className="h-5 w-5 text-warning" />
            <span className="text-sm font-medium text-muted-foreground">Total No-Shows (30d)</span>
          </div>
          <p className="text-3xl font-bold text-foreground">{totalNoShows}</p>
          <p className="text-xs text-muted-foreground">Across all appointment types</p>
        </TabletCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Confirmation Method Pie Chart */}
        <TabletCard className="p-5">
          <h3 className="text-base font-semibold text-foreground mb-4">Confirmation Method Breakdown</h3>
          {confirmMethods.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
          ) : (
            <div className="flex items-center gap-6">
              <div className="w-48 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={confirmMethods} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                      {confirmMethods.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {confirmMethods.map((m, i) => (
                  <div key={m.name} className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-sm text-foreground">{m.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {totalConfirmMethods > 0 ? Math.round((m.value / totalConfirmMethods) * 100) : 0}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabletCard>

        {/* No-Show Trend Line Chart */}
        <TabletCard className="p-5">
          <h3 className="text-base font-semibold text-foreground mb-4">No-Show Rate Trend (30 Days)</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={noShowTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} interval={4} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} name="No-Shows" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </TabletCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Busiest Time Slots */}
        <TabletCard className="p-5">
          <h3 className="text-base font-semibold text-foreground mb-4">Busiest Time Slots</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Appointments" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TabletCard>

        {/* Day of Week Breakdown */}
        <TabletCard className="p-5">
          <h3 className="text-base font-semibold text-foreground mb-4">Appointments by Day of Week</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dowData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Total" />
                <Bar dataKey="noShows" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="No-Shows" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TabletCard>
      </div>
    </PageContainer>
  );
}
