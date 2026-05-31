-- Owner 1: owner@blennix.com — no restaurant, no branch. Create both.
WITH new_rest AS (
  INSERT INTO public.restaurants (name, address, owner_user_id, created_by, is_active)
  VALUES ('My Restaurant', NULL, '4cb1587a-ac0f-4218-8455-a958c65acd98', '4cb1587a-ac0f-4218-8455-a958c65acd98', true)
  RETURNING id
)
INSERT INTO public.branches (name, restaurant_id, created_by, is_active)
SELECT 'Main Branch', id, '4cb1587a-ac0f-4218-8455-a958c65acd98', true FROM new_rest;

-- Owner 3: rakesh.admin@blennix.com — has branch 7287727a but it has no restaurant. Create restaurant and link.
WITH new_rest AS (
  INSERT INTO public.restaurants (name, owner_user_id, created_by, is_active)
  VALUES ('Rakesh Restaurant', '8d4e20c7-2273-48df-a860-ed9d00f05dd8', '8d4e20c7-2273-48df-a860-ed9d00f05dd8', true)
  RETURNING id
)
UPDATE public.branches
SET restaurant_id = (SELECT id FROM new_rest)
WHERE id = '7287727a-d4a9-4292-872a-f21355923969';