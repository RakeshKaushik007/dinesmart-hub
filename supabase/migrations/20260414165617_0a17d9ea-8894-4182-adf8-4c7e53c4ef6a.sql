-- Grant anon role usage on the order_number sequence so QR customers can place orders
GRANT USAGE, SELECT ON SEQUENCE public.orders_order_number_seq TO anon;