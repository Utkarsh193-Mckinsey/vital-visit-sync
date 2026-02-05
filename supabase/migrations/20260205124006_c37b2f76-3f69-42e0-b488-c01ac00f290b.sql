-- Add brand and current_stock columns to stock_items table
ALTER TABLE public.stock_items
ADD COLUMN brand text,
ADD COLUMN current_stock numeric DEFAULT 0;

-- Create index for brand autocomplete
CREATE INDEX idx_stock_items_brand ON public.stock_items(brand) WHERE brand IS NOT NULL;