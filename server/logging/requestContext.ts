import { AsyncLocalStorage } from "node:async_hooks";

const requestStorage = new AsyncLocalStorage<{ requestId: string }>();

export function runWithRequestId<T>(requestId: string, callback: () => T): T {
  return requestStorage.run({ requestId }, callback);
}

export function getRequestId(): string | undefined {
  return requestStorage.getStore()?.requestId;
}
