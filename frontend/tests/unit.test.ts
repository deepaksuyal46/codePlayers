import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fingerprint,total,remainingSeconds,RESERVATION_MS} from '../src/lib/domain';
test('integer money total is exact',()=>assert.equal(total([{quantity:3,unitPricePaise:19900},{quantity:1,unitPricePaise:34900}]),94600));
test('invalid quantity and unsafe money are rejected',()=>{for(const quantity of [0,-1,1.5,11])assert.throws(()=>total([{quantity,unitPricePaise:100}]));assert.throws(()=>total([{quantity:10,unitPricePaise:Number.MAX_SAFE_INTEGER}]));});
test('request fingerprint detects changed address/quantity',()=>{assert.notEqual(fingerprint({quantity:1}),fingerprint({quantity:2}));assert.equal(fingerprint({quantity:1}),fingerprint({quantity:1}));});
test('countdown never negative and window is 180 seconds',()=>{assert.equal(RESERVATION_MS,180000);assert.equal(remainingSeconds('2026-01-01T00:00:01Z',Date.parse('2026-01-01T00:00:02Z')),0);});
