# mst-async-store

[![GitHub license](https://img.shields.io/badge/license-ISC-blue.svg?style=flat-square)](https://github.com/mekwall/mst-async-store/blob/master/LICENSE)
[![Build Status](https://img.shields.io/circleci/project/github/mekwall/mst-async-store.svg?style=flat-square)](https://circleci.com/gh/mekwall/mst-async-store)
[![Coverage](https://img.shields.io/codecov/c/github/mekwall/mst-async-store/master.svg?style=flat-square)](https://codecov.io/github/mekwall/mst-async-store?branch=master)
[![Dependencies](https://img.shields.io/librariesio/github/mekwall/mst-async-store.svg?style=flat-square)](https://github.com/mekwall/mst-async-store)

An opinionated asynchronous store and container implementation for [mobx-state-tree](https://github.com/mobxjs/mobx-state-tree).

## Reasoning

One of the most common challenges when implementing a store solution is how to handle asynchronous data sets. mst-async-store aims to simplify this by allowing you to create powerful asynchronous stores in a matter of seconds. An mst-async-store implements the most common fetch patterns and support fetch queues, fail states and time to live out of the box.

It's as simple as this:

```ts
import axios from 'axios';
import { when } from 'mobx';
import { createAsyncStore } from 'mst-async-store';

// Generate store model
const MyAsyncStore = createAsyncStore(
  'MyAsyncStore', // Name of store
  MyModel, // Your MST model representing one item
  (self) => (
    {
      // Logic to fetch one item
      async fetchOne(id: string) {
        const data = await axios.get(`/one/${id}`);
        return MyModel.create(data.response);
      },
      // Logic to fetch many items
      async fetchMany(ids: string[]) {
        const data = await axios.get(`/many`, { ids });
        return data.response.map((d) => MyModel.create(d));
      },
      // Logic to fetch all items
      async fetchAll() {
        const data = await axios.get(`/all`);
        return data.response.map((d) => MyModel.create(d));
      },
    },
    // Store options
    { ttl: 10000, failstateTtl: 5000 }
  )
);

// Instantiate store
const myAsyncStore = MyAsyncStore.create();

// Ask the store to return container with id 'foo'
const container = myAsyncStore.get('foo');
when(
  () => container.isReady,
  () => {
    const myModel = container.value;
    // myModel is an instance of MyModel
  }
);
```
