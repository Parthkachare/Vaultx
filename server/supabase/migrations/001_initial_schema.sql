-- VaultX Supabase PostgreSQL schema.
--
-- All application access is server-side only. Browser roles (anon and
-- authenticated) have no table privileges, and RLS is enabled without any
-- client policies. The trusted backend uses the Supabase service_role or a
-- dedicated server-side database role. Never ship server credentials to the
-- browser. Encrypted PDFs live in the private vaultx-papers Storage bucket;
-- this schema stores only their object path and encryption metadata.

BEGIN;

CREATE TABLE public.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL CHECK (length(btrim(name)) > 0),
    email text NOT NULL UNIQUE
        CHECK (email = lower(btrim(email)) AND length(email) > 0),
    password_hash text NOT NULL CHECK (length(password_hash) > 0),
    role text NOT NULL
        CHECK (role IN ('Admin', 'Exam Controller', 'Manager 1', 'Manager 2')),
    department text NOT NULL DEFAULT '',
    phone text NOT NULL DEFAULT '',
    preferences jsonb NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(preferences) = 'object'),
    notification_preferences jsonb NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(notification_preferences) = 'object'),
    is_active boolean NOT NULL DEFAULT true,
    is_deleted boolean NOT NULL DEFAULT false,
    deleted_at timestamptz,
    failed_login_attempts integer NOT NULL DEFAULT 0
        CHECK (failed_login_attempts >= 0),
    locked_until timestamptz,
    last_login_at timestamptz,
    last_login_ip text NOT NULL DEFAULT '',
    token_version integer NOT NULL DEFAULT 0 CHECK (token_version >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT users_deleted_at_requires_deleted
        CHECK (deleted_at IS NULL OR is_deleted)
);

CREATE INDEX users_role_active_idx ON public.users (role, is_active)
    WHERE is_deleted = false;

CREATE TABLE public.papers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id text NOT NULL UNIQUE CHECK (length(btrim(paper_id)) > 0),
    exam_name text NOT NULL CHECK (length(btrim(exam_name)) > 0),
    subject text NOT NULL CHECK (length(btrim(subject)) > 0),
    course text NOT NULL CHECK (length(btrim(course)) > 0),
    exam_date date NOT NULL,
    exam_start_at timestamptz NOT NULL,
    unlock_at timestamptz NOT NULL,
    expiry_at timestamptz NOT NULL,
    manager1_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    manager2_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    manager1_approved boolean NOT NULL DEFAULT false,
    manager2_approved boolean NOT NULL DEFAULT false,
    manager1_approved_at timestamptz,
    manager2_approved_at timestamptz,
    uploaded_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    storage_object_path text NOT NULL
        CHECK (
            length(btrim(storage_object_path)) > 0
            AND storage_object_path !~ '(^/|(^|/)\.\.?(/|$)|^https?://)'
        ),
    encryption_key_id text NOT NULL CHECK (length(btrim(encryption_key_id)) > 0),
    wrapped_encryption_key text NOT NULL
        CHECK (wrapped_encryption_key ~ '^[0-9a-fA-F]{64}$'),
    key_wrapping_iv text NOT NULL
        CHECK (key_wrapping_iv ~ '^[0-9a-fA-F]{24}$'),
    key_wrapping_tag text NOT NULL
        CHECK (key_wrapping_tag ~ '^[0-9a-fA-F]{32}$'),
    encryption_iv text NOT NULL
        CHECK (encryption_iv ~ '^[0-9a-fA-F]{24}$'),
    encryption_tag text NOT NULL
        CHECK (encryption_tag ~ '^[0-9a-fA-F]{32}$'),
    original_filename text NOT NULL CHECK (length(btrim(original_filename)) > 0),
    file_size_bytes bigint NOT NULL CHECK (file_size_bytes >= 0),
    status text NOT NULL DEFAULT 'LOCKED'
        CHECK (status IN ('LOCKED', 'AWAITING_APPROVAL', 'APPROVED', 'UNLOCKED', 'EXPIRED')),
    security_level text NOT NULL DEFAULT 'HIGH'
        CHECK (security_level IN ('HIGH', 'CRITICAL')),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT papers_distinct_managers CHECK (manager1_id <> manager2_id),
    CONSTRAINT papers_unlock_not_after_start CHECK (unlock_at <= exam_start_at),
    CONSTRAINT papers_expiry_after_exam_and_unlock
        CHECK (expiry_at > exam_start_at AND expiry_at > unlock_at),
    CONSTRAINT papers_manager1_approval_timestamp
        CHECK (manager1_approved = (manager1_approved_at IS NOT NULL)),
    CONSTRAINT papers_manager2_approval_timestamp
        CHECK (manager2_approved = (manager2_approved_at IS NOT NULL)),
    CONSTRAINT papers_private_bucket_object_path UNIQUE (storage_object_path)
);

