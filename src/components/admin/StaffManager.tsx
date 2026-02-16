import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TabletButton } from '@/components/ui/tablet-button';
import { TabletCard, TabletCardContent } from '@/components/ui/tablet-card';
import { TabletInput } from '@/components/ui/tablet-input';
import { useToast } from '@/hooks/use-toast';
import { Plus, User, Trash2, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface StaffMember {
  id: string;
  full_name: string;
  email: string;
  role: string;
  title: string | null;
  status: string;
}

const ROLE_CONFIG = [
  { role: 'doctor', title: 'Doctor', color: 'bg-primary/10 text-primary' },
  { role: 'nurse', title: 'Nurse / Beauty Therapist', color: 'bg-emerald-100 text-emerald-700' },
  { role: 'reception', title: 'Reception', color: 'bg-blue-100 text-blue-700' },
  { role: 'admin', title: 'Admin', color: 'bg-amber-100 text-amber-700' },
];

const TITLE_OPTIONS = [
  'Doctor',
  'Nurse / Beauty Therapist',
  'Reception',
  'Sales Development Representative',
  'Admin',
];

export default function StaffManager() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('reception');
  const [newTitle, setNewTitle] = useState('Reception');
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    const { data, error } = await supabase
      .from('staff')
      .select('id, full_name, email, role, title, status')
      .eq('status', 'active')
      .order('role')
      .order('full_name');

    if (error) {
      console.error('Error fetching staff:', error);
    } else {
      setStaff(data || []);
    }
    setIsLoading(false);
  };

  const handleAddStaff = async () => {
    if (!newName.trim() || !newEmail.trim()) return;
    setIsSaving(true);

    try {
      // Get admin user_id to use as reference for non-login staff
      const { data: adminData } = await supabase
        .from('staff')
        .select('user_id')
        .eq('role', 'admin')
        .limit(1)
        .single();

      if (!adminData) throw new Error('No admin found');

      const { error } = await supabase
        .from('staff')
        .insert({
          user_id: adminData.user_id,
          full_name: newName.trim(),
          email: newEmail.trim().toLowerCase(),
          role: newRole as any,
          title: newTitle,
        });

      if (error) throw error;

      toast({ title: 'Staff Added', description: `${newName} has been added.` });
      setNewName('');
      setNewEmail('');
      setNewRole('reception');
      setNewTitle('Reception');
      setShowAddForm(false);
      fetchStaff();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message?.includes('duplicate') 
          ? 'Email already exists.' 
          : 'Failed to add staff member.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase
        .from('staff')
        .update({ status: 'inactive' })
        .eq('id', deleteTarget.id);

      if (error) throw error;

      toast({ title: 'Staff Removed', description: `${deleteTarget.full_name} has been deactivated.` });
      setDeleteTarget(null);
      fetchStaff();
    } catch {
      toast({ title: 'Error', description: 'Failed to remove staff.', variant: 'destructive' });
    }
  };

  const getRoleColor = (role: string) => {
    return ROLE_CONFIG.find(r => r.role === role)?.color || 'bg-muted text-muted-foreground';
  };

  // Group staff by title (or role fallback)
  const groupedStaff: Record<string, StaffMember[]> = {};
  for (const member of staff) {
    const group = member.title || ROLE_CONFIG.find(r => r.role === member.role)?.title || member.role;
    if (!groupedStaff[group]) groupedStaff[group] = [];
    groupedStaff[group].push(member);
  }

  // Sort groups in desired order
  const groupOrder = ['Doctor', 'Nurse / Beauty Therapist', 'Sales Development Representative', 'Reception', 'Admin'];
  const sortedGroups = Object.entries(groupedStaff).sort(([a], [b]) => {
    const ai = groupOrder.indexOf(a);
    const bi = groupOrder.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Staff Members ({staff.length})</h3>
        <TabletButton
          onClick={() => setShowAddForm(!showAddForm)}
          leftIcon={showAddForm ? undefined : <UserPlus className="h-4 w-4" />}
          variant={showAddForm ? 'outline' : 'default'}
        >
          {showAddForm ? 'Cancel' : 'Add Staff'}
        </TabletButton>
      </div>

      {/* Add Staff Form */}
      {showAddForm && (
        <TabletCard className="border-primary/30">
          <TabletCardContent className="p-4 space-y-3">
            <h4 className="font-medium">Add New Staff Member</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Full Name</label>
                <TabletInput
                  placeholder="e.g. Dr Rizza"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Email</label>
                <TabletInput
                  type="email"
                  placeholder="e.g. rizza@cosmique.ae"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">System Role</label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="doctor">Doctor</SelectItem>
                    <SelectItem value="nurse">Nurse</SelectItem>
                    <SelectItem value="reception">Reception</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Display Title</label>
                <Select value={newTitle} onValueChange={setNewTitle}>
                  <SelectTrigger className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TITLE_OPTIONS.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <TabletButton
              onClick={handleAddStaff}
              isLoading={isSaving}
              disabled={!newName.trim() || !newEmail.trim()}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Add Staff Member
            </TabletButton>
          </TabletCardContent>
        </TabletCard>
      )}

      {/* Staff List by Group */}
      {sortedGroups.map(([group, members]) => (
        <div key={group}>
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            {group} ({members.length})
          </h4>
          <div className="grid gap-2">
            {members.map((member) => (
              <TabletCard key={member.id}>
                <TabletCardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{member.full_name}</p>
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={getRoleColor(member.role)}>
                      {member.role}
                    </Badge>
                    <TabletButton
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(member)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </TabletButton>
                  </div>
                </TabletCardContent>
              </TabletCard>
            ))}
          </div>
        </div>
      ))}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Staff Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate <strong>{deleteTarget?.full_name}</strong>? They will no longer appear in staff lists.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivate} className="bg-destructive text-destructive-foreground">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
