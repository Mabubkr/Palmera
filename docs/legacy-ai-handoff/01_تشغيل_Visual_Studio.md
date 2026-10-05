# تشغيل المشروع مع Visual Studio ووكيل الذكاء الاصطناعي

## أي برنامج تستخدم؟

هذا المشروع **JavaScript / PWA ثابت** وليس حل .NET.

- الأنسب: **Visual Studio Code** + GitHub Copilot (وضع Agent).
- Visual Studio 2022 يعمل أيضاً بفتح المجلد، لكن VS Code أخف لهذا النوع من الملفات.

إذا كان عندك Visual Studio الكامل: File → Open → Folder → اختر مجلد `palm-system`.

## الإضافات المطلوبة (Extensions)

### في VS Code / Visual Studio Code
ثبّت بالترتيب:

1. GitHub Copilot
2. GitHub Copilot Chat
3. Live Server (Ritwick Dey) — أو استخدم الأمر أدناه
4. ESLint (اختياري)
5. EditorConfig (اختياري)

من الطرفية داخل VS Code:

```
code --install-extension GitHub.copilot
code --install-extension GitHub.copilot-chat
code --install-extension ritwickdey.LiveServer
```

فعّل Copilot ثم افتح الشات واختر **Agent** وليس Ask فقط.

### في Visual Studio 2022
1. Visual Studio 2022 الإصدار 17.10 أو أحدث.
2. Extensions → Manage Extensions → GitHub Copilot.
3. سجّل الدخول بحساب GitHub المفعّل عليه Copilot.
4. View → GitHub Copilot Chat → وضع Agent إن ظهر.

## فتح المشروع

```bash
cd المسار/الذي/فيه/palm-system
```

في VS Code:

```bash
code .
```

أو: File → Open Folder → `palm-system`.

لا تفتح المجلد الأب إن كان فيه ملفات أخرى؛ اجعل جذر العمل هو `palm-system` حتى يقرأ الوكيل `.github/copilot-instructions.md`.

## تشغيل محلي (مهم للـ PWA والكاش)

من مجلد `palm-system`:

```bash
python3 -m http.server 8080
```

أو PowerShell:

```powershell
python -m http.server 8080
```

ثم المتصفح: http://localhost:8080

حسابات التجربة، كلمة المرور كلها `1234`:

| الدخول | الدور |
|---|---|
| admin | إدارة الشركة |
| engineer | مهندس مشرف |
| worker | عامل ميداني (قطعتا 12A و 12B) |
| investor | مستثمر (قطعة 12A) |
| nursery | مدير المشتل |

## أوامر تحقق بعد كل تعديل

```bash
node --check js/app.js
node --check js/store.js
```

إذا غيّرت `app.js` أو `store.js` أو `css/app.css` زد رقم الكاش في `sw.js` مثلاً من `palmtrace-v33` إلى `palmtrace-v34`.

لمسح بيانات التجربة من المتصفح: Application → Local Storage → احذف `palmtrace_v5`  
أو من داخل النظام (حساب admin): إعادة ضبط البيانات التجريبية.

## ماذا تلصق للوكيل؟

1. الرسالة في `docs/00_الصق_هذا_البرومبت_أولا.md`
2. عند طلب ميزة جديدة الصق أيضاً المقطع المناسب من `docs/03_قواعد_التكويد_والمنطق.md`
3. لا تلصق `app.js` كاملاً في الشات؛ الوكيل يقرأ الملفات من المجلد.
