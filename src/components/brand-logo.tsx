'use client';

import { useEffect, useState } from 'react';

export function BrandLogo({className='',alt='شعار منصة التطوير المهني المستمر'}:{className?:string;alt?:string}){
  const [src,setSrc]=useState<string|null>(null);
  useEffect(()=>{
    let alive=true;
    fetch('/brand/cpd-logo.txt',{cache:'force-cache'})
      .then(response=>{if(!response.ok)throw new Error('logo');return response.text();})
      .then(base64=>{if(alive)setSrc(`data:image/jpeg;base64,${base64.trim()}`);})
      .catch(()=>{if(alive)setSrc(null);});
    return()=>{alive=false};
  },[]);
  return <span className={`inline-grid place-items-center overflow-hidden ${className}`} aria-label={alt}>{src?<img src={src} alt={alt} className="h-full w-full object-contain"/>:<span className="h-full w-full animate-pulse rounded-[inherit] bg-teal-50" aria-hidden="true"/>}</span>;
}
