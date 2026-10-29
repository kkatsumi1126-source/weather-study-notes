import type { AnswerEvent } from './study';
// Auto-increment keys define the committed order across tabs. Events are append-only.
let connection: Promise<IDBDatabase> | undefined;
function database(): Promise<IDBDatabase> {
  if (!connection) connection = new Promise((resolve, reject) => {
    const request = indexedDB.open('weather-study-notes-v1', 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore('answer_events', { autoIncrement: true });
      store.createIndex('event_id', 'id', { unique: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { connection = undefined; reject(request.error); };
    request.onblocked = () => { connection = undefined; reject(new Error('別のタブを閉じて再試行してください。')); };
  });
  return connection;
}
export async function loadEvents(): Promise<AnswerEvent[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('answer_events', 'readonly');
    const request = tx.objectStore('answer_events').getAll();
    tx.oncomplete = () => resolve(request.result as AnswerEvent[]);
    tx.onabort = () => reject(tx.error ?? new Error('履歴を読み込めませんでした。'));
  });
}
export async function saveEvent(event: AnswerEvent): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('answer_events', 'readwrite');
    const store = tx.objectStore('answer_events');
    const lookup = store.index('event_id').getKey(event.id);
    lookup.onsuccess = () => { if (lookup.result === undefined) store.add(event); };
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('履歴を保存できませんでした。'));
  });
}
