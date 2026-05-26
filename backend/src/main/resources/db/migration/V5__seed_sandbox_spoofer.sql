-- Seed default sandbox/fallback spoofer contributor to prevent foreign key constraint violations
INSERT INTO public.contributors (
    contributor_id,
    full_name,
    email,
    username,
    password_hash,
    role,
    account_status,
    trust_score,
    writing_token_status
) VALUES (
    '88bc8912-43ba-4abc-882a-ef92481aa323',
    'Pedro Penduko',
    'pedro@politikapp.gov.ph',
    'pedro_sandbox',
    '$2a$10$tZ2cK.2.mF.yq4H5Lgq5eO/J5F5L.gX1N2l3u3T4e5R6y7U8i9O0P', -- secure bcrypt placeholder hash
    'ADMIN',
    'ACTIVE',
    100.00,
    'ACTIVE'
) ON CONFLICT (contributor_id) DO NOTHING;
