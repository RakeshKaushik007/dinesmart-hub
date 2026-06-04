
-- Keep canonical Blennix branch
DO $$
DECLARE
  keep_branch uuid := 'd65c28f6-fcae-4de8-8834-e1d7dbe88a32';
  keep_rest   uuid := '0e76f92e-0485-43eb-957a-3af74f380da2';
  drop_branches uuid[] := ARRAY[
    '7287727a-d4a9-4292-872a-f21355923969',
    'e32d1768-a95a-4485-a2a1-7a2791db0bc8',
    '186bb01f-d276-4e23-ac52-f759ff6de8e5'
  ]::uuid[];
  drop_rests uuid[] := ARRAY[
    '7213d0da-5c07-4efb-b3d8-96a9bddd01e0',
    '78159083-0131-4488-80fc-0c4f953a5385'
  ]::uuid[];
BEGIN
  -- Reassign all branch_id references to the kept branch
  UPDATE public.restaurant_tables  SET branch_id = keep_branch WHERE branch_id = ANY(drop_branches);
  UPDATE public.orders             SET branch_id = keep_branch WHERE branch_id = ANY(drop_branches);
  UPDATE public.prep_batches       SET branch_id = keep_branch WHERE branch_id = ANY(drop_branches);
  UPDATE public.wastage_logs       SET branch_id = keep_branch WHERE branch_id = ANY(drop_branches);
  UPDATE public.payment_methods    SET branch_id = keep_branch WHERE branch_id = ANY(drop_branches);
  UPDATE public.user_roles         SET branch_id = NULL        WHERE branch_id = ANY(drop_branches);
  UPDATE public.table_sessions     SET branch_id = keep_branch WHERE branch_id = ANY(drop_branches);
  UPDATE public.stock_transactions SET branch_id = keep_branch WHERE branch_id = ANY(drop_branches);
  UPDATE public.shifts             SET branch_id = keep_branch WHERE branch_id = ANY(drop_branches);
  UPDATE public.ingredients        SET branch_id = keep_branch WHERE branch_id = ANY(drop_branches);
  UPDATE public.menu_categories    SET branch_id = keep_branch WHERE branch_id = ANY(drop_branches);
  UPDATE public.prep_recipes       SET branch_id = keep_branch WHERE branch_id = ANY(drop_branches);
  UPDATE public.menu_items         SET branch_id = keep_branch WHERE branch_id = ANY(drop_branches);
  UPDATE public.stock_alerts       SET branch_id = keep_branch WHERE branch_id = ANY(drop_branches);
  UPDATE public.purchase_orders    SET branch_id = keep_branch WHERE branch_id = ANY(drop_branches);
  UPDATE public.daily_summaries    SET branch_id = keep_branch WHERE branch_id = ANY(drop_branches);

  -- Move branches under kept restaurant before deleting dropped restaurants
  UPDATE public.branches SET restaurant_id = keep_rest WHERE restaurant_id = ANY(drop_rests);

  -- Delete dummy branches
  DELETE FROM public.branches WHERE id = ANY(drop_branches);

  -- Delete dummy restaurants
  DELETE FROM public.restaurants WHERE id = ANY(drop_rests);

  -- Rename kept branch + restaurant
  UPDATE public.branches    SET name = 'Blennix Branch' WHERE id = keep_branch;
  UPDATE public.restaurants SET name = 'Blennix'        WHERE id = keep_rest;
END $$;
