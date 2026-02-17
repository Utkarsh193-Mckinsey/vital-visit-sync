import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TabletInput } from '@/components/ui/tablet-input';
import { Label } from '@/components/ui/label';

interface Props {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  roles?: ('admin' | 'reception' | 'nurse' | 'doctor')[];
}

export function StaffDropdown({ value, onChange, label = 'Registered By', roles = ['admin', 'reception'] }: Props) {
  const [staffList, setStaffList] = useState<{ id: string; full_name: string }[]>([]);
  const [showOther, setShowOther] = useState(false);
  const [otherValue, setOtherValue] = useState('');

  useEffect(() => {
    supabase
      .from('staff')
      .select('id, full_name')
      .eq('status', 'active')
      .in('role', roles)
      .order('full_name')
      .then(({ data }) => {
        if (data) setStaffList(data);
      });
  }, [roles.join(',')]);

  const handleSelect = (v: string) => {
    if (v === '__other__') {
      setShowOther(true);
      onChange(otherValue);
    } else {
      setShowOther(false);
      setOtherValue('');
      onChange(v);
    }
  };

  const handleOtherChange = (v: string) => {
    setOtherValue(v);
    onChange(v);
  };

  const selectValue = showOther ? '__other__' : (staffList.some(s => s.full_name === value) ? value : (value && !showOther ? '__other__' : ''));

  // If value doesn't match any staff and is non-empty, show other
  useEffect(() => {
    if (value && staffList.length > 0 && !staffList.some(s => s.full_name === value)) {
      setShowOther(true);
      setOtherValue(value);
    }
  }, [staffList]);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={selectValue} onValueChange={handleSelect}>
        <SelectTrigger>
          <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {staffList.map(s => (
            <SelectItem key={s.id} value={s.full_name}>{s.full_name}</SelectItem>
          ))}
          <SelectItem value="__other__">Other</SelectItem>
        </SelectContent>
      </Select>
      {showOther && (
        <TabletInput
          placeholder="Enter name"
          value={otherValue}
          onChange={e => handleOtherChange(e.target.value)}
        />
      )}
    </div>
  );
}
