# نقابة تكنولوجيا المعلومات والبرمجيات
## IT Workers Syndicate — Digital Membership System

منظومة رقمية متكاملة لإدارة عضويات نقابة تكنولوجيا المعلومات والبرمجيات — تشمل تقديم العضوية، التتبع، الاعتماد، التقارير المالية، إدارة اللجان والفروع.

---

## 📋 نظرة عامة

| العنصر | التفاصيل |
|---|---|
| **النوع** | نظام إدارة عضويات رقمي |
| **الواجهة** | Vanilla JavaScript + HTML5 + CSS3 |
| **قاعدة البيانات** | Supabase (PostgreSQL) |
| **الاستضافة** | GitHub Pages (مجاني) |
| **الذكاء الاصطناعي** | Tesseract.js (فحص مرفقات) |
| **المصادقة** | Supabase Auth |
| **Realtime** | Supabase Realtime |
| **التخزين** | Supabase Storage |

---

## 🏗️ البنية العامة
its-syndicate/
│
├── index.html # شاشة الافتتاحية
├── home.html # الصفحة الرئيسية
├── login.html # تسجيل الدخول
├── apply.html # فورم التقديم
├── receipt.html # الإيصال
├── track.html # تتبع الطلب
│
├── dashboard.html # لوحة لجنة العضوية
├── admin.html # لوحة النقيب العام
├── members.html # إدارة الأعضاء
├── revenue.html # التقارير المالية
├── subscriptions.html # إدارة الاشتراكات
├── head-approval.html # اعتماد النقيب
│
├── branches.html # لوحة مدير الفروع
├── governorate.html # لوحة المحافظة
├── social-committee.html # اللجنة الاجتماعية
├── public-relations.html # العلاقات العامة
├── committees-manager.html # مدير اللجان
│
├── css/
│ ├── themes.css # 8 ثيمات
│ └── style.css # الستايل العام
│
└── js/
├── supabase-config.js # تهيئة Supabase + Helpers
├── theme-manager.js # إدارة الثيمات
├── settings.js # تحميل الإعدادات
├── realtime.js # إدارة Realtime
├── security.js # الحماية
│
├── apply.js # منطق التقديم
├── track.js # منطق التتبع
├── dashboard.js # منطق لوحة اللجنة
├── admin.js # منطق لوحة النقيب
├── members.js # منطق الأعضاء
├── revenue.js # منطق التقارير المالية
├── subscriptions.js # منطق الاشتراكات
├── head-approval.js # منطق الاعتماد
│
├── branches.js # منطق الفروع
├── governorate.js # منطق المحافظة
├── social-committee.js # منطق اللجنة الاجتماعية
├── public-relations.js # منطق العلاقات العامة
└── committees-manager.js # منطق مدير اللجان

text

**الإجمالي:** 38 ملف

---

## 🎯 الميزات الرئيسية

### 1. منظومة تقديم العضوية
- فورم متعدد المراحل
- رفع المرفقات (صور + PDF)
- كاميرا مباشرة للتصوير
- فحص تلقائي بـ AI (Tesseract.js)
- حساب السن تلقائيًا
- رعاية صحية اختيارية
- مسودة تلقائية

### 2. نظام التتبع
- 11 مرحلة من التقديم للاستلام
- Timeline تفاعلي
- QR Code
- رفع الأوراق الناقصة
- رفع إيصال الدفع
- تحميل الكارنية

### 3. لوحات التحكم
- **لجنة العضوية** — مراجعة + تحديث + دفع
- **النقيب العام** — إعدادات + مستخدمين + أنواع + شعب
- **اعتماد النقيب** — رقم عضوية + رفع كارنية

### 4. التقارير
- الإيرادات
- المصروفات
- الصافي
- تقرير المحافظات
- تقرير التصنيفات

### 5. الإدارة
- إدارة الأعضاء
- إدارة الاشتراكات
- تجديد فردي/جماعي
- تحويل الباقة

### 6. اللجان والفروع
- **اللجنة الاجتماعية** — الأعضاء + الرعاية
- **العلاقات العامة** — بيانات التواصل
- **مدير اللجان** — كل اللجان (بدون مالية)
- **مدير الفروع** — إشراف
- **المحافظة** — أعضاء محافظته فقط

