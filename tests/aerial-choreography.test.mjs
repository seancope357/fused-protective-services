import test from 'node:test';
import assert from 'node:assert/strict';
import { storyPose, sensorEnvelope, arrivalWeight, stabilizationPose } from '../js/aerial/choreography.mjs';

const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
test('opening keeps the approved hero while allowing a restrained orbit before the reveal', () => {
    const start = storyPose(0, 1.5);
    assert.deepEqual(start.position, [3.8, 10.85, 5.6]);
    assert.deepEqual(start.target, [1.6, 10.2, 1]);
    assert.ok(distance(start.position, storyPose(.1, 1.5).position) < 2.5);
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
test('sensor reveal holds around arrival and remains bounded and reversible', () => {
    assert.equal(sensorEnvelope(0),0);assert.equal(sensorEnvelope(1),0);
    for(const u of [.64,2/3,.72,.78])assert.equal(sensorEnvelope(u),1);
    for(let i=0;i<=1000;i++){const u=i/1000;assert.ok(sensorEnvelope(u)>=0&&sensorEnvelope(u)<=1);assert.equal(sensorEnvelope(u),sensorEnvelope(u));}
    assert.equal(arrivalWeight(0,0),1);assert.equal(arrivalWeight(20,10),0);
    assert.ok(arrivalWeight(.5,.2)>arrivalWeight(3,2));
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
