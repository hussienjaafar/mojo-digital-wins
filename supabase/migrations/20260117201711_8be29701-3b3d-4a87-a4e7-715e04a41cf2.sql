-- Create meta_capi_config table for per-org CAPI configuration
CREATE TABLE public.meta_capi_config (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES public.client_organizations(id) ON DELETE CASCADE,
    pixel_id TEXT NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    privacy_mode TEXT NOT NULL DEFAULT 'standard' CHECK (privacy_mode IN ('minimal', 'standard', 'maximum')),
    test_event_code TEXT,
    events_sent INTEGER NOT NULL DEFAULT 0,
    events_failed INTEGER NOT NULL DEFAULT 0,
    last_event_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (organization_id)
);

-- Enable RLS
ALTER TABLE public.meta_capi_config ENABLE ROW LEVEL SECURITY;

-- RLS policies for meta_capi_config using user_roles table with correct enum (admin only)
CREATE POLICY "Admins can view all CAPI configs" 
ON public.meta_capi_config 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_roles.user_id = auth.uid() 
        AND user_roles.role = 'admin'
    )
);

CREATE POLICY "Admins can insert CAPI configs" 
ON public.meta_capi_config 
FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_roles.user_id = auth.uid() 
        AND user_roles.role = 'admin'
    )
);

CREATE POLICY "Admins can update CAPI configs" 
ON public.meta_capi_config 
FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_roles.user_id = auth.uid() 
        AND user_roles.role = 'admin'
    )
);

CREATE POLICY "Admins can delete CAPI configs" 
ON public.meta_capi_config 
FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_roles.user_id = auth.uid() 
        AND user_roles.role = 'admin'
    )
);

-- Create helper function to update CAPI health stats
CREATE OR REPLACE FUNCTION public.update_capi_health_stats(
    p_organization_id UUID,
    p_success BOOLEAN,
    p_error TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    IF p_success THEN
        UPDATE public.meta_capi_config
        SET 
            events_sent = events_sent + 1,
            last_event_at = now(),
            updated_at = now()
        WHERE organization_id = p_organization_id;
    ELSE
        UPDATE public.meta_capi_config
        SET 
            events_failed = events_failed + 1,
            last_error = p_error,
            updated_at = now()
        WHERE organization_id = p_organization_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;