import { observable, reaction, values } from 'mobx';
import {
  addDisposer,
  applySnapshot,
  flow,
  getSnapshot,
  IAnyModelType,
  Instance,
  ModelInstanceType,
  types,
} from 'mobx-state-tree';
import asap from 'asap';
import { createAsyncContainer } from './createAsyncContainer';

export type AsyncFetchActions<T> = (
  self: ModelInstanceType<any, any, any, any>
) => {
  fetchOne?(id: string): Promise<Instance<T> | undefined>;
  fetchMany?(ids: string[]): Promise<Array<Instance<T>>>;
  fetchAll?(): Promise<Array<Instance<T>>>;
};

export interface VolatileAsyncStoreState {
  isPending: boolean;
  isReady: boolean;
  fetchQueue: string[];
}

export function createAsyncStore<T extends IAnyModelType>(
  name: string,
  ItemModel: T,
  fetchActions?: AsyncFetchActions<T>,
  options = {
    ttl: 0,
    failstateTtl: 10000,
  }
) {
  const AsyncContainer = createAsyncContainer<T>(ItemModel, options);
  type AsyncContainerShape = Instance<typeof AsyncContainer>;

  return types
    .model(name, {
      containers: types.map(AsyncContainer),
    })
    .volatile<VolatileAsyncStoreState>(() => ({
      fetchQueue: observable.array<string>([]),
      isPending: false,
      isReady: false,
    }))
    .actions((self) => ({
      setReady() {
        self.isPending = false;
        self.isReady = true;
      },
      setPending() {
        self.isPending = true;
      },
      hotReload() {
        if (module.hot) {
          if (
            module.hot.data &&
            module.hot.data.stores &&
            module.hot.data.stores[name]
          ) {
            applySnapshot(self, module.hot.data.stores[name]);
          }
          module.hot.dispose((data: any) => {
            data.stores = data.stores || {};
            data.stores[name] = getSnapshot(self);
          });
        }
      },
    }))
    .actions((self) => {
      const client = fetchActions ? fetchActions(self) : {};
      return {
        spliceFetchQueue(start: number, end: number) {
          return self.fetchQueue.splice(start, end);
        },
        _fetchAll: flow(function*() {
          if (!client.fetchAll) {
            throw new Error("Store doesn't support fetchAll");
          }
          self.setPending();
          const items = yield client.fetchAll();
          if (items.length > 0) {
            items.forEach((item: any) => {
              const ct =
                self.containers.get(item.id) ||
                AsyncContainer.create({ id: item.id } as any);
              const idx = self.fetchQueue.indexOf(item.id);
              self.fetchQueue.splice(idx, 1);
              ct.setValue(item);
              self.containers.set(item.id, ct);
            });
          }
          self.setReady();
        }),
        _fetchMany: flow(function*(ids: string[]) {
          if (!client.fetchMany) {
            throw new Error("Store doesn't support fetchMany");
          }
          self.setPending();
          const cts = ids.map((id) => {
            const ct = self.containers.get(id)!;
            ct.setPending();
            return ct;
          });
          try {
            const items = yield client.fetchMany(ids);
            items.forEach((item: Instance<T>) => {
              const ct = self.containers.get(item.id)!;
              ct.setValue(item);
            });
          } catch (e) {
            cts.forEach((ct) => {
              ct.setFailstate(e);
            });
          }
          self.setReady();
        }),
        _fetchOne: flow(function*(id: string) {
          if (!client.fetchOne) {
            throw new Error("Store doesn't support fetchOne");
          }
          self.setPending();
          const ct = self.containers.get(id)!;
          try {
            const item = yield client.fetchOne(id);
            ct.setValue(item);
          } catch (e) {
            ct.setFailstate(e);
          }
          self.setReady();
        }),
      };
    })
    .actions((self) => {
      return {
        createAsyncContainer(id: string) {
          return AsyncContainer.create({ id } as any);
        },
        afterCreate() {
          addDisposer(
            self,
            reaction(
              () => !self.isPending && self.fetchQueue.length > 0,
              (shouldFetch: boolean) => {
                if (shouldFetch) {
                  // Prioratize fetching all
                  const fetchAllIndex = self.fetchQueue.indexOf('*');
                  if (fetchAllIndex !== -1) {
                    self.spliceFetchQueue(fetchAllIndex, 1);
                    self._fetchAll();
                  } else {
                    // Batch 40 items at a time
                    const idsToFetch = self.spliceFetchQueue(0, 40);
                    if (idsToFetch.length === 1) {
                      self._fetchOne(idsToFetch[0]);
                    } else {
                      self._fetchMany(idsToFetch);
                    }
                  }
                }
              },
              // Throttle fetching by 200ms
              { delay: 200, fireImmediately: true }
            )
          );
        },
      };
    })
    .actions((self) => {
      return {
        fetchOne(id: string, ct?: any) {
          ct =
            ct ||
            self.containers.get(id) ||
            AsyncContainer.create({ id } as any);
          self.containers.set(id, ct);
          if (ct.shouldFetch && !self.fetchQueue.includes(id)) {
            self.fetchQueue.push(id);
          }
        },
        fetchMany(ids: string[], cts?: any[]) {
          if (cts) {
            cts.forEach((ct) => {
              if (ct.shouldFetch && !self.containers.has(ct.id)) {
                self.containers.set(ct.id, ct);
              }
            });
          }
          self.fetchQueue.push(...ids.filter((id) => self.containers.has(id)));
        },
        fetchAll() {
          if (!self.fetchQueue.includes('*')) {
            self.fetchQueue.push('*');
          }
        },
      };
    })
    .views((self) => ({
      getOne(id: string) {
        const ct =
          self.containers.get(id) || AsyncContainer.create({ id } as any);
        if (ct.shouldFetch && !self.containers.has(id)) {
          // Hack to fool mobx into allowing side-effects in a view
          asap(() => {
            self.fetchOne(id, ct);
          });
        }
        return ct;
      },
      getMany(ids: string[]) {
        const cts = ids.map(
          (id) =>
            self.containers.get(id) || AsyncContainer.create({ id } as any)
        );
        const ctsToFetch = cts.filter((ct) => ct && ct.shouldFetch);
        if (ctsToFetch.length > 0) {
          // Hack to fool mobx into allowing side-effects in a view
          asap(() => {
            self.fetchMany(ids, ctsToFetch);
          });
        }
        return cts as AsyncContainerShape[];
      },
      getAll() {
        if (!self.isReady) {
          // Hack to fool mobx into allowing side-effects in a view
          asap(() => {
            self.fetchAll();
          });
        }
        return values(self.containers) as AsyncContainerShape[];
      },
    }));
}
