// Authored shot timing, not scroll interception: native scrolling remains the clock.
// Shape-preserving cubic Hermite interpolation keeps velocity continuous at joins
// without spline overshoot through architecture or an artificial stop per chapter.
const times = [0, .14, .38, .68, 1];
// Camera offsets relative to the aircraft: the subject remains foreground-sized.
const desktop = [
    { position: [1.3,.35,4.6], target: [-.9,-.3,0] },
    { position: [3,2,6], target: [-1.5,-.6,.5] },
    { position: [5,4,7], target: [-2,-.6,1] },
    { position: [5,3,6], target: [-1.8,-.5,1] },
    { position: [2,1.2,5], target: [-1.2,-.3,.3] }
];
const portrait = [
    { position: [1.3,.35,9], target: [-.1,-1.7,-1] },
    { position: [3,3,11], target: [-.2,-2.8,-1] },
    { position: [4,4,12], target: [-.3,-3.2,-1] },
    { position: [4,3,11], target: [-.2,-3,-1] },
    { position: [2,1.5,10], target: [-.1,-2.4,-1] }
];
const clamp = value => Number.isFinite(value) ? Math.max(0,Math.min(1,value)) : 0;
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
        return a+(b-a)*mix+flightPose(u).position[axis];
    })]));
}
export function stabilizationPose(time,reduced=false) {
    if(reduced||!Number.isFinite(time))return {position:[0,0,0],rotation:[0,0,0]};
    return {
        position:[.006*Math.sin(time*.43),.012*Math.sin(time*.7)+.003*Math.sin(time*1.31),.004*Math.sin(time*.37)],
        rotation:[.003*Math.sin(time*.37),.002*Math.sin(time*.18),.004*Math.sin(time*.43)]
    };
}

// A broad, continuous patrol above the house and the tallest perimeter planting.
// Smoothstep eases out of the opening hover and into the final inquiry composition.
export function flightPose(progress, reduced = false) {
    const u = reduced ? 0 : clamp(progress), eased = u*u*(3-2*u);
    const angle = eased * Math.PI * 1.7;
    const dx = 20*Math.cos(angle), dz = -15*Math.sin(angle);
    // Unwrapped heading avoids a 360-degree spin at the atan2 branch cut.
    const heading = Math.PI/2 + angle + Math.atan2(-5*Math.sin(angle)*Math.cos(angle), 20*Math.cos(angle)**2+15*Math.sin(angle)**2);
    return { position: [2.5+20*Math.sin(angle), 10.5+2*Math.sin(Math.PI*u)**2, -14+15*Math.cos(angle)],
        heading, tangent: [dx, 0, dz] };
}
