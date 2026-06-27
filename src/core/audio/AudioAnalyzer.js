export class AudioAnalyzer {
      constructor() {
            this.audioContext = null;
            this.analyser = null;
            this.source = null;
            this.dataArray = null;

            this.audioData = {
                  bass: 0,
                  mid: 0,
                  treble: 0,
            };
      }

      init(audioElement){
            // Khởi tạo Audio Context (Chỉ được gọi khi User click/tương tác trên UI)
            if(!this.audioContext){
                  const AudioContext = window.AudioContext || window.webkitAudioContext;
                  this.audioContext = new AudioContext();

                  this.analyser = this.audioContext.createAnalyser();
                  // Cắt phổ âm thanh thành 128 (fftSize/2) dải tần số
                  this.analyser.fftSize = 256;

                  const bufferLength = this.analyser.frequencyBinCount;
                  this.dataArray = new Uint8Array(bufferLength);
                  
                  // Kết nối HTML5 Audio Node vào Analyser, rồi kết nối ra loa (Destination)
                  this.source = this.audioContext.createMediaElementSource(audioElement);
                  this.source.connect(this.analyser);
                  this.analyser.connect(this.audioContext.destination);
            }
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

            this.audioData.bass = bassSum / 10 / 255;
            this.audioData.mid = midSum / 39 / 255;
            this.audioData.treble = trebleSum / 50 / 255;

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