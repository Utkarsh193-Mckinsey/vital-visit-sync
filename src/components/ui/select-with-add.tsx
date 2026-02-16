import { useState } from 'react';
import { Plus, Check, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TabletInput } from '@/components/ui/tablet-input';
import { cn } from '@/lib/utils';

interface SelectWithAddProps {
  value: string;
  onValueChange: (value: string) => void;
  options: string[];
  onAddOption?: (option: string) => void;
  placeholder?: string;
  triggerClassName?: string;
  itemClassName?: string;
  label?: string;
}

export function SelectWithAdd({
  value,
  onValueChange,
  options,
  onAddOption,
  placeholder = 'Select...',
  triggerClassName,
  itemClassName,
  label,
}: SelectWithAddProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newValue, setNewValue] = useState('');

  const handleAdd = () => {
    const trimmed = newValue.trim();
    if (!trimmed) return;
    if (!options.includes(trimmed)) {
      onAddOption?.(trimmed);
    }
    onValueChange(trimmed);
    setNewValue('');
    setIsAdding(false);
  };

  if (isAdding) {
    return (
      <div className="flex gap-1.5">
        <TabletInput
          placeholder="Type new option..."
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          className="flex-1"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd();
            if (e.key === 'Escape') { setIsAdding(false); setNewValue(''); }
          }}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!newValue.trim()}
          className="flex items-center justify-center h-14 w-10 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => { setIsAdding(false); setNewValue(''); }}
          className="flex items-center justify-center h-14 w-10 rounded-md border border-input hover:bg-accent transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-1.5">
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className={cn('flex-1', triggerClassName)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt} className={itemClassName}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {onAddOption && (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="flex items-center justify-center h-14 w-10 rounded-md border border-input text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Add new option"
        >
          <Plus className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
