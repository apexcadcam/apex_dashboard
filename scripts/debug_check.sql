SELECT 
    sii.item_name,
    si.currency,
    sii.amount,
    sii.incoming_rate
FROM `tabSales Invoice Item` sii
JOIN `tabSales Invoice` si ON sii.parent = si.name
WHERE si.docstatus = 1 
    AND sii.item_name LIKE '%lmes%'
LIMIT 2;
