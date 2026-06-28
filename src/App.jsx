import React, { useState } from 'react';
import { PhysicsCanvas } from './components/CanvasEngine/PhysicsCanvas';
import { AudioPlayer } from './components/Controls/AudioPlayer';
import { DebugPanel } from './components/Controls/DebugPanel';
import { useAudioStream } from './hooks/useAudioStream';
import { Layout } from './components/Layout';

function App() {
  // Lấy các hàm quản lý Audio độc lập từ Hook (Module 1)
  const { analyzerRef, initAudio, resumeAudio, startMic, stopMic } = useAudioStream();
  
  // Trạng thái cho UI (Chỉ re-render UI Overlay và truyền cờ bool vào Canvas)
  const [isDebugMode, setIsDebugMode] = useState(false);

  return (
    <Layout
      controls = {(
        <>
          <AudioPlayer initAudio={initAudio} resumeAudio={resumeAudio} startMic={startMic} stopMic={stopMic} />
          <DebugPanel isDebugMode={isDebugMode} onToggle={() => setIsDebugMode(!isDebugMode)} />
        </>
      )}
    >
      <PhysicsCanvas analyzerRef={analyzerRef} isDebugMode={isDebugMode} />  
    </Layout>
  )
}

export default App;