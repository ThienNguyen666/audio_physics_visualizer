import React, { useState } from 'react';
import { EngineSwitcher } from './components/CanvasEngine/EngineSwitcher';
import { AudioPlayer } from './components/Controls/AudioPlayer';
import { useAudioStream } from './hooks/useAudioStream';
import { Layout } from './components/Layout';
import { Toast } from './components/Common/Toast';
import { useGlobalError } from './hooks/useGlobalError';

const TIER_LABELS = {
  webgpu: { icon: '⚡', label: 'WebGPU', color: '#00ffcc' },
  wasm:   { icon: '🦀', label: 'WASM',   color: '#ff9f43' },
  js:     { icon: '🐢', label: 'JS',     color: '#ff4757' },
};

function App() {
  const { analyzerRef, initAudio, resumeAudio, startMic, stopMic } = useAudioStream();
  const [isDebugMode, setIsDebugMode] = useState(false);
  const isDevEnv = import.meta.env.DEV;
  const toast = useGlobalError();
  const [particleCount, setParticleCount] = useState(1000);

  // cyberpunk | matrix | volcanic | ocean
  const [theme, setTheme] = useState('cyberpunk');
  const [isNeonEnabled, setIsNeonEnabled] = useState(true);

  // Tier hiện đang chạy: 'webgpu' | 'wasm' | 'js' | null (đang detect)
  const [tier, setTier] = useState(null);
  const tierInfo = tier ? TIER_LABELS[tier] : null;

  return (
    <>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} />
      <Layout
        controls={(
          <>
            {isDevEnv && tierInfo && (
              <div style={{
                alignSelf: 'flex-end',
                background: 'rgba(0,0,0,0.6)',
                border: `1px solid ${tierInfo.color}`,
                color: tierInfo.color,
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 'bold',
                fontFamily: 'monospace',
                backdropFilter: 'blur(8px)',
                letterSpacing: '0.5px',
              }}>
                {tierInfo.icon} {tierInfo.label}
              </div>
            )}
            <AudioPlayer
              initAudio={initAudio}
              resumeAudio={resumeAudio}
              startMic={startMic}
              stopMic={stopMic}
              particleCount={particleCount}
              setParticleCount={setParticleCount}
              theme={theme}
              setTheme={setTheme}
              isNeonEnabled={isNeonEnabled}
              setIsNeonEnabled={setIsNeonEnabled}
              isDebugMode={isDebugMode}
              setIsDebugMode={setIsDebugMode}
              isDevEnv={isDevEnv}
            />
          </>
        )}
      >
        <EngineSwitcher
          analyzerRef={analyzerRef}
          isDebugMode={isDebugMode}
          particleCount={particleCount}
          theme={theme}
          isNeonEnabled={isNeonEnabled}
          onTierChange={setTier}
        />
      </Layout>
    </>
  )
}

export default App;