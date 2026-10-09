'use client';
import {useState,type ComponentProps} from 'react';
const fallback='/products/dataset-placeholder.svg';
export default function ProductImage({src,alt,...props}:ComponentProps<'img'>){
 const [failed,setFailed]=useState<string>();
 return <img {...props} src={failed===src?fallback:src} alt={alt||'Product image'} onError={()=>setFailed(typeof src==='string'?src:undefined)} />;
}
