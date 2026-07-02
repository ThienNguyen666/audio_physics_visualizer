import React, { useEffect, useRef, useCallback } from "react";
import * as THREE from "three/webgpu";
import {
    Fn,
    If,
    Loop,
    instancedArray,
    instanceIndex,
    uniform,
    hash,
    time,
    float,
    int,
    uint,
    vec3,
    vec4,
    positionGeometry,
    atomicAdd,
    atomicStore,
    atomicLoad,
    color,
} from "three/tsl";

const GRAVITY_BASE = 0.05;
const BASS_MULTIPLIER = 3.0;
const TREBLE_MULTIPLIER = 40.0;
const DAMPING = 0.01;
const RESTITUTION = 0.9;
const MID_PULL_FORCE = 0.25;
const BASS_PUSH_FORCE = 5.0;
const MOUSE_PULL_FORCE = 1.5;
const MOUSE_INTERACTION_RADIUS = 150.0;
const PARTICLE_RADIUS = 4.0;

// Grid / collision
const CELL_SIZE = 32.0;       // khớp CELL_SIZE trong lib.rs
const MAX_PER_CELL = 8;       // sức chứa tối đa mỗi cell — hạt vượt quá bị bỏ qua khi resolve va chạm
const COLLISION_SUBSTEPS = 2; // khớp ghi chú "2 substep" đã fix bên Rust
const OVERLAP_FACTOR = 0.8;   // khớp ghi chú "0.8 overlap factor" đã fix bên Rust

// Burst đơn giản khi click (thay cho hệ multi-shockwave — xem ghi chú cuối file)
const BURST_RADIUS = 220.0;
const BURST_FORCE = 26.0;
const BURST_DECAY_PER_SEC = 2.2; // burst tắt sau ~0.45s

