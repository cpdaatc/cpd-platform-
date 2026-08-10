import { classifyExtractionConfidence, type ExtractionStatus } from './service';

export type ExtractedPageText = { pageNumber: number; text: string };
export type MappedExtractionField = { fieldKey:string; rawValue:string|null; normalizedValue:string|null; pageNumber:number|null; confidence:number; status:ExtractionStatus };
export type NativeExtractionQuality = { requiresFallback:boolean; reason:string|null; totalTextLength:number; recognizedFields:number; uncertainFields:number; suggestedEngine:'MANUAL'|'OCR' };

export async function extractNativePdfText(data:Uint8Array):Promise<ExtractedPageText[]>{
  const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs'); const loadingTask=pdfjs.getDocument({data}); const document=await loadingTask.promise; const pages:ExtractedPageText[]=[];
  for(let pageNumber=1;pageNumber<=document.numPages;pageNumber+=1){const page=await document.getPage(pageNumber);const textContent=await page.getTextContent();const text=textContent.items.map(item=>('str' in item?item.str:'')).filter(Boolean).join('\n');pages.push({pageNumber,text});}
  return pages;
}

const fieldLabels:Array<{fieldKey:string;labels:string[]}>=[
  {fieldKey:'titleEn',labels:['Activity Title in English']},{fieldKey:'titleAr',labels:['Activity Title in Arabic']},{fieldKey:'specialty',labels:['Specialty']},
  {fieldKey:'targetAudience',labels:['What is the intended target audience of the activity']},{fieldKey:'learningGap',labels:['What learning needs or gap']},
  {fieldKey:'aimAndOutcomes',labels:['What is the aim(s) and learning outcome(s) of the activity']},{fieldKey:'learningMethods',labels:['What learning methods/ delivery format were selected']},
  {fieldKey:'participantEvaluationMethod',labels:['How to evaluate group and individual activity by participants']},{fieldKey:'scfhsRegistrationNumber',labels:['SCFHS Registration #']},
];
function normalizeLine(line:string){return line.replace(/\s+/g,' ').replace(/[*?]+/g,'').trim();}
function isKnownLabel(line:string){const normalized=normalizeLine(line).toLowerCase();return fieldLabels.some(({labels})=>labels.some(label=>normalized.includes(normalizeLine(label).toLowerCase())));}
function extractValue(lines:string[],labels:string[]):string|null{const normalizedLabels=labels.map(label=>normalizeLine(label).toLowerCase());const labelIndex=lines.findIndex(line=>{const normalized=normalizeLine(line).toLowerCase();return normalizedLabels.some(label=>normalized.includes(label));});if(labelIndex<0)return null;for(let index=labelIndex+1;index<Math.min(lines.length,labelIndex+8);index+=1){const candidate=normalizeLine(lines[index]);if(!candidate)continue;if(isKnownLabel(candidate))return null;if(/^(YES|NO|English|Arabic)$/i.test(candidate))continue;return candidate;}return null;}

export function mapOfficialFormText(text:string):MappedExtractionField[]{const lines=text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);return fieldLabels.map(({fieldKey,labels})=>{const value=extractValue(lines,labels);const confidence=value?0.86:0.4;return{fieldKey,rawValue:value,normalizedValue:value,pageNumber:null,confidence,status:classifyExtractionConfidence(confidence)};});}
export function mapOfficialFormPages(pages:ExtractedPageText[]):MappedExtractionField[]{const mapped=mapOfficialFormText(pages.map(page=>page.text).join('\n'));return mapped.map(field=>{if(!field.normalizedValue)return field;const page=pages.find(candidate=>candidate.text.includes(field.normalizedValue??''));return{...field,pageNumber:page?.pageNumber??null};});}

export function assessNativeExtractionQuality(pages:ExtractedPageText[],fields:MappedExtractionField[]):NativeExtractionQuality{
  const totalTextLength=pages.reduce((sum,page)=>sum+page.text.replace(/\s+/g,'').length,0);
  const recognizedFields=fields.filter(field=>Boolean(field.normalizedValue)&&field.status!=='UNCERTAIN').length;
  const uncertainFields=fields.filter(field=>field.status==='UNCERTAIN').length;
  if(totalTextLength<120)return{requiresFallback:true,reason:'Native PDF text layer is absent or too sparse for reliable structured extraction.',totalTextLength,recognizedFields,uncertainFields,suggestedEngine:'OCR'};
  if(recognizedFields<3)return{requiresFallback:true,reason:'Native text exists, but too few expected fields could be located reliably. Human verification or approved OCR/vision processing is required.',totalTextLength,recognizedFields,uncertainFields,suggestedEngine:'MANUAL'};
  return{requiresFallback:false,reason:null,totalTextLength,recognizedFields,uncertainFields,suggestedEngine:'MANUAL'};
}
