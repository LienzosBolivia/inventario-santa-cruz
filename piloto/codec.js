export const SYMBOL=.10, PRE=[0,7,0,7,0,7,2,5,1,6], TYPES={POLL:1,REPLY:2,ACK:3};
export function crc16(bytes){let c=0xffff;for(const b of bytes){c^=b<<8;for(let i=0;i<8;i++)c=c&0x8000?(c<<1)^0x1021:c<<1;c&=65535;}return c;}
// 10 bytes: version/type, session(32), ID, request sequence(16), CRC(16).
export function encode(p){const b=new Uint8Array(10),v=new DataView(b.buffer);b[0]=0x10|p.type;v.setUint32(1,p.session);b[5]=p.id;v.setUint16(6,p.seq);v.setUint16(8,crc16(b.slice(0,8)));const out=[];let bits=0,n=0;for(const x of b){bits=(bits<<8)|x;n+=8;while(n>=3){n-=3;out.push((bits>>>n)&7);}}if(n)out.push((bits<<(3-n))&7);return [...PRE,...out];}
export function decode(s){if(s.length!==27)return null;const b=[];let bits=0,n=0;for(const x of s){bits=(bits<<3)|x;n+=3;while(n>=8){n-=8;b.push((bits>>>n)&255);}}const a=Uint8Array.from(b),v=new DataView(a.buffer);if((a[0]>>4)!==1||![1,2,3].includes(a[0]&15)||a[5]<1||a[5]>64||v.getUint16(8)!==crc16(a.slice(0,8)))return null;return {type:a[0]&15,session:v.getUint32(1),id:a[5],seq:v.getUint16(6)};}
export const PACKET_MS=encode({type:1,session:1,id:1,seq:1}).length*SYMBOL*1000;
