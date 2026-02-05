import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TabletCard, TabletCardContent } from '@/components/ui/tablet-card';
import { TabletButton } from '@/components/ui/tablet-button';
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
import { cn } from '@/lib/utils';

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
  treatmentIds?: string[];  // Treatment IDs to load default consumables from
}

export function ConsumablesSelector({
  selectedConsumables,
  onConsumablesChange,
  treatmentIds = [],
}: ConsumablesSelectorProps) {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [defaultConsumables, setDefaultConsumables] = useState<{ stock_item_id: string; default_quantity: number; item_name: string; unit: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [hasLoadedDefaults, setHasLoadedDefaults] = useState(false);

  useEffect(() => {
    fetchStockItems();
  }, []);

  // Load default consumables when treatmentIds change
  useEffect(() => {
    if (treatmentIds.length > 0 && !hasLoadedDefaults) {
      loadDefaultConsumables();
    }
  }, [treatmentIds, hasLoadedDefaults]);

  useEffect(() => {
    fetchStockItems();
  }, []);

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
      // Merge defaults - if same item appears for multiple treatments, sum quantities
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

      // Only set if no consumables already selected
      if (selectedConsumables.length === 0) {
        onConsumablesChange(Object.values(mergedDefaults));
      }
      
      setDefaultConsumables(data.map(d => ({
        stock_item_id: d.stock_item_id,
        default_quantity: d.default_quantity,
        item_name: (d.stock_item as StockItem)?.item_name || '',
        unit: (d.stock_item as StockItem)?.unit || '',
      })));
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
          c.stockItemId === item.id
            ? { ...c, quantity: c.quantity + 1 }
            : c
        )
      );
    } else {
      onConsumablesChange([
        ...selectedConsumables,
        {
          stockItemId: item.id,
          itemName: item.item_name,
          quantity: 1,
          unit: item.unit,
        },
      ]);
    }
    setOpen(false);
  };

  const updateQuantity = (stockItemId: string, delta: number) => {
    onConsumablesChange(
      selectedConsumables
        .map(c =>
          c.stockItemId === stockItemId
            ? { ...c, quantity: Math.max(0, c.quantity + delta) }
            : c
        )
        .filter(c => c.quantity > 0)
    );
  };

  const removeConsumable = (stockItemId: string) => {
    onConsumablesChange(selectedConsumables.filter(c => c.stockItemId !== stockItemId));
  };

  const isSelected = (itemId: string) =>
    selectedConsumables.some(c => c.stockItemId === itemId);

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

          {/* Add Consumable Button with Dropdown */}
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
                              <span className="ml-2 text-xs text-muted-foreground">
                                ({item.unit})
                              </span>
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
      </TabletCardContent>
    </TabletCard>
  );
}
