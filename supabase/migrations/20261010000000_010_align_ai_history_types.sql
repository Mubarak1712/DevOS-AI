-- Align ai_history table type constraint to support all generator types
DO $$
BEGIN
  -- Drop existing restrictive check constraint on type if it exists
  ALTER TABLE public.ai_history DROP CONSTRAINT IF EXISTS ai_history_type_check;
  
  -- Add updated check constraint allowing all generator types
  ALTER TABLE public.ai_history ADD CONSTRAINT ai_history_type_check 
    CHECK (type IN (
      'analyze',
      'roadmap',
      'architecture',
      'readme',
      'docs',
      'idea',
      'plan',
      'release',
      'audit',
      'idea_capture',
      'document_conversion',
      'documentation'
    ));
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

NOTIFY pgrst, 'reload schema';
