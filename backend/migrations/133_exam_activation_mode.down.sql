-- 考试统一生命周期：回滚启用条件列
ALTER TABLE public.exam_usages
    DROP COLUMN IF EXISTS activation_mode;
