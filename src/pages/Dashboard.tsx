import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { PageContainer, PageHeader } from '@/components/layout/PageContainer';
import { TabletCard } from '@/components/ui/tablet-card';
import { TabletButton } from '@/components/ui/tablet-button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  CalendarDays, Users, Bot, UserX, TrendingUp, TrendingDown,
  Clock, CheckCircle, AlertCircle, Minus, Send
} from 'lucide-react';
import { format, addDays, subDays, startOfWeek, endOfWeek, isToday } from 'date-fns';
import { toast } from 'sonner';

interface DayStat {
  date: string;
  total: number;
  confirmed: number;
  noShows: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  // Stat card data
  const [todayTotal, setTodayTotal] = useState(0);
  const [todayConfirmed, setTodayConfirmed] = useState(0);
  const [todayUnconfirmed, setTodayUnconfirmed] = useState(0);
  const [tomorrowTotal, setTomorrowTotal] = useState(0);
  const [tomorrowConfirmed, setTomorrowConfirmed] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [weekNoShows, setWeekNoShows] = useState(0);
  const [lastWeekNoShows, setLastWeekNoShows] = useState(0);

  // Today's schedule
  const [todayAppointments, setTodayAppointments] = useState<any[]>([]);
  // Tomorrow's unconfirmed
  const [tomorrowUnconfirmed, setTomorrowUnconfirmed] = useState<any[]>([]);
  // Weekly overview
  const [weekStats, setWeekStats] = useState<DayStat[]>([]);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');

  const fetchData = async () => {
    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const lastWeekStart = format(startOfWeek(subDays(new Date(), 7), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const lastWeekEnd = format(endOfWeek(subDays(new Date(), 7), { weekStartsOn: 1 }), 'yyyy-MM-dd');

    const [
      todayRes, tomorrowRes, pendingRes,
      weekNoShowRes, lastWeekNoShowRes, weekAllRes
    ] = await Promise.all([
      supabase.from('appointments').select('*').eq('appointment_date', todayStr).neq('status', 'cancelled').order('appointment_time'),
      supabase.from('appointments').select('*').eq('appointment_date', tomorrowStr).neq('status', 'cancelled').order('appointment_time'),
      supabase.from('pending_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('status', 'no_show').gte('appointment_date', weekStart).lte('appointment_date', weekEnd),
      supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('status', 'no_show').gte('appointment_date', lastWeekStart).lte('appointment_date', lastWeekEnd),
      supabase.from('appointments').select('*').gte('appointment_date', weekStart).lte('appointment_date', weekEnd).neq('status', 'cancelled'),
    ]);

    const todayApts = todayRes.data || [];
    const tomorrowApts = tomorrowRes.data || [];

    setTodayAppointments(todayApts);
    setTodayTotal(todayApts.length);
    const todayConf = todayApts.filter((a: any) => ['confirmed_whatsapp', 'confirmed_call', 'double_confirmed'].includes(a.confirmation_status));
    setTodayConfirmed(todayConf.length);
    setTodayUnconfirmed(todayApts.length - todayConf.length);

    setTomorrowTotal(tomorrowApts.length);
    const tmrwConf = tomorrowApts.filter((a: any) => ['confirmed_whatsapp', 'confirmed_call', 'double_confirmed'].includes(a.confirmation_status));
    setTomorrowConfirmed(tmrwConf.length);
    setTomorrowUnconfirmed(tomorrowApts.filter((a: any) => !['confirmed_whatsapp', 'confirmed_call', 'double_confirmed', 'cancelled'].includes(a.confirmation_status)));

    setPendingRequests(pendingRes.count || 0);
    setWeekNoShows(weekNoShowRes.count || 0);
    setLastWeekNoShows(lastWeekNoShowRes.count || 0);

    // Build weekly stats
    const weekAll = weekAllRes.data || [];
    const days: DayStat[] = [];
    for (let i = 0; i < 7; i++) {
      const d = format(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), i), 'yyyy-MM-dd');
      const dayApts = weekAll.filter((a: any) => a.appointment_date === d);
      const dayConf = dayApts.filter((a: any) => ['confirmed_whatsapp', 'confirmed_call', 'double_confirmed'].includes(a.confirmation_status));
      const dayNoShows = dayApts.filter((a: any) => a.status === 'no_show');
      days.push({ date: d, total: dayApts.length, confirmed: dayConf.length, noShows: dayNoShows.length });
    }
    setWeekStats(days);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('dashboard-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pending_requests' }, fetchData)
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, []);

