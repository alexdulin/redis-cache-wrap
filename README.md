# redis-cache-wrap
Node.js module for wrapping promise results in Redis.

[![npm package](https://nodei.co/npm/redis-cache-wrap.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/redis-cache-wrap/)


### Why?

This module was originally a subset of the Morning Consult Intelligence, but it seemed fit to make it an independent module for other APIs used by Morning Consult. And wrapping promises is easy.


### Usage

It wraps promises, stores their results in redis, and only calls the initial function again if the key does not exist.


```js
const cache = require('redis-cache-wrap')({
  prefix: 'foobar:',
  ex: (1 * 60 * 60), // 1 hour
  connection: {
    port: process.env.REDIS_PORT || 6379,
    host: process.env.REDIS_HOST || 'localhost'
  }
});


function worker () {
  return doAsyncWork();
}

function getStuff () {
  return cache.wrapPromise('bimbaz', 300, worker);
}

getStuff().then(res => {
  // This will be result returned from worker since first call
  // Result will be saved to redis and returned from the cache
  // on subsequent calls instead of calling worker.
  return res;
}).then(() => getStuff()).then(cachedRes => {
  // This will come from cache
  console.log(cachedRes);
});
```
