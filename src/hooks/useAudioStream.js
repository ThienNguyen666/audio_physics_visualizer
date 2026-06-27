import {useRef, useEffect, useCallback} from 'react';
import { AudioAnalyzer } from '../core/audio/AudioAnalyzer';

export const useAudioStream = () => {
      const analyzerRef = useRef(null);

      useEffect(() => {
            analyzerRef.current = new AudioAnalyzer();
            
            return () => {
                  if(analyzerRef.current) analyzerRef.current.cleanup();
            }
      }, []);

      const initAudio = useCallback((audioElement) => {
            if(analyzerRef.current && audioElement) analyzerRef.current.init(audioElement);
      }, []);

      const resumeAudio = useCallback(() => {
            if(analyzerRef.current) analyzerRef.current.resume();
      }, []);

      return {analyzerRef ,initAudio, resumeAudio};
}