  const tomorrowConfirmPct = tomorrowTotal > 0 ? Math.round((tomorrowConfirmed / tomorrowTotal) * 100) : 0;
  const noShowTrend = weekNoShows - lastWeekNoShows;

  const getStatusColor = (status: string, confirmStatus: string) => {
    if (status === 'no_show') return 'bg-destructive';
    if (status === 'completed' || status === 'checked_in') return 'bg-muted-foreground';
    if (['confirmed_whatsapp', 'confirmed_call', 'double_confirmed'].includes(confirmStatus)) return 'bg-success';
    if (confirmStatus === 'called_no_answer') return 'bg-warning';
    return 'bg-warning';
  };

  const getStatusLabel = (status: string, confirmStatus: string) => {
    if (status === 'no_show') return 'No Show';
    if (status === 'completed') return 'Completed';
    if (['confirmed_whatsapp', 'confirmed_call', 'double_confirmed'].includes(confirmStatus)) return 'Confirmed';
    return 'Unconfirmed';
  };

  const currentHour = new Date().getHours();
  const currentMinute = new Date().getMinutes();

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
      <PageHeader title="Dashboard" subtitle={format(new Date(), 'EEEE, MMMM d, yyyy')} />

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Today's Appointments */}
        <TabletCard className="p-5 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/appointments')}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">Today's Appointments</span>
            <CalendarDays className="h-5 w-5 text-primary" />
          </div>
          <div className="text-3xl font-bold text-foreground mb-2">{todayTotal}</div>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-success flex items-center gap-1"><CheckCircle className="h-3 w-3" />{todayConfirmed} confirmed</span>
            <span className="text-warning flex items-center gap-1"><AlertCircle className="h-3 w-3" />{todayUnconfirmed} pending</span>
          </div>
        </TabletCard>

        {/* Tomorrow's Confirmation */}
        <TabletCard className="p-5 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/appointments')}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">Tomorrow's Confirmation</span>
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div className="text-3xl font-bold text-foreground mb-2">{tomorrowConfirmPct}%</div>
          <Progress value={tomorrowConfirmPct} className={`h-2 [&>div]:${tomorrowConfirmPct >= 80 ? 'bg-success' : tomorrowConfirmPct >= 50 ? 'bg-warning' : 'bg-destructive'}`} />
          <p className="text-xs text-muted-foreground mt-1">{tomorrowConfirmed}/{tomorrowTotal} confirmed</p>
        </TabletCard>

        {/* Pending Requests */}
        <TabletCard className="p-5 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/assistant')}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">Pending Requests</span>
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div className="text-3xl font-bold text-foreground mb-2">{pendingRequests}</div>
          <p className="text-xs text-muted-foreground">Tap to review in Personal Assistant</p>
        </TabletCard>

