import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { NavLink } from '@/components/NavLink';
import { 
  Users, 
  Clock, 
  Stethoscope, 
  Settings, 
  LogOut,
  Syringe,
  Activity,
  CheckCircle
} from 'lucide-react';
import { TabletButton } from '@/components/ui/tablet-button';

import type { StaffRole } from '@/types/database';

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: StaffRole[];
  countKey?: 'waiting' | 'inProgress' | 'completed';
}

const navigationItems: NavItem[] = [
  { 
    title: 'All Patients', 
    url: '/patients', 
    icon: Users,
    roles: ['admin', 'reception']
  },
  { 
    title: 'Waiting Area', 
    url: '/waiting', 
    icon: Clock,
    roles: ['admin', 'nurse', 'doctor', 'reception'],
    countKey: 'waiting'
  },
  { 
    title: 'In Treatment', 
    url: '/waiting#in-progress', 
    icon: Activity,
    roles: ['admin', 'nurse', 'doctor'],
    countKey: 'inProgress'
  },
  { 
    title: 'Completed', 
    url: '/waiting#completed', 
    icon: CheckCircle,
    roles: ['admin', 'nurse', 'doctor'],
    countKey: 'completed'
  },
  { 
    title: 'Treatments', 
    url: '/settings?tab=treatments', 
    icon: Syringe,
    roles: ['admin']
  },
  { 
    title: 'Settings', 
    url: '/settings', 
    icon: Settings,
    roles: ['admin']
  },
];

interface VisitCounts {
  waiting: number;
  inProgress: number;
  completed: number;
}

export function AppSidebar() {
  const { staff, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  
  const [counts, setCounts] = useState<VisitCounts>({
    waiting: 0,
    inProgress: 0,
    completed: 0
  });

  // Fetch visit counts
  const fetchCounts = async () => {
    // Get today's date range for completed
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [waitingRes, inProgressRes, completedRes] = await Promise.all([
      supabase.from('visits').select('id', { count: 'exact', head: true }).eq('current_status', 'waiting'),
      supabase.from('visits').select('id', { count: 'exact', head: true }).eq('current_status', 'in_progress'),
      supabase.from('visits').select('id', { count: 'exact', head: true })
        .eq('current_status', 'completed')
        .gte('completed_date', today.toISOString())
        .lt('completed_date', tomorrow.toISOString()),
    ]);

    setCounts({
      waiting: waitingRes.count || 0,
      inProgress: inProgressRes.count || 0,
      completed: completedRes.count || 0,
    });
  };

  useEffect(() => {
    fetchCounts();

    // Poll every 10 seconds
    const interval = setInterval(fetchCounts, 10000);

    // Realtime subscription
    const channel = supabase
      .channel('sidebar-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, fetchCounts)
      .subscribe();

    return () => {
      clearInterval(interval);
      channel.unsubscribe();
    };
  }, []);

  const isActive = (url: string) => {
    // For hash links, check if we're on the waiting page
    if (url.includes('#')) {
      const basePath = url.split('#')[0];
      return location.pathname === basePath;
    }
    if (url.includes('?')) {
      return location.pathname + location.search === url;
    }
    return location.pathname === url || location.pathname.startsWith(url + '/');
  };

  const filteredItems = navigationItems.filter(item => 
    staff && item.roles.includes(staff.role)
  );

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const handleNavClick = (url: string) => {
    if (url.includes('#')) {
      const [path, hash] = url.split('#');
      navigate(path);
      // Scroll to section after navigation
      setTimeout(() => {
        const element = document.getElementById(hash);
        element?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  const getCount = (key?: 'waiting' | 'inProgress' | 'completed') => {
    if (!key) return 0;
    return counts[key];
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Stethoscope className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-semibold text-foreground">Cosmique</span>
              <span className="text-xs text-muted-foreground">Clinic Management</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="p-2">
        <SidebarGroup>
          <SidebarGroupLabel className={collapsed ? 'sr-only' : ''}>
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredItems.map((item) => {
                const count = getCount(item.countKey);
                const showLiveIndicator = item.countKey && count > 0 && item.countKey !== 'completed';
                
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild
                      isActive={isActive(item.url)}
                      tooltip={item.countKey && count > 0 ? `${item.title} (${count})` : item.title}
                    >
                      <NavLink 
                        to={item.url.split('#')[0]} 
                        onClick={() => item.url.includes('#') && handleNavClick(item.url)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors hover:bg-muted relative"
                        activeClassName="bg-primary/10 text-primary font-medium"
                      >
                        <div className="relative">
                          <item.icon className="h-5 w-5 flex-shrink-0" />
                          {/* Live blinking indicator */}
                          {showLiveIndicator && collapsed && (
                            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive"></span>
                            </span>
                          )}
                        </div>
                        {!collapsed && (
                          <>
                            <span className="flex-1">{item.title}</span>
                            {item.countKey && count > 0 && (
                              <div className="flex items-center gap-1.5">
                                {showLiveIndicator && (
                                  <span className="flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-destructive opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
                                  </span>
                                )}
                                <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                                  item.countKey === 'waiting' 
                                    ? 'bg-warning/10 text-warning' 
                                    : item.countKey === 'inProgress'
                                    ? 'bg-primary/10 text-primary'
                                    : 'bg-success/10 text-success'
                                }`}>
                                  {count}
                                </span>
                              </div>
                            )}
                          </>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-border">
        {!collapsed && staff && (
          <div className="mb-3 px-2">
            <p className="text-sm font-medium text-foreground truncate">{staff.full_name}</p>
            <p className="text-xs text-muted-foreground capitalize">{staff.role}</p>
          </div>
        )}
        <TabletButton
          variant="ghost"
          size={collapsed ? 'icon' : 'default'}
          fullWidth={!collapsed}
          onClick={handleLogout}
          leftIcon={!collapsed ? <LogOut className="h-4 w-4" /> : undefined}
          className="justify-start"
        >
          {collapsed ? <LogOut className="h-4 w-4" /> : 'Sign Out'}
        </TabletButton>
      </SidebarFooter>
    </Sidebar>
  );
}
