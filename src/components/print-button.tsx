'use client';

export function PrintButton({label='طباعة / حفظ PDF'}:{label?:string}){
  return <button type="button" onClick={()=>window.print()} className="no-print rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-black text-white">🖨 {label}</button>;
}
