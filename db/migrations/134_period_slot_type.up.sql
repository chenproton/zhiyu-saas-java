-- 节次增加时段类型：早自习(morning_self)/上午(morning)/下午(afternoon)/晚自习(evening)
ALTER TABLE public.period_slots
    ADD COLUMN slot_type character varying(16) NOT NULL DEFAULT 'morning';

-- 旧数据回填：按 sort_order 位置对齐原有网格标签约定（0-3 上午、4-7 下午、其余晚自习），
-- 默认值即为 morning，仅回填下午与晚自习
UPDATE public.period_slots SET slot_type = 'afternoon'
    WHERE sort_order >= 4 AND sort_order < 8;
UPDATE public.period_slots SET slot_type = 'evening'
    WHERE sort_order >= 8;
