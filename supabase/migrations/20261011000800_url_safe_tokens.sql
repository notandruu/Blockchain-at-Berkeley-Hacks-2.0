-- Campaign tokens ride in a QR code query string. Standard base64 can contain '+', which a
-- query string decodes as a space, so about one claim link in four would fail. Use the
-- URL-safe alphabet and drop padding.
alter table public.campaigns
  alter column public_token set default
    rtrim(translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_'), '=');

update public.campaigns
  set public_token = rtrim(translate(public_token, '+/', '-_'), '=')
  where public_token ~ '[+/=]';
