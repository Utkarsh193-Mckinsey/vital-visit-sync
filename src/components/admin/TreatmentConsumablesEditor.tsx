import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TabletButton } from '@/components/ui/tablet-button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Minus, X, Check, ChevronsUpDown, Package } from 'lucide-react';
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
import type { StockItem, TreatmentConsumable } from '@/types/database';

interface TreatmentConsumablesEditorProps {
  treatmentId: string;
  treatmentName: string;
}

export function TreatmentConsumablesEditor({ treatmentId, treatmentName }: TreatmentConsumablesEditorProps) {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [linkedConsumables, setLinkedConsumables] = useState<(TreatmentConsumable & { stock_item: StockItem })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, [treatmentId]);

  const fetchData = async () => {
    setIsLoading(true);
    
    const [stockRes, linkedRes] = await Promise.all([
      supabase
        .from('stock_items')
        .select('*')
        .eq('status', 'active')
        .order('category')
        .order('item_name'),
      supabase
        .from('treatment_consumables')
        .select('*, stock_item:stock_items(*)')
        .eq('treatment_id', treatmentId)
    ]);

    if (stockRes.error) {
      console.error('Error fetching stock items:', stockRes.error);
    } else {
      setStockItems(stockRes.data as StockItem[]);
    }

    if (linkedRes.error) {
      console.error('Error fetching linked consumables:', linkedRes.error);
    } else {
      setLinkedConsumables(linkedRes.data as (TreatmentConsumable & { stock_item: StockItem })[]);
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

  const addConsumable = async (item: StockItem) => {
    const existing = linkedConsumables.find(c => c.stock_item_id === item.id);
    if (existing) {
      // Update quantity
      const { error } = await supabase
        .from('treatment_consumables')
        .update({ default_quantity: existing.default_quantity + 1 })
        .eq('id', existing.id);

      if (error) {
        toast({ title: 'Error', description: 'Failed to update quantity.', variant: 'destructive' });
      } else {
        fetchData();
      }
    } else {
      // Insert new
      const { error } = await supabase
        .from('treatment_consumables')
        .insert({
          treatment_id: treatmentId,
          stock_item_id: item.id,
          default_quantity: 1,
        });

      if (error) {
        toast({ title: 'Error', description: 'Failed to add consumable.', variant: 'destructive' });
      } else {
        toast({ title: 'Added', description: `${item.item_name} linked to ${treatmentName}.` });
        fetchData();
      }
    }
    setOpen(false);
  };

  const updateQuantity = async (consumableId: string, delta: number) => {
    const consumable = linkedConsumables.find(c => c.id === consumableId);
    if (!consumable) return;

    const newQty = Math.max(0.5, consumable.default_quantity + delta);
    
    const { error } = await supabase
      .from('treatment_consumables')
      .update({ default_quantity: newQty })
      .eq('id', consumableId);

    if (error) {
      toast({ title: 'Error', description: 'Failed to update quantity.', variant: 'destructive' });
    } else {
      fetchData();
    }
  };

  const removeConsumable = async (consumableId: string) => {
    const { error } = await supabase
      .from('treatment_consumables')
      .delete()
      .eq('id', consumableId);

    if (error) {
      toast({ title: 'Error', description: 'Failed to remove consumable.', variant: 'destructive' });
    } else {
      fetchData();
    }
  };

  const isSelected = (itemId: string) =>
    linkedConsumables.some(c => c.stock_item_id === itemId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Package className="h-4 w-4" />
          Default Consumables
          {linkedConsumables.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {linkedConsumables.length}
            </Badge>
          )}
        </h4>

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
                          value={`${item.item_name} ${item.category} ${item.brand || ''}`}
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
                            {item.variant && (
                              <span className="ml-1 text-xs text-muted-foreground">
                                ({item.variant})
                              </span>
                            )}
                            <span className="ml-2 text-xs text-muted-foreground">
                              • {item.unit}
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

      {linkedConsumables.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No default consumables. Add items that are typically used with this treatment.
        </p>
      ) : (
        <div className="space-y-2">
          {linkedConsumables.map((consumable) => (
            <div
              key={consumable.id}
              className="flex items-center justify-between gap-2 p-2 bg-muted/50 rounded-lg"
            >
              <span className="text-sm font-medium flex-1 truncate">
                {consumable.stock_item?.item_name}
                {consumable.stock_item?.variant && (
                  <span className="text-muted-foreground ml-1">({consumable.stock_item.variant})</span>
                )}
              </span>
              <div className="flex items-center gap-1">
                <TabletButton
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => updateQuantity(consumable.id, -0.5)}
                >
                  <Minus className="h-3 w-3" />
                </TabletButton>
                <span className="w-14 text-center text-sm font-medium">
                  {consumable.default_quantity} {consumable.stock_item?.unit}
                </span>
                <TabletButton
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => updateQuantity(consumable.id, 0.5)}
                >
                  <Plus className="h-3 w-3" />
                </TabletButton>
                <TabletButton
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive"
                  onClick={() => removeConsumable(consumable.id)}
                >
                  <X className="h-3 w-3" />
                </TabletButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
