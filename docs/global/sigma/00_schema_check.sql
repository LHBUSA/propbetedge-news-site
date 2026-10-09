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
