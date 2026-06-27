import { PHYSICS } from "../constants";

export class SpatialHash {
      constructor(canvasWidth, canvasHeight) {
            this.cellSize = PHYSICS.SPATIAL_CELL_SIZE;
            this.cols = Math.ceil(canvasWidth / this.cellSize);
            this.rows = Math.ceil(canvasHeight / this.cellSize);

            this.grid = new Map();
      }

      _hash(x,y) {
            const col = Math.floor(x / this.cellSize);
            const row = Math.floor(y / this.cellSize);
            return this.cols * row + col;
      }

      clear(){
            this.grid.clear();
      }

      insert(particle) {
            const key = this._hash(particle.x, particle.y);
            if (!this.grid.has(key)) {
                  this.grid.set(key, []);
            }
            this.grid.get(key).push(particle);
      }

      query(particle){
            const col = Math.floor(particle.x / this.cellSize);
            const row = Math.floor(particle.y / this.cellSize);
      
            const neighbors = [];

            for(let i = -1; i <= 1 ; ++i){
                  for(let j = -1; j <= 1; ++j){
                        const checkCol = col + i;
                        const checkRow = row + j;

                        if(checkCol < 0 || checkCol >= this.cols || checkRow < 0 || checkRow >= this.rows) continue;
                        
                        const key = this.cols * checkRow + checkCol;
                        if(this.grid.has(key)){
                              neighbors.push(...this.grid.get(key));
                        }
                  }
            }

            return neighbors;
      }
}