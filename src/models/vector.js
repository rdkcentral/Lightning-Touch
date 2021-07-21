export const createVector = (x = 0.0, y = 0.0)=>{
    return {
        add(v) {
            return createVector(x + v.x, y + v.y)
        },
        subtract(v) {
            return createVector(x - v.x, y - v.y)
        },
        get x(){
            return x;
        },
        get y(){
            return y;
        }
    }
}
export default createVector;