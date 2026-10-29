import type { AnswerEvent } from './study';
import type { Question } from './question';
export type CloudCache = { questions?: Question[]; confirmed: AnswerEvent[]; pending: AnswerEvent[] };
let dbPromise: Promise<IDBDatabase> | undefined;
function database() {
  return dbPromise ??= new Promise<IDBDatabase>((resolve,reject)=>{
    const req=indexedDB.open('weather-study-cloud-v1',1);
    req.onupgradeneeded=()=>req.result.createObjectStore('accounts');
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>{dbPromise=undefined;reject(req.error);};
    req.onblocked=()=>{dbPromise=undefined;reject(new Error('他のタブを閉じてください'));};
  });
}
export async function readCache(userId: string): Promise<CloudCache> {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('accounts','readonly');const req=tx.objectStore('accounts').get(userId);
    tx.oncomplete=()=>resolve(req.result ?? {confirmed:[],pending:[]});tx.onabort=()=>reject(tx.error);
  });
}
// All cache/queue modifications read and write within one serializable IDB transaction.
export async function editCache(userId: string, edit: (cache: CloudCache)=>CloudCache): Promise<CloudCache> {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('accounts','readwrite');const store=tx.objectStore('accounts');const req=store.get(userId);
    let next: CloudCache;
    req.onsuccess=()=>{next=edit(req.result ?? {confirmed:[],pending:[]});store.put(next,userId);};
    tx.oncomplete=()=>resolve(next);tx.onabort=()=>reject(tx.error);
  });
}
export function enqueue(cache: CloudCache, event: AnswerEvent): CloudCache {
  if ([...cache.confirmed,...cache.pending].some(e=>e.id===event.id)) return cache;
  return {...cache,pending:[...cache.pending,event]};
}
export function reconcile(cache: CloudCache, confirmed: AnswerEvent[]): CloudCache {
  // Another tab may already have confirmed a newer event while this download was in flight.
  const merged=new Map(cache.confirmed.map(e=>[e.id,e]));
  for(const event of confirmed)merged.set(event.id,event);
  const ordered=[...merged.values()].sort((a,b)=>(a.serverOrder ?? 0)-(b.serverOrder ?? 0));
  return {...cache,confirmed:ordered,pending:cache.pending.filter(e=>!merged.has(e.id))};
}
export function visibleEvents(cache: CloudCache): AnswerEvent[] {
  const ids=new Set(cache.confirmed.map(e=>e.id));
  return [...cache.confirmed,...cache.pending.filter(e=>!ids.has(e.id))];
}
