import React, { useRef, useState, useEffect } from "react";

// Hàm định dạng thời gian giây thành dạng MM:SS
const formatTime = (secs) => {
    if (isNaN(secs)) return "00:00";
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = Math.floor(secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
};

export const AudioPlayer = ({
    initAudio,
    resumeAudio,
    startMic,
    stopMic,
    particleCount,
    setParticleCount,
    theme,
    setTheme,
    isNeonEnabled,
    setIsNeonEnabled,
    isDebugMode,
    setIsDebugMode,
    isDevEnv
}) => {
    const audioRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [audioSrc, setAudioSrc] = useState(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [isMicActive, setIsMicActive] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);

    // State phục vụ hiển thị tiến trình và tua nhạc
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    // --- CÔNG THỨC PHI TUYẾN TÍNH (LOGARITHMIC/CUBIC SCALE) ---
    const minP = 100;
    const maxP = 60000;

    const sliderToParticles = (val) => {
        return Math.round(minP + Math.pow(val / 100, 3) * (maxP - minP));
    };

    const particlesToSlider = (pCount) => {
        if (pCount <= minP) return 0;
        return Math.pow((pCount - minP) / (maxP - minP), 1 / 3) * 100;
    };

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                if (audioRef.current && !audioRef.current.paused) {
                    audioRef.current.pause();
                    setIsPlaying(false);
                    window.alert("Tự động tạm dừng để tiết kiệm pin ! 🔋");
                }
            }
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, []);

    const handlePlayPause = () => {
        if (!audioRef.current || !audioSrc) return;

        if (isMicActive) {
            toggleMic();
        }

        if (!isInitialized) {
            initAudio(audioRef.current);
            setIsInitialized(true);
        } else {
            resumeAudio();
            initAudio(audioRef.current);
        }

        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play().catch(err => console.log("Lỗi phát nhạc:", err));
        }

        setIsPlaying(!isPlaying);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            setAudioSrc(url);
            setIsPlaying(false);
            setCurrentTime(0);
            setDuration(0);

            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.load();
            }
        }
    };

    const loadDemoTrack = () => {
        setAudioSrc("/K-391 - Earth.mp3");
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);

        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.load();
        }
    };

    const toggleMic = async () => {
        if (isMicActive) {
            stopMic();
            setIsMicActive(false);
        } else {
            if (isPlaying && audioRef.current) {
                audioRef.current.pause();
                setIsPlaying(false);
            }
            const success = await startMic();
            if (success) {
                setIsMicActive(true);
                setIsInitialized(true);
            }
        }
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration);
        }
    };

    const handleSeekChange = (e) => {
        const targetTime = parseFloat(e.target.value);
        if (audioRef.current) {
            audioRef.current.currentTime = targetTime;
            setCurrentTime(targetTime);
        }
    };

    return (
        <div style={{
            ...styles.wrapper,
            transform: isCollapsed ? 'translateX(calc(100% + 20px))' : 'translateX(0)'
        }}>
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                style={styles.toggleBtn}
                title={isCollapsed ? "Mở bảng điều khiển" : "Ẩn bảng điều khiển"}
            >
                {isCollapsed ? '⚙️' : '▶'}
            </button>

            <div style={styles.container}>
                <h3 style={styles.title}>Audio Controls</h3>

                <div style={styles.buttonGroup}>
                    <button onClick={loadDemoTrack} style={styles.demoBtn}>
                        🔥 Load Demo Track
                    </button>
                    <button
                        onClick={toggleMic}
                        style={{ ...styles.micBtn, background: isMicActive ? '#ff4757' : '#2ed573' }}
                    >
                        {isMicActive ? '🛑 Tắt Mic' : '🎤 Live Microphone'}
                    </button>
                </div>

                {/* HỆ THỐNG ĐIỀU CHỈNH HẠT PHI TUYẾN TÍNH (100 -> 60,000) */}
                <div style={styles.settingRow}>
                    <span style={{ color: '#aaa', fontWeight: 'bold' }}>
                        ✨ Hạt: {particleCount.toLocaleString()}
                    </span>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        step="0.1"
                        value={particlesToSlider(particleCount)}
                        onChange={(e) => setParticleCount(sliderToParticles(parseFloat(e.target.value)))}
                        style={styles.slider}
                    />
                </div>

                <div style={styles.settingRow}>
                    <span style={{ color: '#aaa', fontWeight: 'bold' }}>🎨 Theme:</span>
                    <select value={theme} onChange={(e) => setTheme(e.target.value)} style={styles.select}>
                        <option value="cyberpunk">Cyberpunk Neon</option>
                        <option value="matrix">Matrix Green</option>
                        <option value="volcanic">Volcanic Red</option>
                        <option value="ocean">Deep Space Ocean</option>
                    </select>
                </div>

                {/* BẬT TẮT HIỆU ỨNG NEON (GLOW) - ĐÃ GOM VÀO CHUNG PANEL */}
                <div style={styles.settingRow}>
                    <span style={{ color: '#aaa', fontWeight: 'bold' }}>🌟 Neon Glow:</span>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={isNeonEnabled}
                            onChange={(e) => setIsNeonEnabled(e.target.checked)}
                            style={styles.checkbox}
                        />
                    </label>
                </div>

                {/* NÚT CHỌN TẬP TIN ÂM THANH */}
                <input
                    type="file"
                    accept="audio/*"
                    onChange={handleFileUpload}
                    style={styles.input}
                />

                {/* TRÌNH PHÁT NHẠC VÀ SEEKBAR ĐƯỢC TÍCH HỢP CHUẨN PRODUCTION */}
                {audioSrc && !isMicActive && (
                    <div style={styles.seekbarContainer}>
                        <input
                            type="range"
                            min={0}
                            max={duration || 100}
                            value={currentTime}
                            onChange={handleSeekChange}
                            style={styles.seekbar}
                        />
                        <div style={styles.timeLabel}>
                            <span>{formatTime(currentTime)}</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                    </div>
                )}

                <audio
                    ref={audioRef}
                    src={audioSrc}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onEnded={() => setIsPlaying(false)}
                />

                <button
                    onClick={handlePlayPause}
                    style={{ ...styles.button, opacity: audioSrc ? 1 : 0.5 }}
                    disabled={!audioSrc}
                >
                    {isPlaying ? "⏸ Pause" : "▶ Play"}
                </button>

                {/* ĐOẠN DEBUG PANEL ĐƯỢC GOM GỌN XUỐNG DƯỚI PANEL CHÍNH VỚI STYLE RIÊNG */}
                {isDevEnv && (
                    <>
                        <hr style={styles.devDivider} />
                        <div style={styles.devContainer}>
                            <label style={styles.devLabel}>
                                <input
                                    type="checkbox"
                                    checked={isDebugMode}
                                    onChange={(e) => setIsDebugMode(e.target.checked)}
                                    style={styles.checkbox}
                                />
                                🛠️ Visual Debug Mode
                            </label>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

const styles = {
    wrapper: {
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 1000,
        transition: 'transform 0.4s cubic-bezier(0.68, -0.55, 0.27, 1.55)',
    },
    toggleBtn: {
        position: 'absolute',
        left: '-40px',
        top: '0',
        width: '40px',
        height: '40px',
        background: 'rgba(0, 0, 0, 0.6)',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRight: 'none',
        borderRadius: '8px 0 0 8px',
        color: 'white',
        cursor: 'pointer',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontSize: '18px',
    },
    container: {
        background: 'rgba(0, 0, 0, 0.65)',
        padding: '15px',
        borderRadius: '0 8px 8px 8px',
        color: 'white',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.2)',
        width: '300px'
    },
    title: {
        margin: '0 0 10px 0',
        fontSize: '16px',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        color: '#00ffcc'
    },
    buttonGroup: {
        display: 'flex',
        gap: '8px',
        marginBottom: '15px'
    },
    demoBtn: {
        flex: 1,
        padding: '8px',
        cursor: 'pointer',
        background: '#ff9f43',
        border: 'none',
        borderRadius: '4px',
        fontWeight: 'bold',
        fontSize: '12px',
        color: 'white'
    },
    micBtn: {
        flex: 1,
        padding: '8px',
        cursor: 'pointer',
        border: 'none',
        borderRadius: '4px',
        fontWeight: 'bold',
        fontSize: '12px',
        color: 'white',
        transition: 'background 0.2s'
    },
    input: {
        display: 'block',
        marginBottom: '12px',
        fontSize: '12px',
        color: '#ccc',
        width: '100%'
    },
    button: {
        width: '100%',
        padding: '10px',
        cursor: 'pointer',
        background: '#00ffcc',
        border: 'none',
        borderRadius: '4px',
        fontWeight: 'bold',
        fontSize: '14px',
        color: '#000',
        transition: 'opacity 0.2s'
    },
    settingRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
        fontSize: '13px'
    },
    slider: {
        width: '60%',
        cursor: 'pointer',
        accentColor: '#00ffcc'
    },
    select: {
        width: '60%',
        background: 'rgba(0,0,0,0.6)',
        color: '#00ffcc',
        border: '1px solid #00ffcc',
        borderRadius: '4px',
        padding: '4px 8px',
        cursor: 'pointer',
        outline: 'none'
    },
    checkbox: {
        width: '16px',
        height: '16px',
        cursor: 'pointer',
        accentColor: '#00ffcc'
    },
    seekbarContainer: {
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        marginBottom: '12px'
    },
    seekbar: {
        width: '100%',
        accentColor: '#00ffcc',
        cursor: 'pointer',
        background: 'rgba(255,255,255,0.2)',
        height: '5px',
        borderRadius: '3px'
    },
    timeLabel: {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '11px',
        color: '#aaa',
        fontFamily: 'monospace'
    },
    devDivider: {
        border: 'none',
        borderTop: '1px dashed rgba(255, 71, 87, 0.4)',
        margin: '12px 0'
    },
    devContainer: {
        background: 'rgba(255, 71, 87, 0.1)',
        padding: '8px 10px',
        borderRadius: '4px',
        border: '1px solid rgba(255, 71, 87, 0.2)'
    },
    devLabel: {
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        fontSize: '13px',
        fontWeight: 'bold',
        color: '#ff4757',
        gap: '8px'
    }
};
