import React, { useRef, useState} from "react";

export const AudioPlayer = ( {initAudio, resumeAudio, startMic, stopMic, particleCount, setParticleCount, theme, setTheme}) => {
      const audioRef = useRef(null);
      const [isPlaying, setIsPlaying] = useState(false);
      const [audioSrc, setAudioSrc] = useState(null);
      const [isInitialized, setIsInitialized] = useState(false);
      const [isMicActive, setIsMicActive] = useState(false);

      const [isCollapsed, setIsCollapsed] = useState(false);


      const handlePlayPause = () => {
            if(!audioRef.current || !audioSrc ) return;

            if(isMicActive) toggleMic();

            if(!isInitialized){
                  initAudio(audioRef.current);
                  setIsInitialized(true);
            } else {
                  resumeAudio();
                  initAudio(audioRef.current);
            }

            if(isPlaying) audioRef.current.pause();
            else audioRef.current.play();

            setIsPlaying(!isPlaying);
      };

      const handleFileUpload = (e) => {
            const file = e.target.files[0];
            if(file){
                  const url = URL.createObjectURL(file);
                  setAudioSrc(url);
                  setIsPlaying(false);

                  if(audioRef.current){
                        audioRef.current.pause();
                        audioRef.current.load();
                  }
            }
      };

      const loadDemoTrack = () => {
            setAudioSrc("/K-391 - Earth.mp3");
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

      return (
            <div style = {{
                  ...styles.wrapper,
                  transform: isCollapsed ? 'translateX(calc(100% + 20px))' : 'translateX(0)'
            }}>
                  {/* NÚT THÒ RA NGOÀI ĐỂ ĐÓNG/MỞ */}
                  <button 
                        onClick={() => setIsCollapsed(!isCollapsed)} 
                        style={styles.toggleBtn}
                        title={isCollapsed ? "Mở bảng điều khiển" : "Ẩn bảng điều khiển"}
                  >
                        {isCollapsed ? '⚙️' : '▶'}
                  </button>

                  {/* BẢNG ĐIỀU KHIỂN CHÍNH */}
                  <div style = {styles.container}>
                        <h3 style={styles.title}> Audio Controls</h3>
                        
                        <div style={styles.buttonGroup}>
                              <button onClick={loadDemoTrack} style={styles.demoBtn}>
                                    🔥 Load Demo Track
                              </button>
                              <button 
                                    onClick={toggleMic} 
                                    style={{...styles.micBtn, background: isMicActive ? '#ff4757' : '#2ed573'}}
                              >
                                    {isMicActive ? '🛑 Tắt Mic' : '🎤 Live Microphone'}
                              </button>
                        </div>

                        {/* SECTION CÀI ĐẶT MỚI THÊM VÀO */}
                        <div style={styles.settingRow}>
                              <span style={{color: '#aaa', fontWeight: 'bold'}}>✨ Hạt: {particleCount}</span>
                              <input 
                                    type="range" min="100" max="3000" step="100" 
                                    value={particleCount} 
                                    onChange={(e) => setParticleCount(Number(e.target.value))}
                                    style={styles.slider}
                              />
                        </div>

                        <div style={styles.settingRow}>
                              <span style={{color: '#aaa', fontWeight: 'bold'}}>🎨 Theme:</span>
                              <select value={theme} onChange={(e) => setTheme(e.target.value)} style={styles.select}>
                                    <option value="cyberpunk">Cyberpunk Neon</option>
                                    <option value="matrix">Matrix Green</option>
                                    <option value="volcanic">Volcanic Red</option>
                                    <option value="ocean">Deep Space Ocean</option>
                              </select>
                        </div>

                        <input
                              type = "file"
                              accept = "audio/*"
                              onChange = {handleFileUpload}
                              style = {styles.input}
                        />
                        <audio
                              ref = {audioRef}
                              src = {audioSrc}
                              onEnded = {() => setIsPlaying(false)}
                        />
                        <button
                              onClick = {handlePlayPause}
                              style = {{ ...styles.button, opacity : audioSrc ? 1 : 0.5}}
                              disabled = {!audioSrc}
                        >
                              {isPlaying ? "⏸ Pause" : "▶ Play"}
                        </button>
                  </div>
            </div>
            
      )
}

const styles = {
      wrapper: {
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 1000,
            transition: 'transform 0.4s cubic-bezier(0.68, -0.55, 0.27, 1.55)', // Cực mượt, có hiệu ứng nảy nhẹ (bounce)
      },
      toggleBtn: {
            position: 'absolute',
            left: '-40px',
            top: '0',
            width: '40px',
            height: '40px',
            background: 'rgba(255, 255, 255, 0.1)',
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
            transition: 'background 0.3s'
      },
      container: { 
            background: 'rgba(0, 0, 0, 0.5)', 
            padding: '15px', 
            borderRadius: '0 8px 8px 8px',
            color: 'white', 
            backdropFilter: 'blur(10px)', 
            border: '1px solid rgba(255,255,255,0.2)',
            width: '300px' 
      },

      title: { 
            margin: '0 0 10px 0', 
            fontSize: '16px', 
            textTransform: 'uppercase', 
            letterSpacing: '1px' 
      },

      input: { 
            display: 'block', 
            marginBottom: '10px', 
            fontSize: '12px', 
            color: '#ccc' 
      },
      button: { 
            width: '100%', 
            padding: '10px', 
            cursor: 'pointer', 
            background: '#00ffcc', 
            border: 'none', 
            borderRadius: '4px', 
            fontWeight: 'bold', 
            fontSize: '14px' 
      },
      settingRow: { 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '15px', 
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
      }
};