        {/* This Week's No-Shows */}
        <TabletCard className="p-5 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/no-show')}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">This Week's No-Shows</span>
            <UserX className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-bold text-foreground">{weekNoShows}</span>
            {noShowTrend !== 0 && (
              <Badge className={`text-xs ${noShowTrend > 0 ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}>
                {noShowTrend > 0 ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
                {Math.abs(noShowTrend)} vs last week
              </Badge>
            )}
            {noShowTrend === 0 && (
              <Badge className="text-xs bg-muted text-muted-foreground">
                <Minus className="h-3 w-3 mr-0.5" /> Same as last week
              </Badge>
            )}
          </div>
        </TabletCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Today's Schedule Timeline */}
        <div className="lg:col-span-2">
          <TabletCard className="p-5">
            <h2 className="text-lg font-semibold text-foreground mb-4">Today's Schedule</h2>
            {todayAppointments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No appointments today</p>
            ) : (
              <div className="space-y-1 relative">
                {todayAppointments.map((apt: any, idx: number) => {
                  const [h, m] = (apt.appointment_time || '09:00').split(':').map(Number);
                  const isPast = h < currentHour || (h === currentHour && m <= currentMinute);
                  const isCurrent = h === currentHour && Math.abs(m - currentMinute) < 30;
                  
                  return (
                    <div key={apt.id} className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-colors ${isCurrent ? 'bg-primary/5 ring-1 ring-primary/20' : ''}`}>
                      <span className={`text-sm font-mono w-14 flex-shrink-0 ${isPast ? 'text-muted-foreground' : 'text-foreground font-medium'}`}>
                        {apt.appointment_time?.slice(0, 5)}
                      </span>
                      <div className={`h-3 w-3 rounded-full flex-shrink-0 ${getStatusColor(apt.status, apt.confirmation_status)}`} />
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm ${isPast ? 'text-muted-foreground' : 'text-foreground'}`}>
                          {apt.patient_name}
                        </span>
                        <span className="text-xs text-muted-foreground ml-2">{apt.service}</span>
                      </div>
                      <Badge variant="outline" className="text-xs flex-shrink-0">
                        {getStatusLabel(apt.status, apt.confirmation_status)}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </TabletCard>
        </div>

        {/* Tomorrow Preview */}
        <div>
          <TabletCard className="p-5">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Tomorrow — {format(addDays(new Date(), 1), 'EEE d MMM')}
            </h2>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">Confirmation Progress</span>
                <span className="text-sm font-semibold text-foreground">{tomorrowConfirmPct}%</span>
              </div>
              <Progress value={tomorrowConfirmPct} className="h-3 [&>div]:bg-success" />
              <p className="text-xs text-muted-foreground mt-1">{tomorrowConfirmed} of {tomorrowTotal} confirmed</p>
            </div>

            {tomorrowUnconfirmed.length > 0 && (
              <>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Unconfirmed ({tomorrowUnconfirmed.length})</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {tomorrowUnconfirmed.map((apt: any) => (
                    <div key={apt.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{apt.patient_name}</p>
                        <p className="text-xs text-muted-foreground">{apt.appointment_time?.slice(0, 5)} · {apt.service}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {tomorrowUnconfirmed.length === 0 && tomorrowTotal > 0 && (
              <div className="text-center py-4">
                <CheckCircle className="h-8 w-8 text-success mx-auto mb-2" />
                <p className="text-sm text-success font-medium">All confirmed! 🎉</p>
              </div>
            )}
          </TabletCard>
        </div>
      </div>

      {/* Weekly Overview */}
      <TabletCard className="p-5">
        <h2 className="text-lg font-semibold text-foreground mb-4">Weekly Overview</h2>
        <div className="grid grid-cols-7 gap-2">
          {weekStats.map((day) => {
            const rate = day.total > 0 ? Math.round((day.confirmed / day.total) * 100) : 0;
            const isCurrentDay = day.date === todayStr;
            const rateColor = rate >= 80 ? 'text-success' : rate >= 50 ? 'text-warning' : rate > 0 ? 'text-destructive' : 'text-muted-foreground';
            const bgColor = isCurrentDay ? 'bg-primary/5 ring-1 ring-primary/30' : 'bg-muted/30';

            return (
              <div
                key={day.date}
                className={`rounded-xl p-3 text-center cursor-pointer hover:shadow-sm transition-all ${bgColor}`}
                onClick={() => navigate('/appointments')}
              >
                <p className={`text-xs font-medium mb-1 ${isCurrentDay ? 'text-primary' : 'text-muted-foreground'}`}>
                  {format(new Date(day.date + 'T00:00:00'), 'EEE')}
                </p>
                <p className={`text-xs mb-2 ${isCurrentDay ? 'text-primary' : 'text-muted-foreground'}`}>
                  {format(new Date(day.date + 'T00:00:00'), 'd')}
                </p>
                <p className="text-lg font-bold text-foreground">{day.total}</p>
                <p className={`text-xs font-semibold ${rateColor}`}>
                  {day.total > 0 ? `${rate}%` : '—'}
                </p>
                {day.noShows > 0 && (
                  <Badge variant="destructive" className="text-[10px] mt-1 px-1.5 py-0">
                    {day.noShows} NS
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </TabletCard>
    </PageContainer>
  );
}
