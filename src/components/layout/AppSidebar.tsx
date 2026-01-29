import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
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
  Menu
} from 'lucide-react';
import { TabletButton } from '@/components/ui/tablet-button';

import type { StaffRole } from '@/types/database';

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: StaffRole[];
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
    roles: ['admin', 'nurse', 'doctor']
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

export function AppSidebar() {
  const { staff, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  const isActive = (url: string) => {
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
              {filteredItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <NavLink 
                      to={item.url} 
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors hover:bg-muted"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
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
