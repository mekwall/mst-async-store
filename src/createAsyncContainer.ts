import {
  types,
  IAnyModelType,
  isAlive,
  getParent,
  Instance,
  hasParent,
  IModelType,
  ISimpleType,
  IMaybe,
  ModelPropertiesDeclarationToProperties,
} from 'mobx-state-tree';
import { now } from 'mobx-utils';
import nextTick from 'next-tick';

export interface VolatileAsyncContainerState {
  isReady: boolean;
  isPending: boolean;
  error?: Error;
  lastModified: number;
  expiresAt: number;
}

export interface AsyncContainerOptions<T> {
  ttl?: number;
  failstateTtl?: number;
  fetch?(id?: string): PromiseLike<Instance<T>>;
  name?: string;
}

export type AsyncContainerModel<I extends IAnyModelType> = IModelType<
  ModelPropertiesDeclarationToProperties<{
    id: ISimpleType<string>;
    _value: IMaybe<I>;
  }>,
  VolatileAsyncContainerState & {
    getFailstate(): undefined | Error;
    clearFailstate(): void;
    readonly hasExpired: boolean;
    setReady(): void;
    setPending(): void;
    setFailstate(e: Error): void;
    setValue(value: Instance<IAnyModelType>): void;
    readonly inFailstate: boolean;
    readonly shouldFetch: boolean;
    readonly value: undefined | Instance<IAnyModelType>;
  }
>;

export function createAsyncContainer<T extends IAnyModelType>(
  ItemModel: T,
  options: AsyncContainerOptions<T> = {}
) {
  const {
    name = 'AnonymousAsyncContainer',
    ttl = 0,
    failstateTtl = 10000,
  } = options;
  return types
    .model(name, {
      id: types.identifier,
      _value: types.maybe(ItemModel),
    })
    .volatile<VolatileAsyncContainerState>(() => ({
      isReady: false,
      isPending: false,
      error: undefined,
      lastModified: Date.now(),
      expiresAt: 0,
    }))
    .views((self) => ({
      getFailstate: () => {
        return self.error;
      },
      get hasExpired() {
        return (
          self.expiresAt > 0 && now(ttl < 1000 ? ttl : 1000) >= self.expiresAt
        );
      },
    }))
    .actions((self) => ({
      setReady() {
        self.isPending = false;
        self.isReady = true;
      },
      setPending() {
        self.error = undefined;
        self.isPending = true;
      },
      setFailstate(e: Error) {
        self.isPending = false;
        self.isReady = true;
        self.error = e;
        self.lastModified = Date.now();
        self.expiresAt =
          failstateTtl > 0 ? self.lastModified + failstateTtl : 0;
      },
      clearFailstate: () => {
        self.error = undefined;
        self.expiresAt = Date.now() - 1;
      },
    }))
    .actions((self) => ({
      setValue: (value: Instance<typeof ItemModel>) => {
        if (!isAlive(self)) {
          throw new Error('Trying to set value on a dead container');
        }
        self.error = undefined;
        self.isPending = false;
        self.isReady = true;
        // FIXME: Why are types not compatible?
        (self as any)._value = value;
        self.lastModified = Date.now();
        self.expiresAt = ttl > 0 ? self.lastModified + ttl : 0;
      },
    }))
    .views((self) => ({
      get inFailstate() {
        if (failstateTtl > 0) {
          return !!self.error && !self.hasExpired;
        } else {
          return !!self.error;
        }
      },
    }))
    .views((self) => ({
      get shouldFetch() {
        return (
          !self.isPending &&
          (!self.isReady || self.hasExpired) &&
          !self.inFailstate &&
          isAlive(self)
        );
      },
    }))
    .views((self) => ({
      get value() {
        if (self.shouldFetch) {
          // Hack to allow side-effects in a view
          nextTick(() => {
            // Need to check shouldFetch again to avoid race-conditions
            // This is cheap since it's memoized
            if (self.shouldFetch) {
              if (hasParent(self, 2)) {
                const parent: any = getParent(self, 2);
                if (parent.fetchOne) {
                  parent.fetchOne(self.id);
                } else if (parent.fetchMany) {
                  parent.fetchMany([self.id]);
                }
              } else if (options.fetch) {
                options.fetch(self.id).then((result) => {
                  self.setValue(result);
                });
              }
            }
          });
        }
        return self._value;
      },
    }));
}
