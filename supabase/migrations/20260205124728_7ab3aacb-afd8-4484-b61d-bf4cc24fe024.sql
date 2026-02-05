-- Add packaging and variant columns to stock_items table
ALTER TABLE public.stock_items
ADD COLUMN packaging_unit text,
ADD COLUMN units_per_package numeric DEFAULT 1,
ADD COLUMN variant text;