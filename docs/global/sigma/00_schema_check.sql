-- 00 SCHEMA CHECK (zero rows: column names only). Run ONE statement at a time in the Sigma editor.
-- If any column used by 01-07 is missing, adjust that query; never change a definition in README.md.
select * from charges limit 0;
select * from customers limit 0;
select * from subscriptions limit 0;
select * from subscription_items limit 0;
select * from invoices limit 0;
select * from invoice_line_items limit 0;
select * from prices limit 0;
select * from products limit 0;
select * from refunds limit 0;
select * from disputes limit 0;
-- 08 reads Checkout Sessions: confirm client_reference_id, payment_link_id (or the column that holds the Payment Link
-- id), status, subscription_id, customer_id and created exist; if a name differs, adjust 08 only.
select * from checkout_sessions limit 0;
-- invoices: Sigma names the invoice timestamp `date` (not `created`); 01/03/04/06 alias it.
