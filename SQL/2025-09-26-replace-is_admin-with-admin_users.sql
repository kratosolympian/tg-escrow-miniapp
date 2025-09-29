
BEGIN;

CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id)
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read admin_users" ON public.admin_users;
CREATE POLICY "public read admin_users" ON public.admin_users FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin read profiles" ON public.profiles;
CREATE POLICY "admin read profiles" ON public.profiles FOR SELECT USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid()));

DROP POLICY IF EXISTS "member read escrows" ON public.escrows;
CREATE POLICY "member read escrows" ON public.escrows FOR SELECT USING (
  seller_id = auth.uid()
  OR buyer_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid())
);
DROP POLICY IF EXISTS "admin all escrows" ON public.escrows;
CREATE POLICY "admin all escrows" ON public.escrows FOR ALL USING (
  EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid())
);

DROP POLICY IF EXISTS "member read receipts" ON public.receipts;
CREATE POLICY "member read receipts" ON public.receipts FOR SELECT USING (
  uploaded_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.escrows e WHERE e.id = escrow_id AND (e.seller_id = auth.uid() OR e.buyer_id = auth.uid()))
  OR EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid())
);

DROP POLICY IF EXISTS "admin write settings" ON public.admin_settings;
CREATE POLICY "admin write settings" ON public.admin_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid())
);

DROP POLICY IF EXISTS "member read logs" ON public.status_logs;
CREATE POLICY "member read logs" ON public.status_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.escrows e WHERE e.id = escrow_id AND (e.seller_id = auth.uid() OR e.buyer_id = auth.uid()))
  OR EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid())
);
DROP POLICY IF EXISTS "member write logs" ON public.status_logs;
CREATE POLICY "member write logs" ON public.status_logs FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.escrows e WHERE e.id = escrow_id AND (e.seller_id = auth.uid() OR e.buyer_id = auth.uid()))
  OR EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid())
);

DROP POLICY IF EXISTS "member read disputes" ON public.disputes;
CREATE POLICY "member read disputes" ON public.disputes FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.escrows e WHERE e.id = escrow_id AND (e.seller_id = auth.uid() OR e.buyer_id = auth.uid()))
  OR EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid())
);
DROP POLICY IF EXISTS "member write disputes" ON public.disputes;
CREATE POLICY "member write disputes" ON public.disputes FOR ALL USING (
  EXISTS (SELECT 1 FROM public.escrows e WHERE e.id = escrow_id AND (e.seller_id = auth.uid() OR e.buyer_id = auth.uid()))
  OR EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid())
);

DROP POLICY IF EXISTS "member read chat" ON public.chat_messages;
CREATE POLICY "member read chat" ON public.chat_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.escrows e WHERE e.id = escrow_id AND (e.seller_id = auth.uid() OR e.buyer_id = auth.uid()))
  OR EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid())
);
DROP POLICY IF EXISTS "member write chat" ON public.chat_messages;
CREATE POLICY "member write chat" ON public.chat_messages FOR INSERT WITH CHECK (
  sender_id = auth.uid() AND (
    EXISTS (SELECT 1 FROM public.escrows e WHERE e.id = escrow_id AND (e.seller_id = auth.uid() OR e.buyer_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid())
  )
);
DROP POLICY IF EXISTS "member update chat" ON public.chat_messages;
CREATE POLICY "member update chat" ON public.chat_messages FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.escrows e WHERE e.id = escrow_id AND (e.seller_id = auth.uid() OR e.buyer_id = auth.uid()))
  OR EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid())
);

DROP POLICY IF EXISTS "member read participants" ON public.chat_participants;
CREATE POLICY "member read participants" ON public.chat_participants FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.escrows e WHERE e.id = escrow_id AND (e.seller_id = auth.uid() OR e.buyer_id = auth.uid()))
  OR EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid())
);
DROP POLICY IF EXISTS "member write participants" ON public.chat_participants;
CREATE POLICY "member write participants" ON public.chat_participants FOR ALL USING (
  user_id = auth.uid() AND (
    EXISTS (SELECT 1 FROM public.escrows e WHERE e.id = escrow_id AND (e.seller_id = auth.uid() OR e.buyer_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid())
  )
);

COMMIT;

