import test from 'node:test';
import assert from 'node:assert/strict';
import { storyPose, stabilizationPose, flightPose } from '../js/aerial/choreography.mjs';

const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
test('opening preserves the hero composition and patrol progress is bounded', () => {
    const start = storyPose(0, 1.5);
    assert.deepEqual(start.position, [3.8, 10.85, 5.6]);
    assert.deepEqual(start.target, [1.6, 10.2, 1]);
    assert.ok(distance(flightPose(0).position, flightPose(.001).position) < .001);
    assert.deepEqual(storyPose(-1, 1.5), start);
    assert.deepEqual(storyPose(2, 1.5), storyPose(1, 1.5));
});
test('curved camera and look target retain continuous velocity across authored shot joins', () => {
    const h = .00001;
    for (const aspect of [.4, .75, 1, 1.5, 2]) {
        for (const u of [.14, .38, .68]) for (const key of ['position', 'target']) {
            const a = storyPose(u-h, aspect)[key], b = storyPose(u, aspect)[key], c = storyPose(u+h, aspect)[key];
            const left = b.map((v,i)=>(v-a[i])/h), right = c.map((v,i)=>(v-b[i])/h);
            assert.ok(distance(left,right)<.2, `${aspect}/${u}/${key}: derivative discontinuity`);
        }
        for (let i=0;i<=1000;i++) {
            const pose=storyPose(i/1000,aspect);
            assert.ok([...pose.position,...pose.target].every(Number.isFinite));
            assert.ok(pose.position[1]>=6);
            assert.ok(distance(pose.position,pose.target)>2.5);
        }
    }
    const a=storyPose(.17,1.5).position,b=storyPose(.22,1.5).position,c=storyPose(.27,1.5).position;
    const ab=b.map((v,i)=>v-a[i]),bc=c.map((v,i)=>v-b[i]);
    assert.ok(Math.hypot(ab[1]*bc[2]-ab[2]*bc[1],ab[2]*bc[0]-ab[0]*bc[2],ab[0]*bc[1]-ab[1]*bc[0])>.01,'journey is not a straight-segment dolly');
});
test('stabilization is deterministic, subtle and absent under reduced motion', () => {
    for(let t=0;t<100;t+=.17){
        const pose=stabilizationPose(t,false);
        assert.deepEqual(pose,stabilizationPose(t,false));
        assert.ok(pose.position.every(v=>Math.abs(v)<=.025));
        assert.ok(pose.rotation.every(v=>Math.abs(v)<=.009));
        assert.deepEqual(stabilizationPose(t,true),{position:[0,0,0],rotation:[0,0,0]});
    }
    assert.notDeepEqual(stabilizationPose(0,false),stabilizationPose(1,false));
});

test('patrol moves around the property with continuous heading and eases into both endpoints', () => {
    const start=flightPose(0),end=flightPose(1);
    assert.ok(distance(start.position,end.position)>15);
    assert.ok(distance(end.position,flightPose(.999).position)<.001);
    for(let i=0;i<=1000;i++) {
        const u=i/1000,a=flightPose(u),b=flightPose(Math.min(1,u+.001));
        assert.ok(a.position[1]>=10.5, 'flight stays above architecture and planting');
        assert.ok(distance(a.position,b.position)<.18);
        assert.ok(Math.abs(a.heading-b.heading)<.012, 'no heading wrap');
        const tangentLength=Math.hypot(...a.tangent);
        assert.ok(Math.abs(Math.sin(a.heading)-a.tangent[0]/tangentLength)<1e-10);
        assert.ok(Math.abs(Math.cos(a.heading)-a.tangent[2]/tangentLength)<1e-10);
        assert.deepEqual(flightPose(u,true),start);
        assert.deepEqual(a,flightPose(u));
    }
});
