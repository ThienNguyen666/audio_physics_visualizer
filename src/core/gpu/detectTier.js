// src/core/gpu/detectTier.js
//
// Phát hiện tier render tốt nhất mà trình duyệt/máy hiện tại hỗ trợ được.
//
//   Tier 3 = "webgpu"  → compute shader trên GPU, target 100k-300k+ hạt
//   Tier 2 = "wasm"    → Rust/WASM (rayon threads) + WebGL2, ~5k-10k hạt mượt
//   Tier 1 = "js"      → Canvas2D thuần, fallback cuối cùng
//
// Nguyên tắc: KHÔNG chỉ dựa vào feature-detect tĩnh (navigator.gpu tồn tại
// không có nghĩa là adapter/device thực sự request được — một số máy có
// navigator.gpu nhưng driver lỗi, hoặc chạy trong iframe/CI headless).
// Nên luôn thử request device thật sự trước khi quyết định tier.

export const TIERS = {
    WEBGPU: "webgpu",
    WASM: "wasm",
    JS: "js",
};

// Cache trong phiên làm việc — tránh detect lại mỗi lần component remount.
// Dùng resetTierCache() khi cần ép detect lại (vd: sau khi WebGPU init
// runtime fail và muốn thử lại ở lần load sau).
let cachedTier = null;

export async function detectWebGPU() {
    if (typeof navigator === "undefined" || !("gpu" in navigator)) return false;

    try {
        const adapter = await navigator.gpu.requestAdapter({
            powerPreference: "high-performance",
        });
        if (!adapter) return false;

        // Bước quan trọng: vài adapter "giả" (headless/CI, driver cũ) pass
        // được requestAdapter nhưng fail ngay ở requestDevice — phải thử
        // thật thì mới chắc chắn tier này chạy được.
        const device = await adapter.requestDevice();
        device.destroy?.();
        return true;
    } catch (err) {
        console.warn("[detectTier] WebGPU không khả dụng trên máy này:", err);
        return false;
    }
}

function detectWasmThreadsSupport() {
    // WASM threads (rayon/wasm-bindgen-rayon) cần SharedArrayBuffer +
    // cross-origin isolation — đã bật qua headers COOP/COEP trong
    // vite.config.js (dev) và vercel.json (production).
    return (
        typeof SharedArrayBuffer !== "undefined" &&
        typeof crossOriginIsolated !== "undefined" &&
        crossOriginIsolated === true
    );
}

export async function detectTier({ force } = {}) {
    if (force) {
        cachedTier = force;
        return cachedTier;
    }
    if (cachedTier) return cachedTier;

    const hasWebGPU = await detectWebGPU();
    if (hasWebGPU) {
        cachedTier = TIERS.WEBGPU;
        return cachedTier;
    }

    cachedTier = detectWasmThreadsSupport() ? TIERS.WASM : TIERS.JS;
    return cachedTier;
}

export function resetTierCache() {
    cachedTier = null;
}
