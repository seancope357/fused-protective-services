// Authored shot timing, not scroll interception: native scrolling remains the clock.
// Shape-preserving cubic Hermite interpolation keeps velocity continuous at joins
// without spline overshoot through architecture or an artificial stop per chapter.
const times = [0, .14, .38, .68, 1];
const desktop = [
    { position: [3.8,10.85,5.6], target: [1.6,10.2,1] },
    { position: [5.6,11.1,6.1], target: [2,10.2,.8] },
    { position: [16,13,26], target: [0,3,-8] },
    { position: [25,23,24], target: [0,1,-9] },
    { position: [36,34,40], target: [0,0,-7] }
];
const portrait = [
    { position: [3.8,10.85,10], target: [2.5,8.7,1] },
    { position: [5.4,11.7,11], target: [2.4,8.8,0] },
    { position: [25,24,39], target: [0,2,-8] },
    { position: [33,38,39], target: [0,1,-9] },
    { position: [42,47,53], target: [0,0,-7] }
];
const clamp = value => Number.isFinite(value) ? Math.max(0,Math.min(1,value)) : 0;
const smooth = value => { const t=clamp(value); return t*t*(3-2*t); };
function compile(shots) {
    return Object.fromEntries(['position','target'].map(key=>[key,[0,1,2].map(axis=>{
        const values=shots.map(shot=>shot[key][axis]);
        const h=times.slice(1).map((t,i)=>t-times[i]);
        const secants=h.map((width,i)=>(values[i+1]-values[i])/width);
        const slopes=values.map((_,i)=>{
            if(i===0)return secants[0];
            if(i===values.length-1)return secants.at(-1);
            const a=secants[i-1],b=secants[i];
            if(a*b<=0)return 0;
            const w1=2*h[i]+h[i-1],w2=h[i]+2*h[i-1];
            return (w1+w2)/(w1/a+w2/b);
        });
        return {values,slopes};
    })]));
}
const paths = [compile(desktop),compile(portrait)];
function sample(path,key,axis,index,t) {
    const {values,slopes}=path[key][axis], h=times[index+1]-times[index];
    const t2=t*t,t3=t2*t;
    return (2*t3-3*t2+1)*values[index]+(t3-2*t2+t)*h*slopes[index]
        +(-2*t3+3*t2)*values[index+1]+(t3-t2)*h*slopes[index+1];
}
export function storyPose(progress,aspect=1.5) {
    const u=clamp(progress);
    let index=times.findIndex((t,i)=>i<times.length-1&&u>=t&&u<times[i+1]);
    if(index<0)index=times.length-2;
    const t=(u-times[index])/(times[index+1]-times[index]);
    const mix=clamp((1.2-aspect)/.5);
    return Object.fromEntries(['position','target'].map(key=>[key,[0,1,2].map(axis=>{
        const a=sample(paths[0],key,axis,index,t),b=sample(paths[1],key,axis,index,t);
        return a+(b-a)*mix;
    })]));
}
export function sensorEnvelope(progress) {
    const u=clamp(progress);
    return smooth((u-.50)/.14)*(1-smooth((u-.78)/.13));
}
export function arrivalWeight(positionError,targetError) {
    if(!Number.isFinite(positionError)||!Number.isFinite(targetError))return 0;
    return smooth((5-Math.hypot(positionError,targetError))/4.25);
}
export function stabilizationPose(time,reduced=false) {
    if(reduced||!Number.isFinite(time))return {position:[0,0,0],rotation:[0,0,0]};
    return {
        position:[.006*Math.sin(time*.43),.012*Math.sin(time*.7)+.003*Math.sin(time*1.31),.004*Math.sin(time*.37)],
        rotation:[.003*Math.sin(time*.37),.002*Math.sin(time*.18),.004*Math.sin(time*.43)]
    };
}
