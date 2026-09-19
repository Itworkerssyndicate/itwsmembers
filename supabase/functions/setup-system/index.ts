// =====================================================
// IT SYNDICATE — Setup System Edge Function
// =====================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const SUPABASE_URL = 'https://zenhokbsuxgiyptmdphs.supabase.co';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const logs: Array<{ message: string; type: string }> = [];
  const log = (message: string, type = 'info') => logs.push({ message, type });

  try {
    const body = await req.json();
    const { service_key, admin_email, admin_password, admin_name } = body;

    if (!service_key || !admin_email || !admin_password || !admin_name) {
      return new Response(JSON.stringify({
        success: false,
        error: 'بيانات ناقصة',
        logs
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    log('الاتصال بـ Supabase...', 'info');

    const supabase = createClient(SUPABASE_URL, service_key, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    /* ============================================
       STEP 1: SQL SETUP
       ============================================ */
    log('📦 إنشاء الجداول والـ Policies...', 'info');

    const SQL_SETUP = `
-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tables
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  full_name TEXT,
  role TEXT DEFAULT 'committee' CHECK (role IN ('head', 'committee')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme TEXT DEFAULT 'neon-dark',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS membership_types (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  fee NUMERIC(10,2) DEFAULT 0,
  duration_months INT DEFAULT 12,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  national_id TEXT UNIQUE NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  membership_no TEXT UNIQUE,
  membership_type_id BIGINT REFERENCES membership_types(id),
  membership_start DATE,
  membership_end DATE,
  card_status TEXT DEFAULT 'not_issued',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS applications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tracking_no TEXT UNIQUE NOT NULL,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  membership_type_id BIGINT REFERENCES membership_types(id),
  full_name TEXT NOT NULL,
  national_id TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  qualification TEXT,
  graduation_year INT,
  employer TEXT,
  governorate TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending','ai_review','under_review','needs_docs',
    'approved','rejected','paid','card_processing',
    'card_ready','delivered','cancelled'
  )),
  ai_score NUMERIC(5,2),
  ai_notes TEXT,
  reviewer_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attachments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  application_id BIGINT REFERENCES applications(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  doc_type TEXT,
  ai_verified BOOLEAN DEFAULT FALSE,
  ai_notes TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS status_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  application_id BIGINT REFERENCES applications(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  notes TEXT,
  changed_by TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  application_id BIGINT REFERENCES applications(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  payment_method TEXT,
  receipt_path TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','confirmed','rejected')),
  paid_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_apps_national_id ON applications(national_id);
CREATE INDEX IF NOT EXISTS idx_apps_phone ON applications(phone);
CREATE INDEX IF NOT EXISTS idx_apps_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_apps_tracking ON applications(tracking_no);
CREATE INDEX IF NOT EXISTS idx_apps_created ON applications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attachments_app ON attachments(application_id);
CREATE INDEX IF NOT EXISTS idx_history_app ON status_history(application_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);

-- Functions
CREATE OR REPLACE FUNCTION generate_tracking_no()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tracking_no IS NULL OR NEW.tracking_no = '' THEN
    NEW.tracking_no := 'ITS-' || TO_CHAR(NOW(), 'YYYYMM') || '-' ||
                       LPAD(FLOOR(RANDOM() * 100000)::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_tracking ON applications;
CREATE TRIGGER trg_generate_tracking
BEFORE INSERT ON applications
FOR EACH ROW EXECUTE FUNCTION generate_tracking_no();

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_apps ON applications;
CREATE TRIGGER trg_update_apps BEFORE UPDATE ON applications
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_update_members ON members;
CREATE TRIGGER trg_update_members BEFORE UPDATE ON members
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_update_users ON users;
CREATE TRIGGER trg_update_users BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE OR REPLACE FUNCTION log_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO status_history(application_id, old_status, new_status, notes, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, 'Auto logged', 'system');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_status ON applications;
CREATE TRIGGER trg_log_status AFTER UPDATE ON applications
FOR EACH ROW EXECUTE FUNCTION log_status_change();

CREATE OR REPLACE FUNCTION is_head()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'head'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Seed: Membership Types
INSERT INTO membership_types (name, code, description, fee, duration_months) VALUES
  ('طالب', 'STUDENT', 'عضوية طالب في تخصص تكنولوجيا المعلومات', 100, 12),
  ('خريج', 'GRADUATE', 'عضوية خريج جديد', 200, 12),
  ('عامل', 'WORKER', 'عضوية عامل في مجال تكنولوجيا المعلومات', 300, 12),
  ('شركة', 'COMPANY', 'عضوية شركة أو مؤسسة', 1000, 12)
ON CONFLICT (code) DO NOTHING;

-- Seed: Settings
INSERT INTO settings (key, value) VALUES
  ('site_name', 'نقابة تكنولوجيا المعلومات والبرمجيات'),
  ('site_name_en', 'IT WORKERS SYNDICATE'),
  ('site_logo_url', ''),
  ('head_name', 'م / محمود جميل'),
  ('head_title', 'النقيب العام'),
  ('contact_email', 'info@itsyndicate.eg'),
  ('contact_phone', '+20 100 000 0000'),
  ('contact_address', 'القاهرة، مصر'),
  ('default_theme', 'neon-dark'),
  ('splash_duration', '5000'),
  ('max_file_size', '5'),
  ('allow_registration', 'true'),
  ('maintenance_mode', 'false'),
  ('hero_description', 'قدّم طلب عضويتك إلكترونيًا، ارفع مستنداتك، وتابع حالة طلبك لحظة بلحظة.'),
  ('features_label', 'المميزات'),
  ('features_title', 'لماذا منصتنا؟'),
  ('features_subtitle', 'منظومة متكاملة صُمّمت خصيصًا لنقابة تكنولوجيا المعلومات'),
  ('features_cards', '[{"icon":"zap","title":"تقديم في دقائق","text":"فورم ذكي يوجهك خطوة بخطوة."},{"icon":"activity","title":"فحص تلقائي","text":"تحقق ذكي من صحة وجودة مستنداتك."},{"icon":"trending","title":"تتبع مباشر","text":"تابع حالة طلبك لحظة بلحظة."},{"icon":"shield","title":"أمان كامل","text":"تشفير البيانات وصلاحيات دقيقة."},{"icon":"palette","title":"ثيمات متعددة","text":"اختر الثيم اللي يريحك."},{"icon":"smartphone","title":"يعمل على كل الأجهزة","text":"تجربة سلسة على كل الأجهزة."}]'),
  ('about_card_enabled', 'false'),
  ('about_card_title', 'عن النقابة'),
  ('about_card_text', ''),
  ('about_card_logo', ''),
  ('types_label', 'العضويات'),
  ('types_title', 'أنواع العضوية'),
  ('types_subtitle', 'اختر النوع المناسب لك وابدأ التقديم فورًا'),
  ('steps_label', 'الخطوات'),
  ('steps_title', 'كيف تقدم؟'),
  ('steps_subtitle', '4 خطوات بسيطة تفصلك عن عضويتك'),
  ('code_card_name', 'member.js'),
  ('code_card_content', 'const member = {\n  name: "أحمد محمد",\n  type: "خريج",\n  status: "APPROVED"\n};'),
  ('code_card_status', 'LIVE'),
  ('cta_title', 'جاهز تبدأ رحلتك مع نقابتك؟'),
  ('cta_subtitle', 'سجّل عضويتك الآن واستمتع بكل المزايا'),
  ('footer_description', 'منظومة رقمية متكاملة لتقديم وإدارة عضويات النقابة.'),
  ('terms_text', 'أقر بأن جميع البيانات والمستندات المقدمة صحيحة.'),
  ('footer_text', 'نقابة تكنولوجيا المعلومات والبرمجيات — جميع الحقوق محفوظة')
ON CONFLICT (key) DO NOTHING;

-- RLS
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first
DO $$ BEGIN
  DROP POLICY IF EXISTS "settings_read" ON settings;
  DROP POLICY IF EXISTS "settings_write" ON settings;
  DROP POLICY IF EXISTS "prefs_own" ON user_preferences;
  DROP POLICY IF EXISTS "users_read_own" ON users;
  DROP POLICY IF EXISTS "users_head_write" ON users;
  DROP POLICY IF EXISTS "users_insert_self" ON users;
  DROP POLICY IF EXISTS "apps_insert_anon" ON applications;
  DROP POLICY IF EXISTS "apps_read_all" ON applications;
  DROP POLICY IF EXISTS "apps_update_staff" ON applications;
  DROP POLICY IF EXISTS "apps_delete_head" ON applications;
  DROP POLICY IF EXISTS "att_read" ON attachments;
  DROP POLICY IF EXISTS "att_insert" ON attachments;
  DROP POLICY IF EXISTS "att_update_staff" ON attachments;
  DROP POLICY IF EXISTS "history_read" ON status_history;
  DROP POLICY IF EXISTS "history_insert_auth" ON status_history;
  DROP POLICY IF EXISTS "payments_read" ON payments;
  DROP POLICY IF EXISTS "payments_insert_auth" ON payments;
  DROP POLICY IF EXISTS "types_read" ON membership_types;
  DROP POLICY IF EXISTS "types_write_head" ON membership_types;
  DROP POLICY IF EXISTS "audit_read_head" ON audit_log;
  DROP POLICY IF EXISTS "audit_insert_auth" ON audit_log;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "settings_read" ON settings FOR SELECT TO anon, authenticated USING (TRUE);
CREATE POLICY "settings_write" ON settings FOR ALL TO authenticated USING (is_head()) WITH CHECK (is_head());
CREATE POLICY "prefs_own" ON user_preferences FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_read_own" ON users FOR SELECT TO authenticated USING (auth.uid() = id OR is_head());
CREATE POLICY "users_head_write" ON users FOR ALL TO authenticated USING (is_head()) WITH CHECK (is_head());
CREATE POLICY "users_insert_self" ON users FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "apps_insert_anon" ON applications FOR INSERT TO anon, authenticated WITH CHECK (TRUE);
CREATE POLICY "apps_read_all" ON applications FOR SELECT TO anon, authenticated USING (TRUE);
CREATE POLICY "apps_update_staff" ON applications FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid()));
CREATE POLICY "apps_delete_head" ON applications FOR DELETE TO authenticated USING (is_head());
CREATE POLICY "att_read" ON attachments FOR SELECT TO anon, authenticated USING (TRUE);
CREATE POLICY "att_insert" ON attachments FOR INSERT TO anon, authenticated WITH CHECK (TRUE);
CREATE POLICY "att_update_staff" ON attachments FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid()));
CREATE POLICY "history_read" ON status_history FOR SELECT TO anon, authenticated USING (TRUE);
CREATE POLICY "history_insert_auth" ON status_history FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "payments_read" ON payments FOR SELECT TO anon, authenticated USING (TRUE);
CREATE POLICY "payments_insert_auth" ON payments FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "types_read" ON membership_types FOR SELECT TO anon, authenticated USING (TRUE);
CREATE POLICY "types_write_head" ON membership_types FOR ALL TO authenticated USING (is_head()) WITH CHECK (is_head());
CREATE POLICY "audit_read_head" ON audit_log FOR SELECT TO authenticated USING (is_head());
CREATE POLICY "audit_insert_auth" ON audit_log FOR INSERT TO authenticated WITH CHECK (TRUE);

-- Storage Buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', FALSE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('branding', 'branding', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "att_storage_upload" ON storage.objects;
  DROP POLICY IF EXISTS "att_storage_read" ON storage.objects;
  DROP POLICY IF EXISTS "att_storage_staff_update" ON storage.objects;
  DROP POLICY IF EXISTS "branding_public_read" ON storage.objects;
  DROP POLICY IF EXISTS "branding_auth_upload" ON storage.objects;
  DROP POLICY IF EXISTS "branding_auth_update" ON storage.objects;
  DROP POLICY IF EXISTS "branding_auth_delete" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "att_storage_upload" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'attachments');
CREATE POLICY "att_storage_read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'attachments');
CREATE POLICY "att_storage_staff_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'attachments' AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid()));
CREATE POLICY "branding_public_read" ON storage.objects FOR SELECT TO public USING (bucket_id = 'branding');
CREATE POLICY "branding_auth_upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'branding' AND is_head());
CREATE POLICY "branding_auth_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'branding' AND is_head());
CREATE POLICY "branding_auth_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'branding' AND is_head());
    `;

    // Execute SQL via RPC (need a helper function first)
    // نستخدم الـ service client عشان ينفذ SQL مباشر
    const { error: sqlError } = await supabase.rpc('exec_sql', { sql: SQL_SETUP });

    if (sqlError) {
      // لو الـ exec_sql مش موجود، نحاول نعمل واحد
      log('⚠️ إنشاء دالة SQL مؤقتة...', 'warn');
      
      const createExecSQL = `
        CREATE OR REPLACE FUNCTION exec_sql(sql text)
        RETURNS void
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        BEGIN
          EXECUTE sql;
        END;
        $$;
      `;
      
      // نحاول ننفذ عن طريق pg-meta endpoint
      const pgRes = await fetch(`${SUPABASE_URL}/pg/query`, {
        method: 'POST',
        headers: {
          'apikey': service_key,
          'Authorization': `Bearer ${service_key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          query: createExecSQL + '\n' + SQL_SETUP 
        })
      });

      if (!pgRes.ok) {
        const errText = await pgRes.text();
        throw new Error('فشل تنفيذ SQL: ' + errText.substring(0, 200));
      }
    }

    log('✅ تم إنشاء كل الجداول والـ Policies', 'ok');

    /* ============================================
       STEP 2: Create Admin User
       ============================================ */
    log('👤 إنشاء حساب النقيب...', 'info');

    // Check if exists
    let userId: string | null = null;

    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existing = existingUsers?.users?.find(u => u.email === admin_email);

    if (existing) {
      userId = existing.id;
      log('   المستخدم موجود — تحديث الباسورد...', 'warn');

      const { error: updateErr } = await supabase.auth.admin.updateUserById(userId, {
        password: admin_password,
        email_confirm: true,
        user_metadata: { full_name: admin_name }
      });

      if (updateErr) throw new Error('فشل تحديث المستخدم: ' + updateErr.message);
    } else {
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email: admin_email,
        password: admin_password,
        email_confirm: true,
        user_metadata: { full_name: admin_name }
      });

      if (createErr) throw new Error('فشل إنشاء المستخدم: ' + createErr.message);
      userId = newUser?.user?.id || null;
    }

    if (!userId) throw new Error('تعذّر الحصول على ID المستخدم');

    log('✅ تم إنشاء المستخدم', 'ok');

    /* ============================================
       STEP 3: Assign as Head
       ============================================ */
    log('👑 تعيين المستخدم كـ Head...', 'info');

    const { error: userErr } = await supabase
      .from('users')
      .upsert({
        id: userId,
        email: admin_email,
        full_name: admin_name,
        role: 'head'
      }, { onConflict: 'id' });

    if (userErr) throw new Error('فشل تعيين الأدمن: ' + userErr.message);

    log('✅ تم تعيين النقيب العام', 'ok');
    log('🎉 الإعداد اكتمل!', 'ok');

    return new Response(JSON.stringify({
      success: true,
      message: 'Setup completed successfully',
      user_id: userId,
      logs
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('[Setup] Error:', err);
    log('❌ ' + (err.message || 'خطأ غير معروف'), 'err');

    return new Response(JSON.stringify({
      success: false,
      error: err.message || 'خطأ غير معروف',
      logs
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
