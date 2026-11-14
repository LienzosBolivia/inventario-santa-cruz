import {test} from 'node:test';import assert from 'node:assert/strict';import {encode,decode,PRE,crc16} from '../piloto/codec.js';
test('CRC vector conocido',()=>assert.equal(crc16(new TextEncoder().encode('123456789')),0x29b1));
test('todos los IDs y tipos conservan campos',()=>{for(let id=1;id<=64;id++)for(let type=1;type<=3;type++)for(const session of [0,1,0xffffffff,0x12345678]){const p={type,session,id,seq:65535};assert.deepEqual(decode(encode(p).slice(PRE.length)),p);}});
test('cada bit de la trama protegido por CRC rechaza alteración',()=>{const p={type:2,session:54827,id:7,seq:149};const payload=encode(p).slice(PRE.length);for(let bit=0;bit<80;bit++){const changed=[...payload];changed[Math.floor(bit/3)]^=1<<(2-bit%3);assert.equal(decode(changed),null);}});
test('trama incompleta rechazada',()=>assert.equal(decode([1,2,3]),null));
