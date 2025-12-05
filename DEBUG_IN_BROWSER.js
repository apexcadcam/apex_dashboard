// انسخ هذا الكود في Browser Console

console.log("=".repeat(60));
console.log("Debug Custom Blocks");
console.log("=".repeat(60));

// Check if page_data exists
if (window.cur_page && cur_page.page_data) {
    console.log("\n1. page_data موجود:");
    console.log("   Keys:", Object.keys(cur_page.page_data));
    
    if (cur_page.page_data.custom_blocks) {
        console.log("\n2. custom_blocks في page_data:");
        console.log("   Type:", typeof cur_page.page_data.custom_blocks);
        console.log("   Keys:", Object.keys(cur_page.page_data.custom_blocks));
        
        if (cur_page.page_data.custom_blocks.items) {
            const items = cur_page.page_data.custom_blocks.items;
            console.log("   Items count:", items.length);
            
            if (items.length > 0) {
                console.log("\n3. أول block:");
                const first = items[0];
                console.log("   Keys:", Object.keys(first));
                console.log("   name:", first.name);
                console.log("   label:", first.label);
                console.log("   custom_block_name:", first.custom_block_name);
                console.log("   Has html:", 'html' in first);
                console.log("   Has script:", 'script' in first);
                console.log("   Has style:", 'style' in first);
                
                if ('html' in first) {
                    console.log("   HTML length:", (first.html || '').length);
                    if (first.html && first.html.length > 0) {
                        console.log("   ✅ HTML موجود!");
                    } else {
                        console.log("   ⚠️ HTML فارغ!");
                    }
                } else {
                    console.log("   ⚠️ HTML غير موجود في الـ object!");
                }
            }
        } else {
            console.log("   ⚠️ items غير موجود!");
        }
    } else {
        console.log("\n⚠️ custom_blocks غير موجود في page_data!");
    }
} else {
    console.log("⚠️ cur_page أو page_data غير موجود!");
}

console.log("=".repeat(60));






