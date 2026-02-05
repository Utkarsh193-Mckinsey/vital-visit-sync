import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TabletButton } from '@/components/ui/tablet-button';
import { TabletInput } from '@/components/ui/tablet-input';
import { TabletCard, TabletCardContent, TabletCardHeader, TabletCardTitle } from '@/components/ui/tablet-card';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit2, Trash2, Save, X, Package } from 'lucide-react';
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
import type { StockItem } from '@/types/database';

const CATEGORIES = [
  'Syringes',
  'Needles',
  'Cannula',
  'Solutions',
  'Medicines',
  'Supplies',
  'Other',
];

const UNITS = ['pcs', 'ml', 'mg', 'vial', 'amp', 'pack', 'box'];

interface ConsumableFormData {
  item_name: string;
  category: string;
  unit: string;
}

const emptyForm: ConsumableFormData = {
  item_name: '',
  category: '',
  unit: 'pcs',
};

export default function ConsumablesManager() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ConsumableFormData>(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const { toast } = useToast();

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('stock_items')
      .select('*')
      .order('category')
      .order('item_name');

    if (error) {
      console.error('Error fetching consumables:', error);
      toast({
        title: 'Error',
        description: 'Failed to load consumables.',
        variant: 'destructive',
      });
    } else {
      setItems(data as StockItem[]);
    }
    setIsLoading(false);
  };

  const handleAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setFormData(emptyForm);
  };

  const handleEdit = (item: StockItem) => {
    setEditingId(item.id);
    setIsAdding(false);
    setFormData({
      item_name: item.item_name,
      category: item.category,
      unit: item.unit,
    });
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData(emptyForm);
  };

  const handleSave = async () => {
    if (!formData.item_name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Item name is required.',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.category) {
      toast({
        title: 'Validation Error',
        description: 'Category is required.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    try {
      if (isAdding) {
        const { error } = await supabase
          .from('stock_items')
          .insert({
            item_name: formData.item_name.trim(),
            category: formData.category,
            unit: formData.unit,
            status: 'active',
          });

        if (error) throw error;

        toast({
          title: 'Consumable Added',
          description: `${formData.item_name} has been added.`,
        });
      } else if (editingId) {
        const { error } = await supabase
          .from('stock_items')
          .update({
            item_name: formData.item_name.trim(),
            category: formData.category,
            unit: formData.unit,
          })
          .eq('id', editingId);

        if (error) throw error;

        toast({
          title: 'Consumable Updated',
          description: `${formData.item_name} has been updated.`,
        });
      }

      handleCancel();
      fetchItems();
    } catch (error) {
      console.error('Error saving consumable:', error);
      toast({
        title: 'Error',
        description: 'Failed to save consumable.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('stock_items')
        .update({ status: 'inactive' })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Consumable Deactivated',
        description: 'Consumable has been deactivated.',
      });

      setDeleteConfirm(null);
      fetchItems();
    } catch (error) {
      console.error('Error deactivating consumable:', error);
      toast({
        title: 'Error',
        description: 'Failed to deactivate consumable.',
        variant: 'destructive',
      });
    }
  };

  const activeItems = items.filter(i => i.status === 'active');
  const inactiveItems = items.filter(i => i.status === 'inactive');

  const filteredActiveItems = filterCategory === 'all' 
    ? activeItems 
    : activeItems.filter(i => i.category === filterCategory);

  const categoryCounts = activeItems.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-lg font-semibold">
          {activeItems.length} Active Consumable{activeItems.length !== 1 ? 's' : ''}
        </h2>
        {!isAdding && !editingId && (
          <TabletButton onClick={handleAdd} leftIcon={<Plus className="h-4 w-4" />}>
            Add Consumable
          </TabletButton>
        )}
      </div>

      {/* Category Filter */}
      {!isAdding && !editingId && activeItems.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={filterCategory === 'all' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setFilterCategory('all')}
          >
            All ({activeItems.length})
          </Badge>
          {Object.entries(categoryCounts).map(([category, count]) => (
            <Badge
              key={category}
              variant={filterCategory === category ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setFilterCategory(category)}
            >
              {category} ({count})
            </Badge>
          ))}
        </div>
      )}

      {/* Add/Edit Form */}
      {(isAdding || editingId) && (
        <TabletCard className="border-primary">
          <TabletCardHeader>
            <TabletCardTitle>
              {isAdding ? 'Add New Consumable' : 'Edit Consumable'}
            </TabletCardTitle>
          </TabletCardHeader>
          <TabletCardContent className="space-y-4">
            <TabletInput
              label="Item Name *"
              placeholder="e.g., Syringe 5ml"
              value={formData.item_name}
              onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="block text-sm font-medium">Category *</label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger className="h-14">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat} className="py-3">
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium">Unit</label>
                <Select
                  value={formData.unit}
                  onValueChange={(value) => setFormData({ ...formData, unit: value })}
                >
                  <SelectTrigger className="h-14">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((unit) => (
                      <SelectItem key={unit} value={unit} className="py-3">
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-3">
              <TabletButton
                variant="outline"
                fullWidth
                onClick={handleCancel}
                leftIcon={<X className="h-4 w-4" />}
              >
                Cancel
              </TabletButton>
              <TabletButton
                fullWidth
                onClick={handleSave}
                isLoading={isSaving}
                leftIcon={<Save className="h-4 w-4" />}
              >
                {isAdding ? 'Add Consumable' : 'Save Changes'}
              </TabletButton>
            </div>
          </TabletCardContent>
        </TabletCard>
      )}

      {/* Active Items List */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading consumables...</div>
      ) : filteredActiveItems.length === 0 && !isAdding ? (
        <TabletCard>
          <TabletCardContent className="py-8 text-center text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>No consumables found.</p>
            <p className="text-sm mt-1">Add consumables to track usage during treatments.</p>
          </TabletCardContent>
        </TabletCard>
      ) : (
        <div className="space-y-2">
          {filteredActiveItems.map((item) => (
            <TabletCard key={item.id} className={editingId === item.id ? 'hidden' : ''}>
              <TabletCardContent className="flex items-center justify-between py-4">
                <div>
                  <div className="font-medium text-lg">{item.item_name}</div>
                  <div className="text-sm text-muted-foreground">
                    {item.category} • {item.unit}
                  </div>
                </div>
                <div className="flex gap-2">
                  <TabletButton
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(item)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </TabletButton>
                  <TabletButton
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteConfirm(item.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </TabletButton>
                </div>
              </TabletCardContent>
            </TabletCard>
          ))}
        </div>
      )}

      {/* Inactive Items */}
      {inactiveItems.length > 0 && (
        <div className="pt-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            Inactive Items ({inactiveItems.length})
          </h3>
          <div className="space-y-2 opacity-60">
            {inactiveItems.map((item) => (
              <TabletCard key={item.id}>
                <TabletCardContent className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium">{item.item_name}</div>
                    <div className="text-sm text-muted-foreground">{item.category}</div>
                  </div>
                  <span className="text-xs bg-muted px-2 py-1 rounded">Inactive</span>
                </TabletCardContent>
              </TabletCard>
            ))}
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Consumable?</AlertDialogTitle>
            <AlertDialogDescription>
              This will hide the item from the consumables list. Past records will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
