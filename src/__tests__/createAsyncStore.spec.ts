import { createAsyncStore } from '../createAsyncStore';
import { types } from 'mobx-state-tree';
import { when } from 'mobx';
import { createAsyncContainer } from '../createAsyncContainer';

const DummyModel = types.model('DummyModel', { id: types.identifier });

describe('createAsyncStore', () => {
  it('should create AsyncStore model', () => {
    const AsyncStore = createAsyncStore({
      name: 'AsyncStore',
      itemModel: DummyModel,
    });
    expect(AsyncStore.name).toBe('AsyncStore');
  });

  it('should create asyncStore instance', () => {
    const AsyncStore = createAsyncStore({
      name: 'AsyncStore',
      itemModel: DummyModel,
    });
    const asyncStore = AsyncStore.create();
    expect(asyncStore.isReady).toBe(false);
  });

  it('should fetch one item', async () => {
    const dummyItem = DummyModel.create({ id: 'foo' });
    const AsyncStore = createAsyncStore({
      name: 'AsyncStore',
      itemModel: DummyModel,
      fetchActions: () => ({
        async fetchOne() {
          return dummyItem;
        },
      }),
    });
    const asyncStore = AsyncStore.create();
    const container = asyncStore.getOne('foo');
    await when(() => container.isReady);
    expect(container).toBeDefined();
    expect(container.isReady).toBe(true);
    expect(container.value).toBe(dummyItem);
  });

  it('should fetch many items', async () => {
    const dummyItem1 = DummyModel.create({ id: 'foo' });
    const dummyItem2 = DummyModel.create({ id: 'bar' });
    const AsyncStore = createAsyncStore({
      name: 'AsyncStore',
      itemModel: DummyModel,
      fetchActions: () => ({
        async fetchMany() {
          return [dummyItem1, dummyItem2];
        },
      }),
    });
    const asyncStore = AsyncStore.create();
    const containers = asyncStore.getMany(['foo', 'bar']);
    await when(() => asyncStore.isReady);
    expect(containers.length).toBe(2);
    expect(containers[0].value).toBe(dummyItem1);
    expect(containers[1].value).toBe(dummyItem2);
  });

  it('should fetch all items', async () => {
    const dummyItem1 = DummyModel.create({ id: 'foo' });
    const dummyItem2 = DummyModel.create({ id: 'bar' });
    const AsyncStore = createAsyncStore({
      name: 'AsyncStore',
      itemModel: DummyModel,
      fetchActions: () => ({
        async fetchAll() {
          return [dummyItem1, dummyItem2];
        },
      }),
    });
    const asyncStore = AsyncStore.create();
    asyncStore.getAll();
    await when(() => asyncStore.isReady);
    const containers = asyncStore.getAll();
    expect(containers.length).toBe(2);
    expect(containers[0].value).toBe(dummyItem1);
    expect(containers[1].value).toBe(dummyItem2);
  });

  it('should fail to fetch one item', async () => {
    const AsyncStore = createAsyncStore({
      name: 'AsyncStore',
      itemModel: DummyModel,
      fetchActions: () => ({
        async fetchOne() {
          throw Error('Failed to fetch item');
        },
      }),
    });
    const asyncStore = AsyncStore.create();
    const container = asyncStore.getOne('foo');
    await when(() => container.isReady);
    expect(asyncStore.containers.size).toBe(1);
    expect(container.inFailstate).toBe(true);
    expect(container.error!.message).toBe('Failed to fetch item');
  });

  it('should fail to fetch many items', async () => {
    const AsyncStore = createAsyncStore({
      name: 'AsyncStore',
      itemModel: DummyModel,
      fetchActions: () => ({
        async fetchMany() {
          throw Error('Failed to fetch items');
        },
      }),
    });
    const asyncStore = AsyncStore.create();
    const containers = asyncStore.getMany(['foo', 'bar']);
    await when(() => asyncStore.isReady);
    expect(asyncStore.containers.size).toBe(2);
    expect(containers[0].inFailstate).toBe(true);
    expect(containers[0].error!.message).toBe('Failed to fetch items');
    expect(containers[1].inFailstate).toBe(true);
    expect(containers[1].error!.message).toBe('Failed to fetch items');
  });

  it('should throw exception when not supporting fetchOne', async () => {
    const AsyncStore = createAsyncStore({
      name: 'AsyncStore',
      itemModel: DummyModel,
    });
    const asyncStore = AsyncStore.create();
    expect(asyncStore._fetchOne('foo')).rejects.toEqual(
      Error("Store doesn't support fetchOne")
    );
  });

  it('should throw exception when not supporting fetchMany', async () => {
    const AsyncStore = createAsyncStore({
      name: 'AsyncStore',
      itemModel: DummyModel,
    });
    const asyncStore = AsyncStore.create();
    expect(asyncStore._fetchMany(['foo', 'bar'])).rejects.toEqual(
      Error("Store doesn't support fetchMany")
    );
  });

  it('should throw exception when not supporting fetchAll', async () => {
    const AsyncStore = createAsyncStore({
      name: 'AsyncStore',
      itemModel: DummyModel,
    });
    const asyncStore = AsyncStore.create();
    expect(asyncStore._fetchAll()).rejects.toEqual(
      Error("Store doesn't support fetchAll")
    );
  });

  it('should accept custom AsyncContainer', async () => {
    const AsyncContainer = createAsyncContainer(DummyModel);
    const dummyItem = DummyModel.create({ id: 'foo' });
    const AsyncStore = createAsyncStore({
      name: 'AsyncStore',
      containerModel: AsyncContainer,
      itemModel: DummyModel,
      fetchActions: () => ({
        async fetchOne() {
          return dummyItem;
        },
      }),
    });
    const asyncStore = AsyncStore.create();
    const container = asyncStore.getOne('foo');
    await when(() => asyncStore.isReady && container.isReady);
    expect(container.value).toBe(dummyItem);
    expect(container.id).toBe('foo');
  });

  it('should trigger fetch from empty container when shouldFetch is true', async () => {
    const dummyItem = DummyModel.create({ id: 'foo' });
    const AsyncStore = createAsyncStore({
      name: 'AsyncStore',
      itemModel: DummyModel,
      fetchActions: () => ({
        async fetchOne() {
          return dummyItem;
        },
      }),
    });
    const asyncStore = AsyncStore.create();
    const emptyContainer = asyncStore.createAsyncContainer('foo');
    expect(emptyContainer.isReady).toBe(false);
    expect(emptyContainer.shouldFetch).toBe(true);
    const value = emptyContainer.value;
    expect(value).toBeUndefined();
    await when(() => emptyContainer.isReady);
    expect(emptyContainer.value).toBe(dummyItem);
  });
});
