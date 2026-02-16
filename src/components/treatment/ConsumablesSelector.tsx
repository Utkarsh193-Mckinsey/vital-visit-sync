import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TabletCard, TabletCardContent } from '@/components/ui/tablet-card';
import { TabletButton } from '@/components/ui/tablet-button';
import { TabletInput } from '@/components/ui/tablet-input';
import { Badge } from '@/components/ui/badge';
import { Package, Plus, Minus, X, Check, ChevronsUpDown } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface StockItem {
  id: string;
  item_name: string;
  category: string;
  unit: string;
}

export interface SelectedConsumable {
  stockItemId: string;
  itemName: string;
  quantity: number;
  unit: string;
  notes?: string;
}

interface ConsumablesSelectorProps {
  selectedConsumables: SelectedConsumable[];
  onConsumablesChange: (consumables: SelectedConsumable[]) => void;
  treatmentIds?: string[];
}

const CATEGORIES = [
  'Syringes', 'Needles & Infusion', 'Cannula', 'Solutions',
  'Medicines', 'Other Items', 'Housekeeping',
];

const DEFAULT_UNITS = ['pcs', 'ml', 'mg', 'mcg', 'Units', 'vial', 'box', 'amp', 'bottle', 'tube', 'pkt'];

export function ConsumablesSelector({
  selectedConsumables,
  onConsumablesChange,
  treatmentIds = [],
}: ConsumablesSelectorProps) {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [hasLoadedDefaults, setHasLoadedDefaults] = useState(false);
  const [showAddNew, setShowAddNew] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', category: CATEGORIES[0], unit: DEFAULT_UNITS[0], brand: '' });
  const [customUnit, setCustomUnit] = useState('');
  const [isAddingUnit, setIsAddingUnit] = useState(false);
  const [units, setUnits] = useState<string[]>(DEFAULT_UNITS);
  const { toast } = useToast();

  useEffect(() => {
    fetchStockItems();
  }, []);

  useEffect(() => {
    if (treatmentIds.length > 0 && !hasLoadedDefaults) {
      loadDefaultConsumables();
    }
  }, [treatmentIds, hasLoadedDefaults]);

  const loadDefaultConsumables = async () => {
    if (treatmentIds.length === 0) return;
    
    const { data, error } = await supabase
      .from('treatment_consumables')
      .select('*, stock_item:stock_items(*)')
      .in('treatment_id', treatmentIds);

    if (error) {
      console.error('Error loading default consumables:', error);
      return;
    }

    if (data && data.length > 0) {
      const mergedDefaults: Record<string, SelectedConsumable> = {};
      
      for (const item of data) {
        const stockItem = item.stock_item as StockItem;
        if (!stockItem) continue;
        
        if (mergedDefaults[item.stock_item_id]) {
          mergedDefaults[item.stock_item_id].quantity += item.default_quantity;
        } else {
          mergedDefaults[item.stock_item_id] = {
            stockItemId: item.stock_item_id,
            itemName: stockItem.item_name,
            quantity: item.default_quantity,
            unit: stockItem.unit,
          };
        }
      }

      if (selectedConsumables.length === 0) {
        onConsumablesChange(Object.values(mergedDefaults));
      }
      setHasLoadedDefaults(true);
    }
  };

  const fetchStockItems = async () => {
    const { data, error } = await supabase
      .from('stock_items')
      .select('*')
      .eq('status', 'active')
      .order('category')
      .order('item_name');

    if (error) {
      console.error('Error fetching stock items:', error);
    } else {
      setStockItems(data || []);
      // Extract unique units from existing items
      const existingUnits = new Set(DEFAULT_UNITS);
      (data || []).forEach(item => existingUnits.add(item.unit));
      setUnits(Array.from(existingUnits));
    }
    setIsLoading(false);
  };

  const groupedItems = stockItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, StockItem[]>);

  const addConsumable = (item: StockItem) => {
    const existing = selectedConsumables.find(c => c.stockItemId === item.id);
    if (existing) {
      onConsumablesChange(
        selectedConsumables.map(c =>
          c.stockItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c
        )
      );
    } else {
      onConsumablesChange([
        ...selectedConsumables,
        { stockItemId: item.id, itemName: item.item_name, quantity: 1, unit: item.unit },
      ]);
    }
    setOpen(false);
  };

  const updateQuantity = (stockItemId: string, delta: number) => {
    onConsumablesChange(
      selectedConsumables
        .map(c => c.stockItemId === stockItemId ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c)
        .filter(c => c.quantity > 0)
    );
  };

  const removeConsumable = (stockItemId: string) => {
    onConsumablesChange(selectedConsumables.filter(c => c.stockItemId !== stockItemId));
  };

  const isSelected = (itemId: string) => selectedConsumables.some(c => c.stockItemId === itemId);

  const handleAddNewItem = async () => {
    if (!newItem.name.trim()) return;
    
    const unitToUse = isAddingUnit && customUnit.trim() ? customUnit.trim() : newItem.unit;
    
    const { data, error } = await supabase
      .from('stock_items')
      .insert({
        item_name: newItem.name.trim(),
        category: newItem.category,
        unit: unitToUse,
        brand: newItem.brand.trim() || null,
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      toast({ title: 'Error', description: 'Failed to add item.', variant: 'destructive' });
      return;
    }

    // Add to local list and select it
    setStockItems(prev => [...prev, data as StockItem]);
    if (isAddingUnit && customUnit.trim()) {
      setUnits(prev => [...prev, customUnit.trim()]);
    }
    addConsumable(data as StockItem);
    setShowAddNew(false);
    setNewItem({ name: '', category: CATEGORIES[0], unit: DEFAULT_UNITS[0], brand: '' });
    setCustomUnit('');
    setIsAddingUnit(false);
    toast({ title: 'Item Added', description: `${data.item_name} added and selected.` });
  };

  if (isLoading) {
    return (
      <TabletCard>
        <TabletCardContent className="p-4">
          <div className="flex items-center justify-center py-4">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </TabletCardContent>
      </TabletCard>
    );
  }

  return (
    <TabletCard>
      <TabletCardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium flex items-center gap-2">
            <Package className="h-4 w-4" />
            Consumables Used
            {selectedConsumables.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {selectedConsumables.length} item{selectedConsumables.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </h4>

          <div className="flex gap-2">
            {/* Add New Item Button */}
            <TabletButton
              variant="ghost"
              size="sm"
              onClick={() => setShowAddNew(true)}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              New
            </TabletButton>

            {/* Add Existing Consumable */}
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <TabletButton
                  variant="outline"
                  size="sm"
                  leftIcon={<Plus className="h-4 w-4" />}
                  rightIcon={<ChevronsUpDown className="h-3 w-3 opacity-50" />}
                >
                  Add
                </TabletButton>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="end">
                <Command>
                  <CommandInput placeholder="Search consumables..." />
                  <CommandList>
                    <CommandEmpty>No consumables found.</CommandEmpty>
                    <ScrollArea className="h-[280px]">
                      {Object.entries(groupedItems).map(([category, items]) => (
                        <CommandGroup key={category} heading={category}>
                          {items.map((item) => (
                            <CommandItem
                              key={item.id}
                              value={`${item.item_name} ${item.category}`}
                              onSelect={() => addConsumable(item)}
                              className="cursor-pointer"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  isSelected(item.id) ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex-1">
                                <span>{item.item_name}</span>
                                <span className="ml-2 text-xs text-muted-foreground">({item.unit})</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      ))}
                    </ScrollArea>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Selected Consumables List */}
        {selectedConsumables.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No consumables added yet. Click "Add" to select items.
          </p>
        ) : (
          <div className="space-y-2">
            {selectedConsumables.map((consumable) => (
              <div
                key={consumable.stockItemId}
                className="flex items-center justify-between gap-2 p-2 bg-primary/5 rounded-lg"
              >
                <span className="text-sm font-medium flex-1 truncate">
                  {consumable.itemName}
                </span>
                <div className="flex items-center gap-1">
                  <TabletButton
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => updateQuantity(consumable.stockItemId, -1)}
                  >
                    <Minus className="h-3 w-3" />
                  </TabletButton>
                  <span className="w-14 text-center text-sm font-medium">
                    {consumable.quantity} {consumable.unit}
                  </span>
                  <TabletButton
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => updateQuantity(consumable.stockItemId, 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </TabletButton>
                  <TabletButton
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    onClick={() => removeConsumable(consumable.stockItemId)}
                  >
                    <X className="h-3 w-3" />
                  </TabletButton>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add New Item Dialog */}
        <Dialog open={showAddNew} onOpenChange={setShowAddNew}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Consumable</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Item Name *</Label>
                <TabletInput
                  placeholder="e.g. 25G Needle"
                  value={newItem.name}
                  onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Category</Label>
                <Select value={newItem.category} onValueChange={(v) => setNewItem(prev => ({ ...prev, category: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Unit</Label>
                {isAddingUnit ? (
                  <div className="flex gap-2">
                    <TabletInput
                      placeholder="e.g. strip, ampoule"
                      value={customUnit}
                      onChange={(e) => setCustomUnit(e.target.value)}
                      className="flex-1"
                    />
                    <TabletButton
                      size="sm"
                      variant="ghost"
                      onClick={() => { setIsAddingUnit(false); setCustomUnit(''); }}
                    >
                      Cancel
                    </TabletButton>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Select value={newItem.unit} onValueChange={(v) => setNewItem(prev => ({ ...prev, unit: v }))}>
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map(u => (
                          <SelectItem key={u} value={u}>{u}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <TabletButton
                      size="sm"
                      variant="outline"
                      onClick={() => setIsAddingUnit(true)}
                      leftIcon={<Plus className="h-3 w-3" />}
                    >
                      New
                    </TabletButton>
                  </div>
                )}
              </div>
              <div className="grid gap-2">
                <Label>Brand (optional)</Label>
                <TabletInput
                  placeholder="e.g. MMC"
                  value={newItem.brand}
                  onChange={(e) => setNewItem(prev => ({ ...prev, brand: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <TabletButton variant="outline" onClick={() => setShowAddNew(false)}>Cancel</TabletButton>
              <TabletButton onClick={handleAddNewItem} disabled={!newItem.name.trim()}>
                Add & Select
              </TabletButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </TabletCardContent>
    </TabletCard>
  );
}
