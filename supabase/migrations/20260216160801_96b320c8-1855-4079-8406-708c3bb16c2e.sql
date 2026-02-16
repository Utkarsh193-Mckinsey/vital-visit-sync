
ALTER TABLE public.visits
ADD COLUMN IF NOT EXISTS temperature numeric NULL,
ADD COLUMN IF NOT EXISTS height_cm numeric NULL,
ADD COLUMN IF NOT EXISTS respiratory_rate integer NULL,
ADD COLUMN IF NOT EXISTS spo2 integer NULL,
ADD COLUMN IF NOT EXISTS hip_cm numeric NULL,
ADD COLUMN IF NOT EXISTS waist_cm numeric NULL,
ADD COLUMN IF NOT EXISTS head_circumference_cm numeric NULL,
ADD COLUMN IF NOT EXISTS sugar numeric NULL,
ADD COLUMN IF NOT EXISTS urinalysis text NULL,
ADD COLUMN IF NOT EXISTS other_details text NULL,
ADD COLUMN IF NOT EXISTS lmp text NULL;
