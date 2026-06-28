import {useRef, useEffect, useCallback} from 'react';
import { AudioAnalyzer } from '../core/audio/AudioAnalyzer';

export const useAudioStream = () => {
      const analyzerRef = useRef(null);
      const streamRef = useRef(null);

      useEffect(() => {
            analyzerRef.current = new AudioAnalyzer();
            
            return () => {
                  if(analyzerRef.current) analyzerRef.current.cleanup();
            }
      }, []);

      const startMic = useCallback(async () => {
            try {
                  const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                  streamRef.current = stream;
                  if(analyzerRef.current) analyzerRef.current.initMic(stream);
                  return true;
            } catch (err) {
                  console.error("Lỗi Microphone:", err);
                  alert("Vui lòng cấp quyền Microphone trên trình duyệt để quẩy!");
                  return false;
            }
      }, []);

      const stopMic = useCallback(() => {
            if(streamRef.current) {
                  streamRef.current.getTracks().forEach(track => track.stop());
                  streamRef.current = null;
            }
      }, []);

      const initAudio = useCallback((audioElement) => {
            stopMic();
            if(analyzerRef.current && audioElement) analyzerRef.current.init(audioElement);
      }, []);

      const resumeAudio = useCallback(() => {
            if(analyzerRef.current) analyzerRef.current.resume();
      }, []);

      return { analyzerRef ,initAudio, resumeAudio, startMic, stopMic };
}