export const PhysicsCanvasWebGPU = ({
    analyzerRef,
    isDebugMode,
    particleCount,
    theme,
    isNeonEnabled,
    onInitFailed,
}) => {
    const containerRef = useRef(null);
    const canvas2DRef = useRef(null);

    const rendererRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const meshRef = useRef(null);
    const materialRef = useRef(null);

    const updateComputeRef = useRef(null);
    const clearGridComputeRef = useRef(null);
    const buildGridComputeRef = useRef(null);
    const resolveCollisionComputeRef = useRef(null);

    const uniformsRef = useRef(null);
    const builtCountRef = useRef(0);
    const gridInfoRef = useRef({ cols: 0, rows: 0 });

    const requestRef = useRef(null);
    const fpsRef = useRef(0);
    const frameCountRef = useRef(0);
    const lastFpsRef = useRef(0);

    const mouseRef = useRef({ x: 0, y: 0, isActive: false });
    const burstRef = useRef({ x: 0, y: 0, strength: 0 });
    const lastTsRef = useRef(0);

    const neonRef = useRef(isNeonEnabled);
    useEffect(() => { neonRef.current = isNeonEnabled; }, [isNeonEnabled]);

    // =============================================
    // BUILD / REBUILD TOÀN BỘ PIPELINE
    // Gọi lại mỗi khi particleCount HOẶC kích thước canvas (W,H) đổi, vì cả
    // instancedArray lẫn grid buffer đều là buffer kích thước CỐ ĐỊNH.
    // =============================================
    const buildPipeline = useCallback((count, W, H) => {
        const renderer = rendererRef.current;
        const scene = sceneRef.current;
        if (!renderer || !scene || count <= 0) return;

        try {

        if (meshRef.current) {
            scene.remove(meshRef.current);
            materialRef.current?.dispose();
        }

        const cols = Math.max(1, Math.ceil(W / CELL_SIZE));
        const rows = Math.max(1, Math.ceil(H / CELL_SIZE));
        const numCells = cols * rows;
        gridInfoRef.current = { cols, rows };
       
        const posData = new Float32Array(count * 4);
        const velData = new Float32Array(count * 4);

        for (let i = 0; i < count; i++) {
            // X: Rải ngẫu nhiên toàn bộ chiều rộng màn hình
            posData[i * 4 + 0] = Math.random() * W; 
            
            // Y: Spawn ngẫu nhiên từ trên trời rơi xuống (nửa trên màn hình hoặc vượt ra ngoài màn hình)
            // Lùi lên một đoạn âm (-200) để hạt rơi dần vào camera thay vì bùm phát hiện ra
            posData[i * 4 + 1] = Math.random() * (H / 2); 
            
            posData[i * 4 + 2] = 0; // z
            posData[i * 4 + 3] = 0; // w

            // Vận tốc đầu: Thêm chút random để hạt rơi tự nhiên không bị thẳng đơ
            velData[i * 4 + 0] = (Math.random() - 0.5) * 2.0; 
            velData[i * 4 + 1] = Math.random() * 2.0; // Vận tốc Y dương một chút để tạo đà rơi
            velData[i * 4 + 2] = 0;
            velData[i * 4 + 3] = 0;
        }

        const positionBuffer = instancedArray(posData, "vec4");
        const velocityBuffer = instancedArray(velData, "vec4");

        // --- Buffer grid (Phase 3) ---
        const cellCountBuffer = instancedArray(new Uint32Array(numCells), "uint").toAtomic();
        const cellParticlesBuffer = instancedArray(new Int32Array(numCells * MAX_PER_CELL), "int");
        
        const u = {
            bass: uniform(0),
            mid: uniform(0),
            treble: uniform(0),
            mouseX: uniform(0),
            mouseY: uniform(0),
            mouseActive: uniform(0),
            burstX: uniform(0),
            burstY: uniform(0),
            burstStrength: uniform(0),
            width: uniform(W),
            height: uniform(H),
            cols: uniform(cols),
            rows: uniform(rows),
            color: uniform(new THREE.Color(0xffffff)),
            pointSize: uniform(12),
        };
        uniformsRef.current = u;

        // =========================================================
        // PASS 1 — INTEGRATE (lực, damping, tích phân, va biên)
        // =========================================================
        const updateCompute = Fn(() => {
            const idx = instanceIndex;
            const pos = positionBuffer.element(idx);
            const vel = velocityBuffer.element(idx);

            const dynamicGravity = float(GRAVITY_BASE).add(float(BASS_MULTIPLIER).mul(u.bass));
            const thermal = float(TREBLE_MULTIPLIER).mul(u.treble);

            const noiseSeed = idx.toFloat().add(time.mul(1000.0));
            const stochX = hash(noiseSeed).sub(0.5).mul(thermal);
            const stochY = hash(noiseSeed.add(17.0)).sub(0.5).mul(thermal);

            const centerX = u.width.mul(0.5);
            const centerY = u.height.mul(0.5);
            const dxC = centerX.sub(pos.x);
            const dyC = centerY.sub(pos.y);
            const distC = dxC.mul(dxC).add(dyC.mul(dyC)).sqrt().max(1.0);

            const pull = u.mid.mul(MID_PULL_FORCE);
            const push = u.bass.greaterThan(0.5).select(
                u.bass.mul(BASS_PUSH_FORCE).mul(100.0).div(distC),
                float(0.0)
            );
            const cfx = dxC.div(distC).mul(pull.sub(push));
            const cfy = dyC.div(distC).mul(pull.sub(push));

            const dxM = u.mouseX.sub(pos.x);
            const dyM = u.mouseY.sub(pos.y);
            const distM = dxM.mul(dxM).add(dyM.mul(dyM)).sqrt().max(1.0);
            const mouseStrength = u.mouseActive.mul(
                distM.lessThan(MOUSE_INTERACTION_RADIUS).select(
                    float(MOUSE_PULL_FORCE).mul(float(1.0).sub(distM.div(MOUSE_INTERACTION_RADIUS))),
                    float(0.0)
                )
            );
            const mfx = dxM.div(distM).mul(mouseStrength);
            const mfy = dyM.div(distM).mul(mouseStrength);

            const dxB = pos.x.sub(u.burstX);
            const dyB = pos.y.sub(u.burstY);
            const distB = dxB.mul(dxB).add(dyB.mul(dyB)).sqrt().max(1.0);
            const burstMag = distB.lessThan(BURST_RADIUS).select(
                u.burstStrength.mul(float(BURST_FORCE)).mul(float(1.0).sub(distB.div(BURST_RADIUS))),
                float(0.0)
            );
            const bfx = dxB.div(distB).mul(burstMag);
            const bfy = dyB.div(distB).mul(burstMag);

            const dampedVel = vel.mul(float(1.0).sub(DAMPING));
            const newVx = dampedVel.x.add(stochX).add(cfx).add(mfx).add(bfx);
            const newVy = dampedVel.y.add(dynamicGravity).add(stochY).add(cfy).add(mfy).add(bfy);
            vel.assign(vec4(newVx, newVy, 0, 0));
            pos.addAssign(vel);

            If(pos.x.lessThan(PARTICLE_RADIUS), () => {
                pos.x.assign(PARTICLE_RADIUS);
                vel.x.assign(vel.x.mul(-RESTITUTION));
            }).ElseIf(pos.x.greaterThan(u.width.sub(PARTICLE_RADIUS)), () => {
                pos.x.assign(u.width.sub(PARTICLE_RADIUS));
                vel.x.assign(vel.x.mul(-RESTITUTION));
            });
            If(pos.y.lessThan(PARTICLE_RADIUS), () => {
                pos.y.assign(PARTICLE_RADIUS);
                vel.y.assign(vel.y.mul(-RESTITUTION));
            }).ElseIf(pos.y.greaterThan(u.height.sub(PARTICLE_RADIUS)), () => {
                pos.y.assign(u.height.sub(PARTICLE_RADIUS));
                vel.y.assign(vel.y.mul(-RESTITUTION));
            });
        })().compute(count);
        updateComputeRef.current = updateCompute;

        // =========================================================
        // PASS 2 — CLEAR GRID (reset atomic counter mỗi cell về 0)
        // =========================================================
        const clearGridCompute = Fn(() => {
            atomicStore(cellCountBuffer.element(instanceIndex), uint(0));
        })().compute(numCells);
        clearGridComputeRef.current = clearGridCompute;

        // =========================================================
        // PASS 3 — BUILD GRID (mỗi hạt claim 1 slot trong cell của nó)
        // =========================================================
        const buildGridCompute = Fn(() => {
            const idx = instanceIndex;
            const pos = positionBuffer.element(idx);
            const col = pos.x.div(CELL_SIZE).floor().toInt().clamp(0, int(cols - 1));
            const row = pos.y.div(CELL_SIZE).floor().toInt().clamp(0, int(rows - 1));
            const cellIdx = row.mul(int(cols)).add(col);

            const slot = atomicAdd(cellCountBuffer.element(cellIdx), uint(1));
            If(slot.lessThan(uint(MAX_PER_CELL)), () => {
                cellParticlesBuffer
                    .element(cellIdx.mul(int(MAX_PER_CELL)).add(slot.toInt()))
                    .assign(idx.toInt());
            });
        })().compute(count);
        buildGridComputeRef.current = buildGridCompute;

        // =========================================================
        // PASS 4 — RESOLVE COLLISION (quét 3x3 cell lân cận)
        // Mỗi thread CHỈ ghi vào hạt của chính nó — an toàn song song.
        // =========================================================
        const resolveCollisionCompute = Fn(() => {
            const idx = instanceIndex;
            const posElem = positionBuffer.element(idx);
            const velElem = velocityBuffer.element(idx);

            const myPos = posElem;
            const myVel = velElem;

            const posCorrection = vec4(0, 0, 0, 0).toVar();
            const velCorrection = vec4(0, 0, 0, 0).toVar();

            const col = myPos.x.div(CELL_SIZE).floor().toInt();
            const row = myPos.y.div(CELL_SIZE).floor().toInt();

            Loop({ start: -1, end: 2, type: "int" }, ({ i: dr }) => {
                Loop({ start: -1, end: 2, type: "int" }, ({ i: dc }) => {
                    const c = col.add(dc);
                    const r = row.add(dr);
                    If(c.greaterThanEqual(0), () => {
                    If(c.lessThan(int(cols)), () => {
                    If(r.greaterThanEqual(0), () => {
                    If(r.lessThan(int(rows)), () => {
                        const cellIdx = r.mul(int(cols)).add(c);
                        const cellCount = atomicLoad(cellCountBuffer.element(cellIdx)).min(uint(MAX_PER_CELL));

                        Loop({ start: 0, end: int(MAX_PER_CELL), type: "int" }, ({ i: slot }) => {
                            If(slot.lessThan(cellCount.toInt()), () => {
                                const j = cellParticlesBuffer.element(cellIdx.mul(int(MAX_PER_CELL)).add(slot));
                                If(j.notEqual(idx.toInt()), () => {
                                    const otherPos = positionBuffer.element(j.toUint());
                                    const otherVel = velocityBuffer.element(j.toUint());

                                    const dx = myPos.x.sub(otherPos.x);
                                    const dy = myPos.y.sub(otherPos.y);
                                    const distSq = dx.mul(dx).add(dy.mul(dy));
                                    const minDist = float(PARTICLE_RADIUS * 2.0);

                                    If(distSq.lessThan(minDist.mul(minDist)), () => {
                                    If(distSq.greaterThan(0.0001), () => {
                                        const dist = distSq.sqrt();
                                        const nx = dx.div(dist);
                                        const ny = dy.div(dist);
                                        const overlap = minDist.sub(dist);

                                        posCorrection.x.addAssign(nx.mul(overlap).mul(OVERLAP_FACTOR).mul(0.5));
                                        posCorrection.y.addAssign(ny.mul(overlap).mul(OVERLAP_FACTOR).mul(0.5));

                                        const dvx = otherVel.x.sub(myVel.x);
                                        const dvy = otherVel.y.sub(myVel.y);
                                        const velAlongNormal = nx.mul(dvx).add(ny.mul(dvy));

                                        If(velAlongNormal.greaterThanEqual(0.0), () => {
                                            const impulse = float(-(1.0 + RESTITUTION)).mul(velAlongNormal).div(2.0);
                                            velCorrection.x.addAssign(impulse.mul(nx).mul(-1.0));
                                            velCorrection.y.addAssign(impulse.mul(ny).mul(-1.0));
                                        });
                                    });
                                    });
                                });
                            });
                        });
                    });
                    });
                    });
                    });
                });
            });

            posElem.assign(myPos.add(posCorrection));
            velElem.assign(myVel.add(velCorrection));
        })().compute(count);
        resolveCollisionComputeRef.current = resolveCollisionCompute;


        // ==========================================
        // 5. RENDER LAYER (FIXED TSL VEC3 DIMENSION OVERFLOW)
        // ==========================================
        // Lấy data từ buffer ra
        const posAttr = positionBuffer.element(instanceIndex);
        // Ép kiểu an toàn: Chỉ lấy x và y, gán z = 0.0
        const particlePos3D = vec3(posAttr.x, posAttr.y, 0.0);

        const material = new THREE.MeshBasicNodeMaterial({
            colorNode: u.color, 
            
            positionNode: positionGeometry.mul(u.pointSize).add(particlePos3D),
    
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
            // side: THREE.DoubleSide 
        });

        const geometry = new THREE.PlaneGeometry(1, 1);
        const instancedMesh = new THREE.InstancedMesh(geometry, material, count);
        
        meshRef.current = instancedMesh;
        materialRef.current = material;

        const dummy = new THREE.Matrix4();
        for (let i = 0; i < count; i++) {
            instancedMesh.setMatrixAt(i, dummy);
        }
        instancedMesh.instanceMatrix.needsUpdate = true;
        // Bắt buộc để false để CPU không tự giấu hạt
        instancedMesh.frustumCulled = false;

        scene.add(instancedMesh);

        // Gọi window.__ptDebug() trong console bất cứ lúc nào để xem tọa độ
        // hạt HIỆN TẠI (sau khi vật lý/collision đã chạy vài frame) — hữu ích
        // nếu init đúng nhưng bị hỏng dần sau đó (vd do collision compute).
        window.__ptDebug = async () => {
            try {
                const raw = await renderer.getArrayBufferAsync(positionBuffer.value);
                console.log("[__ptDebug] positions (10 hạt đầu):", Array.from(new Float32Array(raw).slice(0, 30)));
            } catch (err) {
                console.error("[__ptDebug] lỗi:", err);
            }
        };

        builtCountRef.current = count;
        console.log(`[PhysicsCanvasWebGPU] ✅ Pipeline built: ${count} hạt, grid ${cols}x${rows} (${numCells} cells)`);
        } catch (err) {
            console.error("[PhysicsCanvasWebGPU] ❌ buildPipeline lỗi:", err);
            onInitFailed?.(err);
        }
    }, [onInitFailed]);

    // =============================================
    // 1. KHỞI TẠO RENDERER + SCENE
    // =============================================
    useEffect(() => {
        let mounted = true;

        (async () => {
            try {
                const W = window.innerWidth || 1000;
                const H = window.innerHeight || 1000;

                const renderer = new THREE.WebGPURenderer({
                    antialias: false,
                    powerPreference: "high-performance",
                });
                await renderer.init();
                if (!mounted) { renderer.dispose?.(); return; }

                renderer.setSize(W, H);
                renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
                containerRef.current.appendChild(renderer.domElement);
                rendererRef.current = renderer;

                const scene = new THREE.Scene();
                sceneRef.current = scene;

                const camera = new THREE.OrthographicCamera(0, W, 0, H, -100, 100);
                camera.position.z = 10;
                cameraRef.current = camera;

                buildPipeline(particleCount, W, H);

                if (canvas2DRef.current) {
                    canvas2DRef.current.width = W;
                    canvas2DRef.current.height = H;
                }
            } catch (err) {
                console.error("[PhysicsCanvasWebGPU] Init thất bại, fallback về WASM:", err);
                onInitFailed?.(err);
            }
        })();

        return () => {
            mounted = false;
            cancelAnimationFrame(requestRef.current);
            if (rendererRef.current) {
                rendererRef.current.dispose?.();
                if (containerRef.current?.contains(rendererRef.current.domElement)) {
                    containerRef.current.removeChild(rendererRef.current.domElement);
                }
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // =============================================
    // 2. REBUILD KHI ĐỔI PARTICLE COUNT
    // =============================================
    useEffect(() => {
        if (!rendererRef.current || !sceneRef.current) return;
        if (builtCountRef.current === particleCount) return;
        buildPipeline(particleCount, window.innerWidth, window.innerHeight);
    }, [particleCount, buildPipeline]);

    // =============================================
    // 3. RESIZE — rebuild toàn bộ vì grid buffer phụ thuộc W,H
    // =============================================
    useEffect(() => {
        const onResize = () => {
            const W = window.innerWidth;
            const H = window.innerHeight;

            if (cameraRef.current) {
                cameraRef.current.right = W;
                cameraRef.current.bottom = H;
                cameraRef.current.updateProjectionMatrix();
            }
            rendererRef.current?.setSize(W, H);
            if (canvas2DRef.current) {
                canvas2DRef.current.width = W;
                canvas2DRef.current.height = H;
            }
            if (rendererRef.current && sceneRef.current) {
                buildPipeline(builtCountRef.current || particleCount, W, H);
            }
        };
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [buildPipeline]);

    // =============================================
    // 4. GAME LOOP
    // =============================================
    const renderLoop = useCallback(async (timestamp) => {
        const renderer = rendererRef.current;
        const u = uniformsRef.current;
        if (!renderer || !u || !updateComputeRef.current) {
            requestRef.current = requestAnimationFrame(renderLoop);
            return;
        }

        const dtSec = lastTsRef.current ? (timestamp - lastTsRef.current) / 1000 : 0.016;
        lastTsRef.current = timestamp;

        frameCountRef.current++;
        if (!lastFpsRef.current) lastFpsRef.current = timestamp;
        if (timestamp - lastFpsRef.current >= 500) {
            fpsRef.current = Math.round(frameCountRef.current * 1000 / (timestamp - lastFpsRef.current));
            frameCountRef.current = 0;
            lastFpsRef.current = timestamp;
        }

        let audioData = { bass: 0, mid: 0, treble: 0 };
        if (analyzerRef.current) audioData = analyzerRef.current.update();
        const { bass, mid, treble } = audioData;

        u.bass.value = bass;
        u.mid.value = mid;
        u.treble.value = treble;
        u.mouseX.value = mouseRef.current.x;
        u.mouseY.value = mouseRef.current.y;
        u.mouseActive.value = mouseRef.current.isActive ? 1 : 0;

        if (burstRef.current.strength > 0) {
            burstRef.current.strength = Math.max(0, burstRef.current.strength - BURST_DECAY_PER_SEC * dtSec);
        }
        u.burstX.value = burstRef.current.x;
        u.burstY.value = burstRef.current.y;
        u.burstStrength.value = burstRef.current.strength;

        let finalHue = 0, lightness = 50;
        if (theme === "cyberpunk") {
            const timeHue = (Date.now() * 0.02) % 360;
            const hueOffset = (bass * 100) - (treble * 80) + (mid * 40);
            finalHue = Math.abs((timeHue + hueOffset) % 360);
            lightness = 40 + (bass * 25) + (mid * 20);
        } else if (theme === "matrix") {
            finalHue = 120;
            lightness = 30 + (bass * 40) + (mid * 20);
        } else if (theme === "volcanic") {
            finalHue = 10 + (bass * 30) - (treble * 10);
            lightness = 40 + (bass * 30);
        } else if (theme === "ocean") {
            finalHue = 200 + (bass * 40) + (treble * 20);
            lightness = 40 + (bass * 20) + (mid * 10);
        }
        u.color.value.setHSL(finalHue / 360, 1.0, lightness / 100);
        u.pointSize.value = neonRef.current ? 12 + bass * 12 + treble * 5 : 12;

        try {
            await renderer.computeAsync(updateComputeRef.current);

            if (clearGridComputeRef.current && buildGridComputeRef.current && resolveCollisionComputeRef.current) {
                for (let s = 0; s < COLLISION_SUBSTEPS; s++) {
                    await renderer.computeAsync(clearGridComputeRef.current);
                    await renderer.computeAsync(buildGridComputeRef.current);
                    await renderer.computeAsync(resolveCollisionComputeRef.current);
                }
            }

            await renderer.renderAsync(sceneRef.current, cameraRef.current);
        } catch (err) {
            console.error("[PhysicsCanvasWebGPU] ❌ Lỗi trong render loop, fallback về WASM:", err);
            onInitFailed?.(err);
            return;
        }

        const ctx2D = canvas2DRef.current?.getContext("2d");
        if (ctx2D) {
            ctx2D.clearRect(0, 0, canvas2DRef.current.width, canvas2DRef.current.height);
            if (isDebugMode) {
                const { cols, rows } = gridInfoRef.current;
                ctx2D.strokeStyle = "rgba(255,0,0,0.15)";
                ctx2D.lineWidth = 1;
                ctx2D.beginPath();
                for (let x = 0; x <= cols * CELL_SIZE; x += CELL_SIZE) { ctx2D.moveTo(x, 0); ctx2D.lineTo(x, rows * CELL_SIZE); }
                for (let y = 0; y <= rows * CELL_SIZE; y += CELL_SIZE) { ctx2D.moveTo(0, y); ctx2D.lineTo(cols * CELL_SIZE, y); }
                ctx2D.stroke();

                ctx2D.fillStyle = "cyan";
                ctx2D.font = "20px monospace";
                ctx2D.fillText(`FPS: ${fpsRef.current} (WebGPU Compute)`, 20, 30);
                ctx2D.fillText(`Particles: ${builtCountRef.current}`, 20, 60);
                ctx2D.fillText(`Collision: ON (${COLLISION_SUBSTEPS} substep)`, 20, 90);
            }
        }

        requestRef.current = requestAnimationFrame(renderLoop);
    }, [analyzerRef, isDebugMode, theme, onInitFailed]);

    useEffect(() => {
        requestRef.current = requestAnimationFrame(renderLoop);
        return () => cancelAnimationFrame(requestRef.current);
    }, [renderLoop]);

    // =============================================
    // 5. EVENT HANDLERS
    // =============================================
    const setMouse = (x, y) => {
        mouseRef.current.x = x;
        mouseRef.current.y = y;
        mouseRef.current.isActive = true;
    };

    const triggerBurst = (x, y) => {
        burstRef.current = { x, y, strength: 1.0 };
    };

    return (
        <div
            ref={containerRef}
            onMouseMove={(e) => setMouse(e.clientX, e.clientY)}
            onMouseLeave={() => { mouseRef.current.isActive = false; }}
            onMouseDown={(e) => { setMouse(e.clientX, e.clientY); triggerBurst(e.clientX, e.clientY); }}
            onTouchMove={(e) => setMouse(e.touches[0].clientX, e.touches[0].clientY)}
            onTouchStart={(e) => {
                const t = e.touches[0];
                setMouse(t.clientX, t.clientY);
                triggerBurst(t.clientX, t.clientY);
            }}
            onTouchEnd={() => { mouseRef.current.isActive = false; }}
            style={{
                width: "100vw", height: "100vh",
                display: "block", background: "#000",
                cursor: "crosshair", touchAction: "none",
                position: "relative",
            }}
        >
            <canvas
                ref={canvas2DRef}
                style={{ position: "absolute", top: 0, left: 0, zIndex: 10, pointerEvents: "none" }}
            />
        </div>
    );
};