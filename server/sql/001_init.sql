CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    admin_role VARCHAR(30),
    full_name VARCHAR(255) NOT NULL,
    contact VARCHAR(20),
    address TEXT,
    dob DATE,
    avatar_url TEXT,
    preferences JSONB NOT NULL DEFAULT '{"inApp": true, "email": false}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS requests (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(120) NOT NULL,
    purpose TEXT,
    address TEXT,
    contact VARCHAR(20),
    status VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Cancelled')),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_logs (
    id BIGSERIAL PRIMARY KEY,
    actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_type VARCHAR(50),
    target_id VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
    id INT PRIMARY KEY,
    system_name VARCHAR(255) NOT NULL,
    logo_url TEXT,
    admin_subtitle VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    request_rules JSONB NOT NULL DEFAULT '{"requireAddress": true, "requireContact": true, "requirePurpose": true, "requireAttachment": false}'::jsonb,
    workflow JSONB NOT NULL DEFAULT '{"allowResetToPending": true}'::jsonb,
    document_types JSONB NOT NULL DEFAULT '["Barangay Clearance", "Certification of Indigency", "Barangay ID", "Certificate of Residency"]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_resets (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO settings (id, system_name, logo_url, admin_subtitle)
VALUES (1, 'BARANGAY REQUEST SYSTEM', 'barangay-logo.jpg', 'Admin Request Management')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (username, email, password_hash, role, admin_role, full_name)
SELECT 'admin', 'admin@example.com', '$2a$10$Lh4GXLiCFYI8aAizI0s5EefM4T/6QAEyy6AdZkGouVp21HbQJsebq', 'admin', 'Super Admin', 'System Administrator'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin');
-- default admin password: admin123
