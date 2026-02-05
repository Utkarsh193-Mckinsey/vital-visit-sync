 import { useState, useEffect } from 'react';
 import { supabase } from '@/integrations/supabase/client';
 import { TabletCard, TabletCardContent } from '@/components/ui/tablet-card';
 import { TabletInput } from '@/components/ui/tablet-input';
 import { TabletButton } from '@/components/ui/tablet-button';
 import { Badge } from '@/components/ui/badge';
 import { Package, Plus, Minus, X, Search } from 'lucide-react';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import {
   Accordion,
   AccordionContent,
   AccordionItem,
   AccordionTrigger,
 } from '@/components/ui/accordion';
 
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
 }
 
 export function ConsumablesSelector({
   selectedConsumables,
   onConsumablesChange,
 }: ConsumablesSelectorProps) {
   const [stockItems, setStockItems] = useState<StockItem[]>([]);
   const [isLoading, setIsLoading] = useState(true);
   const [searchQuery, setSearchQuery] = useState('');
 
   useEffect(() => {
     fetchStockItems();
   }, []);
 
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
 
   const filteredGroups = Object.entries(groupedItems).reduce((acc, [category, items]) => {
     const filtered = items.filter(item =>
       item.item_name.toLowerCase().includes(searchQuery.toLowerCase())
     );
     if (filtered.length > 0) {
       acc[category] = filtered;
     }
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
 
   const getQuantity = (itemId: string) =>
     selectedConsumables.find(c => c.stockItemId === itemId)?.quantity || 0;
 
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
         <h4 className="font-medium mb-3 flex items-center gap-2">
           <Package className="h-4 w-4" />
           Consumables Used
           {selectedConsumables.length > 0 && (
             <Badge variant="secondary" className="ml-2">
               {selectedConsumables.length} items
             </Badge>
           )}
         </h4>
 
         {/* Selected Consumables */}
         {selectedConsumables.length > 0 && (
           <div className="mb-4 space-y-2">
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
                   <span className="w-12 text-center text-sm font-medium">
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
 
         {/* Search */}
         <div className="relative mb-3">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
           <TabletInput
             placeholder="Search items..."
             value={searchQuery}
             onChange={(e) => setSearchQuery(e.target.value)}
             className="pl-9"
           />
         </div>
 
         {/* Stock Items by Category */}
         <ScrollArea className="h-[280px]">
           <Accordion type="multiple" className="w-full" defaultValue={Object.keys(filteredGroups)}>
             {Object.entries(filteredGroups).map(([category, items]) => (
               <AccordionItem key={category} value={category}>
                 <AccordionTrigger className="text-sm py-2">
                   {category}
                   <Badge variant="outline" className="ml-2">
                     {items.length}
                   </Badge>
                 </AccordionTrigger>
                 <AccordionContent>
                   <div className="grid grid-cols-2 gap-2 pb-2">
                     {items.map((item) => (
                       <button
                         key={item.id}
                         onClick={() => addConsumable(item)}
                         className={`text-left p-2 rounded-lg border text-sm transition-colors ${
                           isSelected(item.id)
                             ? 'border-primary bg-primary/10'
                             : 'border-border hover:border-primary/50 hover:bg-muted/50'
                         }`}
                       >
                         <div className="font-medium truncate">{item.item_name}</div>
                         <div className="text-xs text-muted-foreground flex justify-between">
                           <span>{item.unit}</span>
                           {isSelected(item.id) && (
                             <span className="text-primary font-medium">
                               × {getQuantity(item.id)}
                             </span>
                           )}
                         </div>
                       </button>
                     ))}
                   </div>
                 </AccordionContent>
               </AccordionItem>
             ))}
           </Accordion>
         </ScrollArea>
       </TabletCardContent>
     </TabletCard>
   );
 }