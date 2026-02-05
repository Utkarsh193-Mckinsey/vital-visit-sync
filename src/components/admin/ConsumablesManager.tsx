import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TabletButton } from '@/components/ui/tablet-button';
import { TabletInput } from '@/components/ui/tablet-input';
import { TabletCard, TabletCardContent, TabletCardHeader, TabletCardTitle } from '@/components/ui/tablet-card';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit2, Trash2, Save, X, Package, PackagePlus, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
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

const BASE_UNITS = ['pcs', 'ml', 'mg', 'mcg', 'Units', 'amp'];
const PACKAGING_UNITS = ['Box', 'Pack', 'Vial', 'Bottle', 'Carton', 'Strip', 'Blister'];
const UNITS = [...BASE_UNITS, 'vial', 'pack', 'box'];

interface ConsumableFormData {
  item_name: string;
  category: string;
  unit: string;
  brand: string;
  current_stock: number;
  packaging_unit: string;
  units_per_package: number;
  variant: string;
}

const emptyForm: ConsumableFormData = {
  item_name: '',
  category: '',
  unit: 'pcs',
  brand: '',
  current_stock: 0,
  packaging_unit: '',
  units_per_package: 1,
  variant: '',
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
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [addStockId, setAddStockId] = useState<string | null>(null);
  const [stockToAdd, setStockToAdd] = useState<number>(0);
  const [packagesToAdd, setPackagesToAdd] = useState<number>(0);
  const [inlinePackagingUnit, setInlinePackagingUnit] = useState<string>('');
  const [inlineBaseUnit, setInlineBaseUnit] = useState<string>('');
  const [inlineUnitsPerPackage, setInlineUnitsPerPackage] = useState<number>(1);
  const [addStockStep, setAddStockStep] = useState<'packaging' | 'base_unit' | 'quantity'>('packaging');
  const [brandSearch, setBrandSearch] = useState('');
  const [showBrandDropdown, setShowBrandDropdown] = useState(false);
  const { toast } = useToast();

  // Get unique brands for autocomplete
  const uniqueBrands = [...new Set(items.map(i => i.brand).filter(Boolean))] as string[];

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
      brand: item.brand || '',
      current_stock: item.current_stock || 0,
      packaging_unit: item.packaging_unit || '',
      units_per_package: item.units_per_package || 1,
      variant: item.variant || '',
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
            brand: formData.brand.trim() || null,
            current_stock: formData.current_stock,
            packaging_unit: formData.packaging_unit || null,
            units_per_package: formData.units_per_package || 1,
            variant: formData.variant.trim() || null,
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
            brand: formData.brand.trim() || null,
            current_stock: formData.current_stock,
            packaging_unit: formData.packaging_unit || null,
            units_per_package: formData.units_per_package || 1,
            variant: formData.variant.trim() || null,
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

  const handleAddStock = async (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    // Check if item has packaging set, or if user is setting it now
    const existingPackaging = item.packaging_unit && (item.units_per_package || 1) > 1;
    const newPackaging = inlinePackagingUnit && inlineBaseUnit && inlineUnitsPerPackage > 0;
    const hasPackaging = existingPackaging || newPackaging;
    
    const unitsPerPkg = existingPackaging 
      ? (item.units_per_package || 1) 
      : (newPackaging ? inlineUnitsPerPackage : 1);
    
    // Determine the effective base unit
    const effectiveBaseUnit = existingPackaging ? item.unit : (newPackaging ? inlineBaseUnit : item.unit);
    
    const quantityToAdd = hasPackaging 
      ? packagesToAdd * unitsPerPkg
      : stockToAdd;

    if (quantityToAdd <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid quantity.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const newStock = (item.current_stock || 0) + quantityToAdd;
      
      // Update stock and save packaging config if newly set
      const updateData: Record<string, unknown> = { current_stock: newStock };
      if (newPackaging && !existingPackaging) {
        updateData.packaging_unit = inlinePackagingUnit;
        updateData.units_per_package = inlineUnitsPerPackage;
        updateData.unit = inlineBaseUnit; // Update base unit
      }
      
      const { error } = await supabase
        .from('stock_items')
        .update(updateData)
        .eq('id', itemId);

      if (error) throw error;

      const pkgUnit = existingPackaging ? item.packaging_unit : inlinePackagingUnit;
      const addedDesc = hasPackaging 
        ? `Added ${packagesToAdd} ${pkgUnit}(s) (${quantityToAdd} ${effectiveBaseUnit})`
        : `Added ${stockToAdd} ${item.unit}`;

      toast({
        title: 'Stock Added',
        description: `${addedDesc} to ${item.item_name}. New total: ${newStock} ${effectiveBaseUnit}`,
      });

      resetAddStockState();
      fetchItems();
    } catch (error) {
      console.error('Error adding stock:', error);
      toast({
        title: 'Error',
        description: 'Failed to update stock.',
        variant: 'destructive',
      });
    }
  };

  const resetAddStockState = () => {
    setAddStockId(null);
    setStockToAdd(0);
    setPackagesToAdd(0);
    setInlinePackagingUnit('');
    setInlineBaseUnit('');
    setInlineUnitsPerPackage(1);
    setAddStockStep('packaging');
  };

  const filteredBrands = uniqueBrands.filter(brand =>
    brand.toLowerCase().includes(brandSearch.toLowerCase())
  );

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

            {/* Packaging Section */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="block text-sm font-medium">Packaging Unit</label>
                <Select
                  value={formData.packaging_unit}
                  onValueChange={(value) => setFormData({ ...formData, packaging_unit: value })}
                >
                  <SelectTrigger className="h-14">
                    <SelectValue placeholder="How it comes (Box, Vial...)" />
                  </SelectTrigger>
                  <SelectContent>
                    {PACKAGING_UNITS.map((pu) => (
                      <SelectItem key={pu} value={pu} className="py-3">
                        {pu}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <TabletInput
                label="Units per Package"
                type="number"
                placeholder="e.g., 1 Box = 100 pcs"
                value={formData.units_per_package.toString()}
                onChange={(e) => setFormData({ ...formData, units_per_package: parseFloat(e.target.value) || 1 })}
              />
            </div>

            {/* Brand with Autocomplete */}
            <div className="space-y-2 relative">
              <label className="block text-sm font-medium">Brand</label>
              <TabletInput
                placeholder="e.g., BD, Terumo, Braun"
                value={formData.brand}
                onChange={(e) => {
                  setFormData({ ...formData, brand: e.target.value });
                  setBrandSearch(e.target.value);
                  setShowBrandDropdown(true);
                }}
                onFocus={() => setShowBrandDropdown(true)}
                onBlur={() => setTimeout(() => setShowBrandDropdown(false), 200)}
              />
              {showBrandDropdown && filteredBrands.length > 0 && formData.brand && (
                <div className="absolute z-10 w-full bg-popover border rounded-md shadow-md mt-1 max-h-40 overflow-auto">
                  {filteredBrands.map((brand) => (
                    <div
                      key={brand}
                      className="px-4 py-2 hover:bg-muted cursor-pointer"
                      onMouseDown={() => {
                        setFormData({ ...formData, brand });
                        setShowBrandDropdown(false);
                      }}
                    >
                      {brand}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Variant/Strength (e.g., for Mounjaro 2.5mg, 5mg) */}
            <TabletInput
              label="Variant / Strength"
              placeholder="e.g., 2.5mg, 5mg, 10ml"
              value={formData.variant}
              onChange={(e) => setFormData({ ...formData, variant: e.target.value })}
            />

            {/* Initial Stock */}
            <TabletInput
              label="Initial Stock (in base units)"
              type="number"
              placeholder="0"
              value={formData.current_stock.toString()}
              onChange={(e) => setFormData({ ...formData, current_stock: parseFloat(e.target.value) || 0 })}
            />

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
          {filteredActiveItems.map((item) => {
            // Item has packaging configured if packaging_unit is set
            const hasPackaging = !!item.packaging_unit;
            
            return (
            <TabletCard key={item.id} className={editingId === item.id ? 'hidden' : ''}>
              <TabletCardContent className="flex items-center justify-between py-4">
                <div className="flex-1">
                  <div className="font-medium text-lg flex items-center gap-2 flex-wrap">
                    {item.item_name}
                    {item.variant && (
                      <Badge variant="secondary" className="text-xs">
                        {item.variant}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {item.unit}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {item.category}
                    {item.brand && <span> • {item.brand}</span>}
                    {hasPackaging && (
                      <span> • 1 {item.packaging_unit} = {item.units_per_package} {item.unit}</span>
                    )}
                  </div>
                  <div className="text-sm mt-1">
                    <span className={`font-medium ${(item.current_stock || 0) <= 0 ? 'text-destructive' : 'text-primary'}`}>
                      Stock: {item.current_stock || 0} {item.unit}
                    </span>
                  </div>
                </div>
                
                {/* Add Stock Modal */}
                {addStockId === item.id ? (
                  <div className="flex flex-col gap-3 min-w-[300px] p-3 bg-muted/50 rounded-lg">
                    {/* If packaging already configured, go straight to quantity */}
                    {hasPackaging ? (
                      <>
                        <div className="text-sm text-muted-foreground">
                          1 {item.packaging_unit} = {item.units_per_package} {item.unit}
                        </div>
                        <div className="flex items-center gap-2">
                          <TabletInput
                            type="number"
                            placeholder="Qty"
                            className="w-20"
                            value={packagesToAdd.toString()}
                            onChange={(e) => setPackagesToAdd(parseFloat(e.target.value) || 0)}
                            autoFocus
                          />
                          <span className="text-sm text-muted-foreground whitespace-nowrap">
                            {item.packaging_unit}(s) = {packagesToAdd * (item.units_per_package || 1)} {item.unit}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <TabletButton size="sm" onClick={() => handleAddStock(item.id)}>
                            Add Stock
                          </TabletButton>
                          <TabletButton size="sm" variant="ghost" onClick={resetAddStockState}>
                            <X className="h-4 w-4" />
                          </TabletButton>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Step 1: Select packaging unit */}
                        {addStockStep === 'packaging' && (
                          <>
                            <div className="text-sm font-medium">How does this item come?</div>
                            <div className="flex flex-wrap gap-2">
                              {PACKAGING_UNITS.map((pu) => (
                                <TabletButton
                                  key={pu}
                                  size="sm"
                                  variant={inlinePackagingUnit === pu ? 'default' : 'outline'}
                                  onClick={() => {
                                    setInlinePackagingUnit(pu);
                                    setAddStockStep('base_unit');
                                  }}
                                >
                                  {pu}
                                </TabletButton>
                              ))}
                            </div>
                            <TabletButton size="sm" variant="ghost" onClick={resetAddStockState}>
                              Cancel
                            </TabletButton>
                          </>
                        )}

                        {/* Step 2: Select base unit and quantity per package */}
                        {addStockStep === 'base_unit' && (
                          <>
                            <div className="text-sm font-medium">
                              1 {inlinePackagingUnit} contains how many?
                            </div>
                            <div className="flex gap-2 items-center">
                              <TabletInput
                                type="number"
                                placeholder="Amount"
                                className="w-20"
                                value={inlineUnitsPerPackage.toString()}
                                onChange={(e) => setInlineUnitsPerPackage(parseFloat(e.target.value) || 1)}
                                autoFocus
                              />
                              <Select
                                value={inlineBaseUnit}
                                onValueChange={(val) => setInlineBaseUnit(val)}
                              >
                                <SelectTrigger className="h-10 w-28">
                                  <SelectValue placeholder="Unit" />
                                </SelectTrigger>
                                <SelectContent>
                                  {BASE_UNITS.map((u) => (
                                    <SelectItem key={u} value={u}>
                                      {u}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            {inlineBaseUnit && inlineUnitsPerPackage > 0 && (
                              <div className="text-xs text-muted-foreground">
                                1 {inlinePackagingUnit} = {inlineUnitsPerPackage} {inlineBaseUnit}
                              </div>
                            )}
                            <div className="flex gap-2">
                              <TabletButton
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setInlinePackagingUnit('');
                                  setAddStockStep('packaging');
                                }}
                              >
                                Back
                              </TabletButton>
                              <TabletButton
                                size="sm"
                                disabled={!inlineBaseUnit || inlineUnitsPerPackage <= 0}
                                onClick={() => setAddStockStep('quantity')}
                              >
                                Next
                              </TabletButton>
                              <TabletButton size="sm" variant="ghost" onClick={resetAddStockState}>
                                <X className="h-4 w-4" />
                              </TabletButton>
                            </div>
                          </>
                        )}

                        {/* Step 3: Enter quantity */}
                        {addStockStep === 'quantity' && (
                          <>
                            <div className="text-sm text-muted-foreground">
                              1 {inlinePackagingUnit} = {inlineUnitsPerPackage} {inlineBaseUnit}
                            </div>
                            <div className="text-sm font-medium">How many {inlinePackagingUnit}s to add?</div>
                            <div className="flex items-center gap-2">
                              <TabletInput
                                type="number"
                                placeholder="Qty"
                                className="w-20"
                                value={packagesToAdd.toString()}
                                onChange={(e) => setPackagesToAdd(parseFloat(e.target.value) || 0)}
                                autoFocus
                              />
                              <span className="text-sm text-muted-foreground whitespace-nowrap">
                                {inlinePackagingUnit}(s) = {packagesToAdd * inlineUnitsPerPackage} {inlineBaseUnit}
                              </span>
                            </div>
                            <div className="flex gap-2">
                              <TabletButton
                                size="sm"
                                variant="outline"
                                onClick={() => setAddStockStep('base_unit')}
                              >
                                Back
                              </TabletButton>
                              <TabletButton
                                size="sm"
                                onClick={() => handleAddStock(item.id)}
                                disabled={packagesToAdd <= 0}
                              >
                                Add Stock
                              </TabletButton>
                              <TabletButton size="sm" variant="ghost" onClick={resetAddStockState}>
                                <X className="h-4 w-4" />
                              </TabletButton>
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <TabletButton
                      variant="outline"
                      size="sm"
                      onClick={() => setAddStockId(item.id)}
                      leftIcon={<PackagePlus className="h-4 w-4" />}
                    >
                      Add Stock
                    </TabletButton>
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
                )}
              </TabletCardContent>
            </TabletCard>
          );
          })}
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
