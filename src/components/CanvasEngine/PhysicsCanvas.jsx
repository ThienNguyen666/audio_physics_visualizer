import React, { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import init, { Universe, initThreadPool } from "../../../physics-core/pkg/physics_core.js";

// Texture hạt tròn: lõi đặc sáng, mờ dần ra ngoài (giả lập shadowBlur của Canvas 2D gốc)
const createParticleTexture = () => {
    const size   = 64;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    const r   = size / 2;
    const g   = ctx.createRadialGradient(r, r, 0, r, r, r);

    g.addColorStop(0,   "rgba(255,255,255,1)");
    g.addColorStop(0.15, "rgba(255,255,255,0.8)");
    g.addColorStop(0.4, "rgba(255,255,255,0.15)");
    g.addColorStop(1,   "rgba(255,255,255,0)");

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
};

export const PhysicsCanvas = ({ analyzerRef, isDebugMode, particleCount, theme, isNeonEnabled }) => {
    const containerRef  = useRef(null);
    const canvas2DRef   = useRef(null); // Overlay: shockwave rings + debug text

    const universeRef   = useRef(null);
    const wasmMemRef    = useRef(null);
    const requestRef    = useRef(null);

    // Race condition guard: slider thay đổi trước khi WASM init xong
    const wasmReadyRef    = useRef(false);
    const pendingCountRef = useRef(null);

    // Three.js
    const sceneRef      = useRef(null);
    const cameraRef     = useRef(null);
    const rendererRef   = useRef(null);
    const geometryRef   = useRef(null);
    const materialRef   = useRef(null);
    const bgMaterialRef = useRef(null);
    const bgMeshRef     = useRef(null);

    // FPS counter
    const fpsRef          = useRef(0);
    const lastFpsRef      = useRef(0);
    const frameCountRef   = useRef(0);

    // Neon flag — ref để tránh re-create renderLoop callback
    const neonRef = useRef(isNeonEnabled);
    useEffect(() => { neonRef.current = isNeonEnabled; }, [isNeonEnabled]);

    // Mouse state — chỉ dùng để pass vào Universe.tick(), không quản lý shockwave ở JS
    const mouseRef = useRef({ x: 0, y: 0, isActive: false });

    // =============================================
    // 1. KHỞI TẠO THREE.JS + WASM
    // =============================================
    useEffect(() => {
        let mounted = true;

        (async () => {
            const wasm = await init();
            if (!mounted) return;
            await initThreadPool(navigator.hardwareConcurrency);
            
            wasmMemRef.current = wasm.memory;
            if (universeRef.current) universeRef.current.free();

            const W = window.innerWidth  || 1000;
            const H = window.innerHeight || 1000;

            // Áp dụng count đã pending nếu slider thay đổi trước init
            const initCount = pendingCountRef.current ?? particleCount;
            pendingCountRef.current = null;
            universeRef.current = Universe.new(W, H, initCount);
            wasmReadyRef.current = true;

            // --- Three.js scene ---
            const scene    = new THREE.Scene();
            sceneRef.current = scene;

            // OrthographicCamera: top=0, bottom=H → Y hướng xuống, khớp Canvas 2D
            const camera = new THREE.OrthographicCamera(0, W, 0, H, -100, 100);
            cameraRef.current = camera;

            const renderer = new THREE.WebGLRenderer({
                antialias: false,
                powerPreference: "high-performance",
            });
            renderer.setSize(W, H);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap 2x để tiết kiệm GPU
            renderer.autoClear = false; // Tắt: tự quản lý motion trail
            containerRef.current.appendChild(renderer.domElement);
            rendererRef.current = renderer;

            // Background layer — giả lập motion trail (ctx.fillRect rgba(0,0,0,0.08))
            const bgGeo = new THREE.PlaneGeometry(W, H);
            const bgMat = new THREE.MeshBasicMaterial({
                color: 0x000000,
                transparent: true,
                opacity: 0.08, // Khớp với ctx.fillStyle rgba(0,0,0,0.08) của Canvas gốc
                depthWrite: false,
            });
            bgMaterialRef.current = bgMat;
            const bgMesh = new THREE.Mesh(bgGeo, bgMat);
            bgMesh.position.set(W / 2, H / 2, -10);
            bgMesh.renderOrder = 0;
            scene.add(bgMesh);
            bgMeshRef.current = bgMesh;

            // Particle points
            const geo = new THREE.BufferGeometry();
            geometryRef.current = geo;
            const mat = new THREE.PointsMaterial({
                map:         createParticleTexture(),
                size:        8,
                transparent: true,
                opacity:     0.6,
                depthWrite:  false,
                blending:    THREE.AdditiveBlending,
                sizeAttenuation: false, // Particle size không thay đổi theo depth (2D ortho)
            });
            materialRef.current = mat;
            const points = new THREE.Points(geo, mat);
            points.renderOrder = 1;
            scene.add(points);

            // 2D canvas overlay
            if (canvas2DRef.current) {
                canvas2DRef.current.width  = W;
                canvas2DRef.current.height = H;
            }
        })();

        return () => {
            mounted = false;
            wasmReadyRef.current = false;
            universeRef.current?.free();
            universeRef.current = null;
            if (rendererRef.current) {
                rendererRef.current.dispose();
                containerRef.current?.removeChild(rendererRef.current.domElement);
            }
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // =============================================
    // 2. PARTICLE COUNT — xử lý race condition
    // =============================================
    useEffect(() => {
        if (wasmReadyRef.current && universeRef.current) {
            universeRef.current.set_particle_count(particleCount);
        } else {
            // WASM chưa sẵn sàng → lưu pending, apply khi init xong
            pendingCountRef.current = particleCount;
        }
    }, [particleCount]);

    // =============================================
    // 3. RESIZE
    // =============================================
    useEffect(() => {
        const onResize = () => {
            const W = window.innerWidth;
            const H = window.innerHeight;

            universeRef.current?.resize_canvas(W, H);

            if (cameraRef.current) {
                cameraRef.current.right  = W;
                cameraRef.current.bottom = H;
                cameraRef.current.updateProjectionMatrix();
            }
            rendererRef.current?.setSize(W, H);

            if (bgMeshRef.current) {
                bgMeshRef.current.geometry.dispose();
                bgMeshRef.current.geometry = new THREE.PlaneGeometry(W, H);
                bgMeshRef.current.position.set(W / 2, H / 2, -10);
            }

            if (canvas2DRef.current) {
                canvas2DRef.current.width  = W;
                canvas2DRef.current.height = H;
            }
        };
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    // =============================================
    // 4. GAME LOOP CHÍNH
    // =============================================
    const renderLoop = useCallback((timestamp) => {
        if (!universeRef.current || !wasmMemRef.current || !rendererRef.current) {
            requestRef.current = requestAnimationFrame(renderLoop);
            return;
        }

        // FPS counter (cập nhật mỗi 500ms để tránh số nhảy loạn)
        frameCountRef.current++;
        if (!lastFpsRef.current) lastFpsRef.current = timestamp;
        if (timestamp - lastFpsRef.current >= 500) {
            fpsRef.current    = Math.round(frameCountRef.current * 1000 / (timestamp - lastFpsRef.current));
            frameCountRef.current = 0;
            lastFpsRef.current    = timestamp;
        }

        // --- Audio data ---
        let audioData = { bass: 0, mid: 0, treble: 0 };
        if (analyzerRef.current) audioData = analyzerRef.current.update();
        const { bass, mid, treble } = audioData;

        // --- Background glow (HSLA theo theme — khớp 100% với PhysicsCanvas.jsx gốc) ---
        if (bgMaterialRef.current) {
            let bgHue = 0;
            if      (theme === 'cyberpunk') bgHue = 280;
            else if (theme === 'matrix')    bgHue = 120;
            else if (theme === 'volcanic')  bgHue = 0;
            else if (theme === 'ocean')     bgHue = 220;
            // JS gốc: hsla(bgHue, 50%, bass*15%, 0.2) — chỉ màu thay đổi, opacity giữ nguyên 0.08
            bgMaterialRef.current.color.setHSL(bgHue / 360, 0.5, (bass * 15) / 100);
        }

        // --- Physics tick (Rust/WASM) ---
        universeRef.current.tick(
            bass, mid, treble,
            mouseRef.current.x, mouseRef.current.y, mouseRef.current.isActive,
        );

        // --- Nạp particle positions từ WASM buffer vào GPU ---
        const ptr   = universeRef.current.get_render_buffer_ptr();
        const count = universeRef.current.get_particle_count();
        // Clone tránh crash khi WASM memory resize giữa chừng (detached ArrayBuffer)
        const particleData = new Float32Array(
            new Float32Array(wasmMemRef.current.buffer, ptr, count * 3)
        );

        if (geometryRef.current) {
            const attr = geometryRef.current.attributes.position;
            if (!attr || attr.count !== count) {
                geometryRef.current.setAttribute(
                    "position",
                    new THREE.BufferAttribute(particleData, 3),
                );
            } else {
                attr.array.set(particleData);
                attr.needsUpdate = true;
            }
        }

        // --- Màu hạt theo theme (khớp 100% với gameLoopCallback gốc) ---
        let finalHue = 0, lightness = 50;
        if (theme === 'cyberpunk') {
            const timeHue   = (Date.now() * 0.02) % 360;
            const hueOffset = (bass * 100) - (treble * 80) + (mid * 40);
            finalHue  = Math.abs((timeHue + hueOffset) % 360);
            lightness = 40 + (bass * 25) + (mid * 20);
        } else if (theme === 'matrix') {
            finalHue  = 120;
            lightness = 30 + (bass * 40) + (mid * 20);
        } else if (theme === 'volcanic') {
            finalHue  = 10 + (bass * 30) - (treble * 10);
            lightness = 40 + (bass * 30);
        } else if (theme === 'ocean') {
            finalHue  = 200 + (bass * 40) + (treble * 20);
            lightness = 40  + (bass * 20) + (mid * 10);
        }

        if (materialRef.current) {
            materialRef.current.color.setHSL(finalHue / 360, 1.0, lightness / 100);
            if (neonRef.current) {
                materialRef.current.blending = THREE.AdditiveBlending;
                // Phóng to hạt theo bass để giả lập shadowBlur nhấp nháy — khớp gốc
                materialRef.current.size = 12 + (bass * 12) + (treble * 5);
            } else {
                materialRef.current.blending = THREE.NormalBlending;
                materialRef.current.size = 12;
            }
            materialRef.current.needsUpdate = true; // Bắt buộc khi blending thay đổi
        }

        // --- Render Three.js ---
        rendererRef.current.render(sceneRef.current, cameraRef.current);

        // =============================================
        // 5. 2D CANVAS OVERLAY (Shockwave rings + Debug)
        //    Đọc state từ WASM buffer — Rust là nguồn sự thật duy nhất
        // =============================================
        const ctx2D = canvas2DRef.current?.getContext("2d");
        if (ctx2D) {
            ctx2D.clearRect(0, 0, canvas2DRef.current.width, canvas2DRef.current.height);

            // Đọc shockwave buffer từ Rust
            const swPtr = universeRef.current.get_shockwave_buffer_ptr();
            const swLen = universeRef.current.get_shockwave_buffer_len();
            const swBuf = new Float32Array(wasmMemRef.current.buffer, swPtr, swLen);
            const swCount = Math.round(swBuf[0]);

            for (let i = 0; i < swCount; i++) {
                const b    = 1 + i * 4;
                const sx   = swBuf[b];
                const sy   = swBuf[b + 1];
                const srad = swBuf[b + 2];
                const life = swBuf[b + 3];
                ctx2D.beginPath();
                ctx2D.arc(sx, sy, srad, 0, Math.PI * 2);
                ctx2D.strokeStyle = `rgba(255,255,255,${life})`;
                ctx2D.lineWidth   = 2 + (1 - life) * 10;
                ctx2D.stroke();
            }

            // Debug overlay
            if (isDebugMode) {
                const cellSize = 32; // Khớp với CELL_SIZE trong Rust
                ctx2D.strokeStyle = "rgba(255,0,0,0.2)";
                ctx2D.lineWidth   = 1;
                ctx2D.beginPath();
                for (let x = 0; x < canvas2DRef.current.width;  x += cellSize) { ctx2D.moveTo(x, 0); ctx2D.lineTo(x, canvas2DRef.current.height); }
                for (let y = 0; y < canvas2DRef.current.height; y += cellSize) { ctx2D.moveTo(0, y); ctx2D.lineTo(canvas2DRef.current.width, y);   }
                ctx2D.stroke();

                ctx2D.fillStyle = "lime";
                ctx2D.font      = "20px monospace";
                ctx2D.fillText(`FPS: ${fpsRef.current} (WebGL + Rust WASM)`, 20, 30);
                ctx2D.fillText(`Particles: ${count}`, 20, 60);
            }
        }

        requestRef.current = requestAnimationFrame(renderLoop);
    }, [analyzerRef, isDebugMode, theme]);

    useEffect(() => {
        requestRef.current = requestAnimationFrame(renderLoop);
        return () => cancelAnimationFrame(requestRef.current);
    }, [renderLoop]);

    // =============================================
    // 6. EVENT HANDLERS
    // =============================================
    const setMouse = (x, y) => {
        mouseRef.current.x = x;
        mouseRef.current.y = y;
        mouseRef.current.isActive = true;
    };

    const handleMouseDown = (e) => {
        setMouse(e.clientX, e.clientY);
        universeRef.current?.add_shockwave(e.clientX, e.clientY);
    };

    const handleTouchStart = (e) => {
        const t = e.touches[0];
        setMouse(t.clientX, t.clientY);
        universeRef.current?.add_shockwave(t.clientX, t.clientY);
    };

    return (
        <div
            ref={containerRef}
            onMouseMove={(e)  => setMouse(e.clientX, e.clientY)}
            onMouseLeave={()  => { mouseRef.current.isActive = false; }}
            onMouseDown={handleMouseDown}
            onTouchMove={(e)  => setMouse(e.touches[0].clientX, e.touches[0].clientY)}
            onTouchStart={handleTouchStart}
            onTouchEnd={()    => { mouseRef.current.isActive = false; }}
            style={{
                width: "100vw", height: "100vh",
                display: "block", background: "#000",
                cursor: "crosshair", touchAction: "none",
                position: "relative",
            }}
        >
            {/* Canvas 2D phủ lên: shockwave rings + debug (pointerEvents: none để không block mouse) */}
            <canvas
                ref={canvas2DRef}
                style={{ position: "absolute", top: 0, left: 0, zIndex: 10, pointerEvents: "none" }}
            />
        </div>
    );
};