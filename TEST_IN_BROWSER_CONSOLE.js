// انسخ هذا الكود والصقه في Browser Console (F12)
// ثم اضغط Enter

console.log("🔍 Testing Custom HTML Blocks API...");

// Get current workspace
frappe.call({
    method: 'frappe.desk.desktop.get_desktop_page',
    args: {
        page: JSON.stringify(cur_page.page)
    },
    callback: function(r) {
        console.log("📦 API Response:", r);
        
        if (r.message && r.message.custom_blocks) {
            const blocks = r.message.custom_blocks.items || [];
            console.log(`✅ Found ${blocks.length} custom blocks`);
            
            if (blocks.length > 0) {
                const first = blocks[0];
                console.log("\n📋 First block:");
                console.log("  - name:", first.name);
                console.log("  - custom_block_name:", first.custom_block_name);
                console.log("  - Has html:", !!first.html);
                console.log("  - Has script:", !!first.script);
                console.log("  - Has style:", !!first.style);
                
                if (first.html) {
                    console.log("  - HTML length:", first.html.length);
                    console.log("  ✅ HTML موجود!");
                } else {
                    console.log("  ⚠️ HTML مفقود!");
                }
                
                if (first.script) {
                    console.log("  - Script length:", first.script.length);
                    console.log("  ✅ Script موجود!");
                } else {
                    console.log("  ⚠️ Script مفقود!");
                }
            } else {
                console.log("⚠️ No blocks returned!");
            }
        } else {
            console.log("❌ No custom_blocks in response!");
            console.log("Response:", r.message);
        }
    },
    error: function(err) {
        console.error("❌ API Error:", err);
    }
});

