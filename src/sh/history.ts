export const decodeHistory=(src:string):string[]=>src.replace(/\r\n/g,"\n").replace(/\r/g,"\n").split("\n").filter(Boolean).map(line=>{try{const x:unknown=JSON.parse(line);return typeof x==="string"?x:line;}catch{return line;}});
export const encodeHistory=(entries:readonly string[]):string=>entries.map(x=>JSON.stringify(x)).join("\n")+(entries.length?"\n":"");
export const historyMatches=(entries:readonly string[],prefix:string,caseSensitive:boolean):string[]=>{
  if(!prefix)return[]; const needle=caseSensitive?prefix:prefix.toLocaleLowerCase(); const out:string[]=[]; const seen=new Set<string>();
  for(let i=entries.length-1;i>=0;i--){const entry=entries[i]!;if(entry.includes("\n"))continue;const candidate=caseSensitive?entry:entry.toLocaleLowerCase();if(!candidate.startsWith(needle)||entry===prefix||seen.has(entry))continue;seen.add(entry);out.push(entry);}return out;
};
const esc=(x:string):string=>x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
export const globMatches=(pattern:string,value:string):boolean=>{let rx="^";for(const c of pattern)rx+=c==="*"?".*":c==="?"?".":esc(c);try{return new RegExp(rx+"$").test(value);}catch{return false;}};
