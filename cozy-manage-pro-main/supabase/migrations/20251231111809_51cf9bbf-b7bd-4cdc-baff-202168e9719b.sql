-- Create messages table for owner-manager communication
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('owner', 'manager')),
  message TEXT NOT NULL,
  attachments TEXT[] DEFAULT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Owners can view messages for their properties
CREATE POLICY "Owners can view messages for their properties"
ON public.messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.properties
    WHERE properties.id = messages.property_id
    AND properties.owner_id = auth.uid()
  )
);

-- Owners can send messages for their properties
CREATE POLICY "Owners can send messages for their properties"
ON public.messages
FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND sender_type = 'owner'
  AND EXISTS (
    SELECT 1 FROM public.properties
    WHERE properties.id = messages.property_id
    AND properties.owner_id = auth.uid()
  )
);

-- Managers can view all messages
CREATE POLICY "Managers can view all messages"
ON public.messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('manager', 'admin')
  )
);

-- Managers can send messages
CREATE POLICY "Managers can send messages"
ON public.messages
FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND sender_type = 'manager'
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('manager', 'admin')
  )
);

-- Managers can update messages (mark as read)
CREATE POLICY "Managers can update messages"
ON public.messages
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('manager', 'admin')
  )
);

-- Owners can update their own messages read status
CREATE POLICY "Owners can update message read status"
ON public.messages
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.properties
    WHERE properties.id = messages.property_id
    AND properties.owner_id = auth.uid()
  )
);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Create index for faster queries
CREATE INDEX idx_messages_property_id ON public.messages(property_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);