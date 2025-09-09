-- Migration: add active_escrow tracking and enforce single active escrow per user
-- Adds profiles.active_escrow_id, ensures role default is 'user', and creates triggers

BEGIN;

-- 1) Add active_escrow_id column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_escrow_id uuid NULL REFERENCES public.escrows(id) ON DELETE SET NULL;

-- 2) Ensure role default is 'user' and allowed roles include 'user'
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'user';
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS allowed_roles;
ALTER TABLE public.profiles
  ADD CONSTRAINT allowed_roles CHECK (role IN ('user','buyer','seller','admin'));

-- 3) Prevent creating a new escrow if the seller already has an active escrow
CREATE OR REPLACE FUNCTION public.escrow_before_insert() RETURNS trigger AS $$
DECLARE
  s_active uuid;
BEGIN
  IF NEW.seller_id IS NOT NULL THEN
    SELECT active_escrow_id INTO s_active FROM public.profiles WHERE id = NEW.seller_id;
    IF s_active IS NOT NULL THEN
      RAISE EXCEPTION 'Seller already has an active escrow (active_escrow_id=%).', s_active;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS escrow_before_insert ON public.escrows;
CREATE TRIGGER escrow_before_insert
  BEFORE INSERT ON public.escrows
  FOR EACH ROW EXECUTE FUNCTION public.escrow_before_insert();

-- 4) After insert, set seller's active_escrow_id
CREATE OR REPLACE FUNCTION public.escrow_after_insert() RETURNS trigger AS $$
BEGIN
  IF NEW.seller_id IS NOT NULL THEN
    UPDATE public.profiles SET active_escrow_id = NEW.id WHERE id = NEW.seller_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS escrow_after_insert ON public.escrows;
CREATE TRIGGER escrow_after_insert
  AFTER INSERT ON public.escrows
  FOR EACH ROW EXECUTE FUNCTION public.escrow_after_insert();

-- 5) When buyer joins (buyer_id set), ensure they have no active escrow and set it
CREATE OR REPLACE FUNCTION public.escrow_after_update_set_buyer() RETURNS trigger AS $$
DECLARE
  b_active uuid;
BEGIN
  -- Only act when buyer_id is newly set
  IF (TG_OP = 'UPDATE') AND (NEW.buyer_id IS NOT NULL) AND (OLD.buyer_id IS NULL) THEN
    SELECT active_escrow_id INTO b_active FROM public.profiles WHERE id = NEW.buyer_id;
    IF b_active IS NOT NULL THEN
      RAISE EXCEPTION 'Buyer already has an active escrow (active_escrow_id=%).', b_active;
    END IF;
    UPDATE public.profiles SET active_escrow_id = NEW.id WHERE id = NEW.buyer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS escrow_after_update_set_buyer ON public.escrows;
CREATE TRIGGER escrow_after_update_set_buyer
  AFTER UPDATE ON public.escrows
  FOR EACH ROW EXECUTE FUNCTION public.escrow_after_update_set_buyer();

-- 6) When escrow status changes to a terminal state, clear active_escrow_id for both parties
CREATE OR REPLACE FUNCTION public.escrow_after_update_clear_active() RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    IF (OLD.status IS DISTINCT FROM NEW.status) AND (NEW.status IN ('completed','refunded','closed','on_hold','cancelled')) THEN
      -- Clear seller
      IF OLD.seller_id IS NOT NULL THEN
        UPDATE public.profiles SET active_escrow_id = NULL WHERE id = OLD.seller_id AND active_escrow_id = OLD.id;
      END IF;
      -- Clear buyer
      IF OLD.buyer_id IS NOT NULL THEN
        UPDATE public.profiles SET active_escrow_id = NULL WHERE id = OLD.buyer_id AND active_escrow_id = OLD.id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS escrow_after_update_clear_active ON public.escrows;
CREATE TRIGGER escrow_after_update_clear_active
  AFTER UPDATE ON public.escrows
  FOR EACH ROW EXECUTE FUNCTION public.escrow_after_update_clear_active();

COMMIT;