COMMENT ON COLUMN public.papers.exam_date IS
    'UTC calendar date from the upload request; schedule instants are stored in the *_at columns.';
COMMENT ON COLUMN public.papers.exam_start_at IS
    'Full UTC instant for the exam start; use timestamptz comparisons, not session-local time.';
COMMENT ON COLUMN public.papers.unlock_at IS
    'Full UTC unlock instant. Access is permitted at equality (now >= unlock_at).';
COMMENT ON COLUMN public.papers.expiry_at IS
    'Full UTC expiry instant. Access is permitted at equality (now <= expiry_at).';
COMMENT ON COLUMN public.papers.storage_object_path IS
    'Object key inside the private vaultx-papers Supabase Storage bucket; never a public URL.';
COMMENT ON COLUMN public.papers.wrapped_encryption_key IS
    'AES-256-GCM wrapped random data key; VAULTX_MASTER_KEY itself is never stored here.';

CREATE INDEX papers_status_created_idx ON public.papers (status, created_at DESC);
CREATE INDEX papers_exam_date_idx ON public.papers (exam_date, unlock_at);
CREATE INDEX papers_manager1_idx ON public.papers (manager1_id);
CREATE INDEX papers_manager2_idx ON public.papers (manager2_id);
CREATE INDEX papers_uploaded_by_idx ON public.papers (uploaded_by);

CREATE TABLE public.sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token_hash text NOT NULL UNIQUE CHECK (length(token_hash) > 0),
    user_agent text NOT NULL DEFAULT '',
    ip_address text NOT NULL DEFAULT '',
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT sessions_expiry_after_creation CHECK (expires_at > created_at)
);

CREATE INDEX sessions_user_active_idx ON public.sessions (user_id, expires_at DESC)
    WHERE revoked_at IS NULL;
CREATE INDEX sessions_expiry_idx ON public.sessions (expires_at);

CREATE TABLE public.otp_challenges (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    purpose text NOT NULL CHECK (purpose IN ('login', 'approval')),
    paper_id uuid REFERENCES public.papers(id) ON DELETE CASCADE,
    code_hash text NOT NULL CHECK (length(code_hash) > 0),
    expires_at timestamptz NOT NULL,
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
    consumed_at timestamptz,
    invalidated_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT otp_purpose_paper_consistency CHECK (
        (purpose = 'login' AND paper_id IS NULL)
        OR (purpose = 'approval' AND paper_id IS NOT NULL)
    ),
    CONSTRAINT otp_challenge_not_both_consumed_and_invalidated
        CHECK (consumed_at IS NULL OR invalidated_at IS NULL)
);

CREATE INDEX otp_challenges_user_purpose_created_idx
    ON public.otp_challenges (user_id, purpose, created_at DESC);
CREATE INDEX otp_challenges_expiry_idx ON public.otp_challenges (expires_at)
    WHERE consumed_at IS NULL AND invalidated_at IS NULL;
CREATE UNIQUE INDEX otp_challenges_one_active_login_idx
    ON public.otp_challenges (user_id, purpose)
    WHERE purpose = 'login'
      AND consumed_at IS NULL
      AND invalidated_at IS NULL;
CREATE UNIQUE INDEX otp_challenges_one_active_approval_idx
    ON public.otp_challenges (user_id, purpose, paper_id)
    WHERE purpose = 'approval'
      AND consumed_at IS NULL
      AND invalidated_at IS NULL;