---

## 👥 الأدوار الـ 13

| # | الدور | المسمّى العربي | الصلاحيات |
|---|---|---|---|
| 1 | `head` | النقيب العام | كل الصلاحيات |
| 2 | `vice_president` | نائب رئيس النقابة | كل الصلاحيات |
| 3 | `deputy` | الوكيل | كل الصلاحيات |
| 4 | `committee` | لجنة العضوية | العضويات + الأعضاء + الرعاية + المدفوعات |
| 5 | `governorate_head` | نقيب محافظة | محافظته فقط |
| 6 | `governorate_board` | مجلس محافظة | محافظته فقط (بدون اعتماد) |
| 7 | `branches_manager` | مدير الفروع | كل الفروع (إشراف) |
| 8 | `social_committee_head` | رئيس اللجنة الاجتماعية | الأعضاء + الرعاية الصحية |
| 9 | `social_committee_vice` | نائب اللجنة الاجتماعية | نفس الصلاحيات |
| 10 | `public_relations_head` | رئيس العلاقات العامة | بيانات الأعضاء للتواصل |
| 11 | `public_relations_vice` | نائب العلاقات العامة | نفس الصلاحيات |
| 12 | `committees_manager_head` | مدير اللجان | كل اللجان (بدون إيرادات) |
| 13 | `committees_manager_vice` | نائب مدير اللجان | نفس الصلاحيات |

### الأدوار اللي محتاجة محافظة
- `governorate_head` ✅
- `governorate_board` ✅

### باقي الأدوار
- `position` (صفة) — نص حر لكل مستخدم

---

## 🔄 فلو الطلب الكامل
العضو يملأ الفورم
↓

فحص AI للمرفقات
↓

إرسال → status: pending
↓

فحص AI تلقائي → status: ai_review
↓

لجنة العضوية تراجع → status: under_review
↓

موافقة مبدئية → status: approved
↓

بانتظار الدفع → status: awaiting_payment
↓

العضو يدفع + يرفع إيصال → status: payment_under_review
↓

تأكيد الدفع → status: paid
↓

اعتماد رقم العضوية → status: awaiting_membership_no → membership_no_assigned
↓

رفع صورة الكارنية → status: card_ready
↓

العضو يستلم → status: delivered

text

---

## 🎨 الثيمات (8)

| # | الاسم | الألوان | النوع |
|---|---|---|---|
| 1 | Neon Dark | سماوي + بنفسجي | داكن |
| 2 | Neon Light | أزرق + بنفسجي | فاتح |
| 3 | Cyberpunk | ماجنتا + أصفر | داكن |
| 4 | Emerald | أخضر + ذهبي | داكن |
| 5 | Royal | بنفسجي + سماوي | داكن |
| 6 | Patriot Red | أحمر + أسود | داكن |
| 7 | Tech Cairo | أحمر + ذهبي | داكن |
| 8 | Modern Minimal | أحمر + أسود | فاتح |

---

## 🗄️ قاعدة البيانات

### الجداول (21)

| الجدول | الوظيفة |
|---|---|
| `users` | المستخدمون (13 دور) |
| `settings` | الإعدادات (55+) |
| `governorates` | المحافظات |
| `governorate_committees` | مجالس المحافظات |
| `branches` | الشعب |
| `membership_types` | أنواع العضوية |
| `members` | الأعضاء |
| `applications` | الطلبات |
| `attachments` | المرفقات |
| `status_history` | سجل الحالات |
| `payments` | المدفوعات |
| `membership_subscriptions` | الاشتراكات |
| `expenses` | المصروفات |
| `expense_categories` | تصنيفات المصروفات |
| `audit_log` | سجل التدقيق |
| `user_actions` | سجل الإجراءات |
| `user_sessions` | جلسات المستخدمين |
| `user_preferences` | تفضيلات المستخدم |
| `health_care_members` | أعضاء الرعاية الصحية |
| `member_payment_receipts` | إيصالات الدفع |
| `tracking_counters` | عدّادات التتبع |

