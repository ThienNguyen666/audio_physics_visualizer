import React, { useRef, useState} from "react";

export const AudioPlayer = ( {initAudio, resumeAudio}) => {
      const audioRef = useRef(null);
      const [isPlaying, setIsPlaying] = useState(false);
      const [audioSrc, setAudioSrc] = useState(null);
      const [isInitialized, setIsInitialized] = useState(false);

      const handlePlayPause = () => {
            if(!audioRef.current || !audioSrc ) return;

            if(!isInitialized){
                  initAudio(audioRef.current);
                  setIsInitialized(true);
            } else {
                  resumeAudio();
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

      return (
            <div style = {styles.container}>
                  <h3 style={styles.title}> Audio Controls</h3>
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
                        {isPlaying ? "Pause" : "Play"}
                  </button>
            </div>
      )
}

const styles = {
      container: {
            background: 'rgba(255, 255, 255, 0.1)',
            padding: '15px',
            borderRadius: '8px',
            color: 'white',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.2)'
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
      }
};