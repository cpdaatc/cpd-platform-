import Image from 'next/image';

export function BrandLogo({className='',alt='شعار منصة التطوير المهني المستمر'}:{className?:string;alt?:string}){
  return <span className={`relative inline-grid place-items-center overflow-hidden ${className}`} aria-label={alt}>
    <Image
      src="/api/brand/logo"
      alt={alt}
      width={160}
      height={160}
      unoptimized
      className="h-full w-full object-contain"
    />
  </span>;
}
