// src/components/CanvasEngine/EngineSwitcher.jsx
//
// Chọn renderer tốt nhất máy hỗ trợ được, và QUAN TRỌNG: tự rớt tier khi
// WebGPU init fail ngay lúc runtime (không chỉ dựa vào feature-detect tĩnh
// lúc mount — có driver lỗi lặt vặt chỉ lộ ra khi thực sự tạo device/pipeline).
//
// Luồng: detect tier lúc mount → nếu "webgpu" mà PhysicsCanvasWebGPU báo
// onInitFailed → tự động chuyển xuống PhysicsCanvas (WASM/WebGL2) không cần
// user reload trang.

import React, { useEffect, useState, useCallback } from "react";
import { PhysicsCanvasWebGPU } from "./PhysicsCanvasWebGPU";
import { PhysicsCanvas } from "./PhysicsCanvas";
import { detectTier, TIERS, resetTierCache } from "../../core/gpu/detectTier";

export const EngineSwitcher = ({ onTierChange, ...props }) => {
    const [tier, setTier] = useState(null); // null = đang detect

    useEffect(() => {
        let mounted = true;
        detectTier().then((t) => {
            if (mounted) setTier(t);
        });
        return () => { mounted = false; };
    }, []);

    useEffect(() => {
        if (tier) onTierChange?.(tier);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tier]);

    const handleWebGPUFail = useCallback(() => {
        resetTierCache();
        setTier(TIERS.WASM);
    }, []);

    if (tier === null) {
        return (
            <div style={{
                width: "100vw", height: "100vh", display: "flex",
                alignItems: "center", justifyContent: "center",
                background: "#000", color: "#00ffcc", fontFamily: "monospace",
                fontSize: "14px", letterSpacing: "1px",
            }}>
                Đang dò cấu hình máy...
            </div>
        );
    }

    if (tier === TIERS.WEBGPU) {
        return <PhysicsCanvasWebGPU {...props} onInitFailed={handleWebGPUFail} />;
    }

    // Tier WASM hiện tại — cũng đóng vai fallback chung cho tới khi có bản
    // Canvas2D thuần tách riêng ở nhánh engine/js-core.
    return <PhysicsCanvas {...props} />;
};
