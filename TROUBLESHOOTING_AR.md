# استكشاف الأخطاء - Apex Dashboard

## المشاكل الشائعة وحلولها

### المشكلة: لا تظهر أسعار الصرف
**الحل:**
1. تأكد من إدخال OpenExchangeRates App ID في **Currency Settings**
2. تحقق من الاتصال بالإنترنت
3. سيستخدم النظام أسعار ERPNext تلقائياً كبديل

---

### المشكلة: لا تظهر الحسابات في لوحة السيولة
**الحل:**
1. تأكد من إضافة الحسابات في **Liquidity Dashboard Config**
2. تحقق من أن الحسابات لها أرصدة (الأرصدة الصفرية لا تظهر)
3. تأكد من أن الحسابات موجودة في دليل الحسابات

---

### المشكلة: لا يمكن التمييز بين الحسابات المتشابهة
**الحل:**
- استخدم حقل **Dashboard Label** في نموذج الحساب لإضافة أسماء مختصرة

---

### المشكلة: Workspace فارغ (لا تظهر الاختصارات)
**السبب:**
- الـ Workspace يحتاج إلى حقلين: `shortcuts` (الاختصارات) و `content` (طريقة العرض)
- إذا كان `shortcuts` ممتلئ لكن `content` فارغ، ستظهر الصفحة فارغة

**الحل:**

**الطريقة الأولى (عبر الواجهة):**
1. افتح الـ Workspace المطلوب من قائمة **Workspace**
2. اضغط **Edit**
3. اذهب إلى تبويب **Shortcuts** وتأكد من وجود الاختصارات
4. ارجع إلى تبويب **Details**
5. ابحث عن حقل **Content** (في الأسفل)
6. الصق هذا الكود:

```json
[
  {
    "id": "header1",
    "type": "header",
    "data": {
      "text": "<span class=\"h4\">اسم الـ Workspace</span>",
      "col": 12
    }
  },
  {
    "id": "shortcut1",
    "type": "shortcut",
    "data": {
      "shortcut_name": "اسم الاختصار الأول",
      "col": 3
    }
  },
  {
    "id": "shortcut2",
    "type": "shortcut",
    "data": {
      "shortcut_name": "اسم الاختصار الثاني",
      "col": 3
    }
  }
]
```

7. عدّل الأسماء لتطابق الاختصارات في جدول Shortcuts
8. احفظ وامسح الـ cache: `bench --site site1 clear-cache`

**الطريقة الثانية (عبر Console):**
```python
import frappe
import json

ws = frappe.get_doc("Workspace", "اسم الـ Workspace")
content = [
    {"id": "header1", "type": "header", "data": {"text": '<span class="h4">العنوان</span>', "col": 12}},
    {"id": "shortcut1", "type": "shortcut", "data": {"shortcut_name": "اسم الاختصار", "col": 3}}
]
ws.content = json.dumps(content)
ws.save()
frappe.db.commit()
```

**ملاحظات:**
- `shortcut_name` يجب أن يطابق **تماماً** الـ Label في جدول Shortcuts
- `col` يحدد العرض: 3 = ربع الشاشة، 6 = نصف، 12 = كامل

---

### المشكلة: تعارض أسماء Workspace و DocType
**السبب:**
- إذا كان اسم Workspace مطابق لاسم DocType، قد يحدث تعارض في الـ routing

**الحل:**
- أعد تسمية الـ Workspace ليكون مختلف عن الـ DocType
- مثال: غيّر "Apex Dashboard" إلى "Apex Dashboards Hub"

---

## الدعم الفني

للمساعدة أو الإبلاغ عن مشاكل:
- راجع ملف `README_AR.md` لدليل الاستخدام
- تحقق من سجلات النظام في **Error Log**
