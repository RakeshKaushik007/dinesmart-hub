
UPDATE auth.users
SET email = 'admin@blennix.com',
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'::jsonb),
      '{email}',
      '"admin@blennix.com"'
    )
WHERE id = '6ad7eeef-0df0-432a-91ec-f5f085a375ad';

UPDATE public.profiles
SET email = 'admin@blennix.com'
WHERE user_id = '6ad7eeef-0df0-432a-91ec-f5f085a375ad';
