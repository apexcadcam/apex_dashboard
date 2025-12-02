# حل مشكلة Custom HTML Blocks في Apex Dashboard

## المشكلة الأصلية
عند إضافة ساعتين تناظريتين (الصين وألمانيا) بالإضافة للساعة المصرية، ظهرت رسالة خطأ:
```
Custom HTML Block
The block can not be displayed correctly.
```

## السبب الجذري
مشكلة في Frappe Framework - الـ function `get_custom_blocks()` في ملف `frappe/desk/desktop.py` كانت ترجع فقط child table rows (تحتوي على `name` و `label`) بدون تحميل الـ Custom HTML Block documents الكاملة التي تحتوي على `html`, `script`, `style`.

## الحل المطبق

### 1. تعديل Frappe Core
تم تعديل `/home/frappe/frappe-bench/apps/frappe/frappe/desk/desktop.py`:

```python
def get_custom_blocks(self):
    all_custom_blocks = []
    if frappe.has_permission("Custom HTML Block", throw=False):
        custom_blocks = self.doc.custom_blocks

        for custom_block in custom_blocks:
            block_name = custom_block.custom_block_name
            
            if not block_name:
                continue
                
            if frappe.has_permission("Custom HTML Block", doc=block_name):
                if not self.is_custom_block_permitted(block_name):
                    continue

                # Load the full Custom HTML Block document
                try:
                    block_doc = frappe.get_cached_doc("Custom HTML Block", block_name)
                    
                    block_data = frappe._dict({
                        'name': block_doc.name,
                        'label': custom_block.label or block_doc.name,
                        'custom_block_name': block_doc.name,
                        'html': block_doc.html or '',
                        'script': block_doc.script or '',
                        'style': block_doc.style or '',
                        'private': block_doc.private or 0
                    })
                    
                    block_data.label = _(block_data.label)
                    all_custom_blocks.append(block_data)
                    
                except Exception:
                    continue

    return all_custom_blocks
```

### 2. إصلاح Workspace
- تم تغيير `customHTMLBlockName` إلى `custom_block_name` في الـ `content` field
- تم ملء جدول `custom_blocks` child table بشكل صحيح

### 3. حذف الساعات الإضافية
تم حذف:
- Dashboard Clock China
- Dashboard Clock Germany

الآن الـ Workspace يحتوي على 5 blocks فقط:
- Dashboard Clock (مصر)
- Dashboard Holidays
- Dashboard Analog Clock
- Dashboard Notes
- Dashboard Profile Banner

## التحقق من الحل

لاختبار أن الـ API يعمل بشكل صحيح:

```python
import frappe
frappe.init(site='site1')
frappe.connect()

from frappe.desk.desktop import get_desktop_page
workspace = frappe.get_doc("Workspace", "Apex Dashboards Hub")
result = get_desktop_page(workspace.as_json())

items = result.get('custom_blocks', {}).get('items', [])
print(f"Blocks: {len(items)}")

if items:
    first = items[0]
    print(f"HTML length: {len(first.get('html', ''))}")
    print(f"Script length: {len(first.get('script', ''))}")
```

## خطوات إعادة التحميل في المتصفح

إذا لم تظهر الـ blocks بعد التعديلات:

1. **مسح كاش المتصفح**:
   - اضغط `Ctrl + Shift + Delete`
   - اختر "Cached images and files"
   - اضغط "Clear data"

2. **أو استخدم Incognito**:
   - اضغط `Ctrl + Shift + N`
   - اذهب إلى `http://localhost:8000`

3. **أو Disable Cache**:
   - في DevTools، اضغط `F1`
   - فعّل "Disable cache (while DevTools is open)"
   - أعد تحميل الصفحة

## ملاحظات

- التعديل على Frappe core سيتم فقده عند تحديث Frappe
- الحل الدائم: إنشاء Pull Request لـ Frappe Framework لإصلاح هذا الـ bug
- أو استخدام monkey patch في `apex_dashboard/__init__.py` (موجود حالياً)

