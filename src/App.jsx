import React, { useState } from 'react';
import { PhysicsCanvas } from './components/CanvasEngine/PhysicsCanvas';
import { AudioPlayer } from './components/Controls/AudioPlayer';
import { useAudioStream } from './hooks/useAudioStream';
import { Layout } from './components/Layout';
import { Toast } from './components/Common/Toast';
import { useGlobalError } from './hooks/useGlobalError';

function App() {
  const { analyzerRef, initAudio, resumeAudio, startMic, stopMic } = useAudioStream();
  const [isDebugMode, setIsDebugMode] = useState(false);
  const isDevEnv = import.meta.env.DEV;
  const toast = useGlobalError();
  const [particleCount, setParticleCount] = useState(1000);

  // cyberpunk | matrix | volcanic | ocean
  const [theme, setTheme] = useState('cyberpunk'); 
  const [isNeonEnabled, setIsNeonEnabled] = useState(true);

  return (
    <>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} />
      <Layout
        controls = {(
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
        )}
      >
        <PhysicsCanvas 
          analyzerRef={analyzerRef} 
          isDebugMode={isDebugMode}
          particleCount={particleCount}
          theme={theme}
          isNeonEnabled={isNeonEnabled} 
        />  
      </Layout>
    </>
  )
}

export default App;
