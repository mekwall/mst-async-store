import { types, destroy } from 'mobx-state-tree';
import { createAsyncContainer } from '../';
import { when } from 'mobx';

const DummyModel = types.model({});

describe('createAsyncContainer', () => {
  it('should create AsyncContainer model', () => {
    const AsyncContainer = createAsyncContainer(DummyModel);
    expect(AsyncContainer.name).toBe('AnonymousAsyncContainer');
  });

  it('should create instance from model', () => {
    const AsyncContainer = createAsyncContainer(DummyModel);
    const container = AsyncContainer.create({ id: 'foo' });
    expect(container.id).toBe('foo');
    expect(container.isReady).toBe(false);
    expect(container.isPending).toBe(false);
    expect(container.shouldFetch).toBe(true);
    expect(container.inFailstate).toBe(false);
    expect(container.value).toBeUndefined();
  });

  it('should have correct state when value is set', () => {
    const AsyncContainer = createAsyncContainer(DummyModel);
    const container = AsyncContainer.create({ id: 'foo' });
    container.setValue(DummyModel.create());
    expect(container.id).toBe('foo');
    expect(container.isReady).toBe(true);
    expect(container.isPending).toBe(false);
    expect(container.inFailstate).toBe(false);
    expect(container.shouldFetch).toBe(false);
    expect(container.value).toBeDefined();
  });

  it('should have correct states when failstate is set', () => {
    const AsyncContainer = createAsyncContainer(DummyModel, {
      failstateTtl: 0,
    });
    const container = AsyncContainer.create({ id: 'foo' });
    container.setFailstate(new Error('Dummy Error'));
    expect(container.id).toBe('foo');
    expect(container.isReady).toBe(true);
    expect(container.isPending).toBe(false);
    expect(container.inFailstate).toBe(true);
    expect(container.shouldFetch).toBe(false);
    expect(container.value).toBeUndefined();
  });

  it('should fetch value when fetch option is passed and value is accessed', async () => {
    expect.assertions(4);
    const AsyncContainer = createAsyncContainer(DummyModel, {
      async fetch() {
        return DummyModel.create({});
      },
    });
    const container = AsyncContainer.create({ id: 'foo' });
    expect(container.shouldFetch).toBe(true);
    expect(container.value).toBeUndefined();
    await when(() => container.isReady === true);
    expect(container.shouldFetch).toBe(false);
    expect(container.value).toBeDefined();
  });

  it('should expire failstate', async () => {
    expect.assertions(5);
    const AsyncContainer = createAsyncContainer(DummyModel, {
      ttl: 500,
      failstateTtl: 500,
    });
    const container = AsyncContainer.create({ id: 'foo' });
    container.setFailstate(new Error('Dummy Error'));
    expect(container.inFailstate).toBe(true);
    expect(container.shouldFetch).toBe(false);
    expect(container.hasExpired).toBe(false);
    await when(() => container.hasExpired);
    expect(container.shouldFetch).toBe(true);
    expect(container.inFailstate).toBe(false);
  });

  it('should fail to add value to dead container', () => {
    expect.assertions(1);
    const AsyncContainer = createAsyncContainer(DummyModel);
    const container = AsyncContainer.create({ id: 'foo' });
    destroy(container);
    expect(() => container.setValue(DummyModel.create())).toThrow(
      'Trying to set value on a dead container'
    );
  });
});