### Storage Buckets (4)
- `attachments` — المرفقات العامة
- `branding` — اللوجو
- `cards` — صور الكارنيهات
- `avatars` — صور المستخدمين

### RLS Policies (22 + 5 محدّثة)

### Functions (13)
- `generate_tracking_no()`
- `update_timestamp()`
- `log_status_change()`
- `is_head()`
- `is_staff()`
- `is_admin()`
- `is_head_or_vp()`
- `is_branches_manager()`
- `is_social_committee()`
- `is_public_relations()`
- `is_committees_manager()`
- `get_user_role()`
- `get_user_governorate()`

### Triggers (5)
- `trg_generate_tracking` — توليد رقم التتبع
- `trg_update_apps` — تحديث `updated_at`
- `trg_update_members` — تحديث `updated_at`
- `trg_update_users` — تحديث `updated_at`
- `trg_log_status` — تسجيل تغيير الحالة

---

## 🚀 التشغيل

### 1. المتطلبات
- متصفح حديث (Chrome / Edge / Firefox / Safari)
- اتصال إنترنت
- حساب Supabase

### 2. الإعداد

#### أ) Supabase
1. اعمل مشروع جديد على [supabase.com](https://supabase.com)
2. من SQL Editor، نفّذ `setup.sql` (لو موجود) أو الإضافات يدويًا
3. من Storage، اعمل 4 Buckets:
   - `attachments` (Private)
   - `branding` (Public)
   - `cards` (Public)
   - `avatars` (Public)
4. من Authentication، فعّل Email Provider
5. أنشئ أول مستخدم بدور `head`

#### ب) الملفات
1. حمّل كل الملفات الـ 38 في نفس البنية
2. افتح `js/supabase-config.js` وعدّل:
   ```js
   const SUPABASE_URL = 'YOUR_URL';
   const SUPABASE_KEY = 'YOUR_ANON_KEY';
ارفع الملفات على GitHub

فعّل GitHub Pages من Settings

3. الدخول الأول
افتح login.html

سجّل الدخول بإيميل النقيب

هيتم تحويلك لـ admin.html

من هناك:

أضف المستخدمين

أضف الأنواع والشعب

أضف المحافظات

ارفع اللوجو

عدّل الإعدادات

🔐 الحماية
في js/security.js:
منع Right Click (في الصفحات العامة)

منع F12 + Ctrl+Shift+I/J/C/K

منع Ctrl+U + Ctrl+S

منع Copy/Cut (مع استثناء الـ Inputs)

منع Drag للصور

كشف DevTools (Debugger + Size)

Console Warning

حماية الحقول الحساسة

منع Iframe Embedding

في قاعدة البيانات:
RLS على كل الجداول

دوال SECURITY DEFINER

Policies دقيقة حسب الدور

Audit Log كامل

📱 Realtime
الجداول المفعّلة:
membership_types

applications

attachments

status_history

payments

settings

members

user_preferences

branches

governorates

users

membership_subscriptions

الميزات:
watch(table, callback) — مراقبة جدول

watchRow(table, id, callback) — مراقبة صف

watchMany(tables, callback) — مراقبة عدة

watchManyAndReload(tables, fn) — مراقبة + إعادة تحميل

sendBroadcast(type, data) — رسائل بين التابات

💾 Backup
من لوحة النقيب (admin.html):

زر "نسخة احتياطية"

يصدر ملف JSON فيه:

Settings

Membership Types

Branches

Users

Applications

🧪 الاختبار
اختبار سريع:
افتح index.html → شاشة افتتاحية 5 ثواني

home.html → الصفحة الرئيسية + أنواع العضوية

apply.html → جرب تملأ الفورم

track.html → جرب تتبع برقم التتبع

login.html → دخول كـ head

admin.html → جرب الإعدادات

dashboard.html → جرب تحديث حالة

members.html → جرب تجديد عضو

revenue.html → جرب إضافة مصروف

اختبار Realtime:
افتح home.html في تاب

افتح Supabase → Table Editor → settings

عدّل site_name

التاب الأول هيتحدث تلقائيًا

📝 ملاحظات مهمة
1. الحدود المجانية لـ Supabase
قاعدة بيانات: 500 MB

تخزين: 1 GB

Bandwidth: 5 GB/شهر

Edge Functions: 500,000 استدعاء/شهر

مستخدمين نشطين: 50,000/شهر

2. المشروع المجاني بيتوقف مؤقتًا
بعد 7 أيام من عدم النشاط

الحل: افتح Dashboard كل فترة

3. عند الحاجة لتوسيع
نقل قاعدة البيانات لـ Neon أو Turso

نقل الملفات لـ Cloudflare R2 أو Oracle

استخدام Edge Functions للـ AI

🛠️ التطوير المستقبلي
ميزات مقترحة:
□ تطبيق موبايل (PWA)
□ إشعارات SMS / WhatsApp
□ بوابة دفع إلكتروني (Paymob)
□ API للتحقق من العضوية
□ نظام تذاكر/شكاوى
□ Events + Training
□ Job Board
□ Chatbot للدعم
□ تصدير شهادات عضوية PDF
□ نظام النقاط والمكافآت
📞 الدعم
للاستفسارات التقنية:

راجع الشات اللي فيه الملفات

تأكد من الـ Console لأي أخطاء

تحقق من Supabase Logs

📄 الترخيص
هذا المشروع خاص بنقابة تكنولوجيا المعلومات والبرمجيات — جميع الحقوق محفوظة.

✅ قائمة التحقق النهائية
☑ 21 جدول
☑ 13 دور
☑ 13 دالة
☑ 5 Triggers
☑ 22+ Policy
☑ 4 Storage Buckets
☑ Realtime على 12 جدول
☑ 55+ إعداد
☑ 8 ثيمات
☑ 38 ملف
☑ Auth + Roles
☑ RLS كامل
☑ Audit Log
☑ Security Module
☑ AI (Tesseract)
☑ Camera
☑ QR Codes
☑ Realtime
☑ Backup
آخر تحديث: 2026
الإصدار: 3.0.0
الحالة: مكتمل ✅

text

---

## 📌 ملاحظات على الملف

### ✅ اللي فيه:

- **نظرة عامة شاملة** عن المشروع
- **البنية الكاملة** لكل الملفات
- **الميزات الرئيسية** (6 أقسام)
- **الأدوار الـ 13** بالتفصيل
- **فلو الطلب الكامل** (12 مرحلة)
- **8 ثيمات** بالمواصفات
- **قاعدة البيانات:**
  - 21 جدول
  - 4 Buckets
  - 22+ Policy
  - 13 دالة
  - 5 Triggers
- **التشغيل** خطوة بخطوة
- **الحماية** (Security + RLS)
- **Realtime** والأوامر المتاحة
- **Backup** من لوحة النقيب
- **الاختبار** خطوات عملية
- **ملاحظات الحدود المجانية**
- **التطوير المستقبلي** (10 ميزات)
- **قائمة التحقق النهائية**

---

## 🎉 مبروك يا ريس!

**المشروع كامل 100% — 38 ملف من 38 ✅**

### ملخص المشروع النهائي:

| العنصر | العدد |
|---|---|
| **الملفات** | 38 |
| **صفحات HTML** | 17 |
| **ملفات JS** | 18 |
| **ملفات CSS** | 2 |
| **الجداول** | 21 |
| **الأدوار** | 13 |
| **الدوال** | 13 |
| **Triggers** | 5 |
| **Policies** | 22+ |
| **Storage Buckets** | 4 |
| **الثيمات** | 8 |
| **الإعدادات** | 55+ |
| **المراحل** | 12 |

### المميزات:

✅ منظومة تقديم كاملة
✅ فحص AI بـ Tesseract
✅ كاميرا مباشرة
✅ نظام تتبع QR
✅ 13 دور مختلف
✅ Real-Time Sync
✅ 8 ثيمات
✅ Audit Log شامل
✅ Security Layer
✅ Backup System
✅ Export CSV
✅ Print Styles

---

**بالتوفيق يا ريس، المشروع جاهز للاستخدام! 💪**

لو احتجت أي حاجة تانية، أنا معاك.