CREATE TABLE public.approvals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id uuid NOT NULL REFERENCES public.papers(id) ON DELETE RESTRICT,
    manager_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    manager_slot smallint NOT NULL CHECK (manager_slot IN (1, 2)),
    status text NOT NULL DEFAULT 'APPROVED'
        CHECK (status IN ('APPROVED', 'REVOKED')),
    otp_verified boolean NOT NULL DEFAULT true,
    ip_address text NOT NULL,
    user_agent text NOT NULL DEFAULT '',
    timestamp timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT approvals_one_per_paper_slot UNIQUE (paper_id, manager_slot)
);

CREATE INDEX approvals_manager_idx ON public.approvals (manager_id, timestamp DESC);

CREATE TABLE public.audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    user_email text NOT NULL DEFAULT '',
    user_name text NOT NULL DEFAULT '',
    role text NOT NULL DEFAULT ''
        CHECK (role = '' OR role IN ('Admin', 'Exam Controller', 'Manager 1', 'Manager 2')),
    action text NOT NULL CHECK (length(action) > 0),
    paper_id text,
    ip_address text NOT NULL,
    user_agent text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'Success'
        CHECK (status IN ('Success', 'Failed', 'Warning')),
    timestamp timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_timestamp_idx ON public.audit_logs (timestamp DESC);
CREATE INDEX audit_logs_user_timestamp_idx ON public.audit_logs (user_id, timestamp DESC);
CREATE INDEX audit_logs_paper_timestamp_idx ON public.audit_logs (paper_id, timestamp DESC);
CREATE INDEX audit_logs_status_timestamp_idx ON public.audit_logs (status, timestamp DESC);

CREATE FUNCTION public.prevent_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs are append-only'
        USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER audit_logs_are_immutable
    BEFORE UPDATE OR DELETE ON public.audit_logs
    FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_mutation();

CREATE TABLE public.security_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    user_email text NOT NULL DEFAULT '',
    event_type text NOT NULL CHECK (event_type IN (
        'BRUTE_FORCE',
        'UNAUTHORIZED_ROLE',
        'UNAUTHORIZED_ACCESS',
        'EARLY_UNLOCK_ATTEMPT',
        'EXPIRED_PAPER_ACCESS',
        'CONCURRENT_SESSION',
        'UNKNOWN_IP',
        'REPEATED_UNLOCK_ATTEMPT',
        'SINGLE_MANAGER_UNLOCK'
    )),
    risk_level text NOT NULL DEFAULT 'Medium'
        CHECK (risk_level IN ('Low', 'Medium', 'High', 'Critical')),
    description text NOT NULL CHECK (length(description) > 0),
    ip_address text NOT NULL,
    user_agent text NOT NULL DEFAULT '',
    resolved boolean NOT NULL DEFAULT false,
    resolved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
    resolved_at timestamptz,
    timestamp timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT security_events_resolution_consistency CHECK (
        (resolved = false AND resolved_by IS NULL AND resolved_at IS NULL)
        OR (resolved = true AND resolved_at IS NOT NULL)
    )
);

CREATE INDEX security_events_timestamp_idx ON public.security_events (timestamp DESC);
CREATE INDEX security_events_open_idx ON public.security_events (timestamp DESC)
    WHERE resolved = false;
CREATE INDEX security_events_user_timestamp_idx ON public.security_events (user_id, timestamp DESC);

CREATE TABLE public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type text NOT NULL CHECK (length(type) > 0),
    title text NOT NULL CHECK (length(title) > 0),
    message text NOT NULL CHECK (length(message) > 0),
    paper_id text REFERENCES public.papers(paper_id) ON DELETE SET NULL,
    is_read boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_recipient_created_idx
    ON public.notifications (recipient, created_at DESC);
CREATE INDEX notifications_unread_idx
    ON public.notifications (recipient, created_at DESC)
    WHERE is_read = false;

-- Supabase browser roles must have neither grants nor permissive RLS policies.
-- The backend is the only application access path and uses service_role (or a
-- separately provisioned trusted server-side PostgreSQL role).
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE
    public.users,
    public.sessions,
    public.otp_challenges,
    public.papers,
    public.approvals,
    public.audit_logs,
    public.security_events,
    public.notifications
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
    public.users,
    public.sessions,
    public.otp_challenges,
    public.papers,
    public.approvals,
    public.security_events,
    public.notifications
TO service_role;

GRANT SELECT, INSERT ON TABLE public.audit_logs TO service_role;

COMMIT;
