export class AudioAnalyzer {
      constructor() {
            this.audioContext = null;
            this.analyser = null;
            this.fileSource = null;
            this.micSource = null;
            this.dataArray = null;

            this.audioData = {
                  bass: 0,
                  mid: 0,
                  treble: 0,
            };
      }
      _setupContext() {
            if(!this.audioContext){
                  const AudioContext = window.AudioContext || window.webkitAudioContext;
                  this.audioContext = new AudioContext();

                  this.analyser = this.audioContext.createAnalyser();
                  this.analyser.fftSize = 256;

                  const bufferLength = this.analyser.frequencyBinCount;
                  this.dataArray = new Uint8Array(bufferLength);
            }
      }

      // KHỞI TẠO TỪ FILE NHẠC (Có phát ra loa)
      init(audioElement) {
            this._setupContext();
            
            if (this.micSource) this.micSource.disconnect();
            
            if (!this.fileSource) {
                  this.fileSource = this.audioContext.createMediaElementSource(audioElement);
            }
            
            this.fileSource.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);
      }

      // KHỞI TẠO TỪ MICROPHONE (KHÔNG phát ra loa để chống hú tiếng dội)
      initMic(mediaStream) {
            this._setupContext();

            if (this.fileSource) this.fileSource.disconnect();
            if (this.micSource) this.micSource.disconnect();

            this.micSource = this.audioContext.createMediaStreamSource(mediaStream);
            this.micSource.connect(this.analyser);
            
            this.analyser.disconnect(); 
      }

      update(){
            if(!this.analyser || !this.dataArray) return this.audioData;

            this.analyser.getByteFrequencyData(this.dataArray);

            let bassSum = 0;
            for(let i = 0; i < 10; ++i){
                  bassSum += this.dataArray[i];
            }
            let midSum = 0;
            for(let i = 10; i < 50; ++i){
                  midSum += this.dataArray[i];
            }

            let trebleSum = 0;
            for(let i = 50 ; i < 100; ++i){
                  trebleSum += this.dataArray[i];
            }

            this.audioData.bass = bassSum / 2550;
            this.audioData.mid = midSum / 10200;
            this.audioData.treble = trebleSum / 12750;

            return this.audioData;
      };

      resume() {
            if(this.audioContext && this.audioContext.state === 'suspended') {
                  this.audioContext.resume();
            }
      }

      cleanup() {
            if(this.audioContext) {
                  this.audioContext.close();
            }
      }
}