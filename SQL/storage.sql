-- Create buckets
insert into storage.buckets (id, name, public) values ('product-images', 'product-images', false);
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false);

-- No public policies; access via signed URLs from server only.
-- Path convention:
-- Product images: product-images/{seller_id}/{escrow_id}/{uuid}.{ext}
-- Receipts: receipts/{escrow_id}/{uploader_id}/{uuid}.{ext}
