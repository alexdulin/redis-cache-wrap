'use strict';


const cache = require('../')();
const assert = require('assert');
const crypto = require('crypto');
const Promise = require('bluebird');

let workerCalls = 0;

function doWork () {
  workerCalls++;
  return Promise.resolve('foo');
}





const TESTS = 5000;

const arr = Array(TESTS).fill(0).map((x, i) => i + 1);





console.time('Basic get-set');

cache.flush('rcw-test:*')
.then(_ => {
  return Promise.mapSeries(arr, i => {
    const stuff = crypto.randomBytes(500).toString('hex');
    const key = `rcw-test:${i}`;

    return cache.set(key, stuff).then(res => {
      assert.strictEqual(res, 'OK');
      return cache.get(key);
    }).then(res => {
      assert.strictEqual(JSON.parse(res), stuff);
    });
  });
})
.then(_ => {
  console.timeEnd('Basic get-set');
  console.time('Flush keys');
  return cache.flush('rcw-test:*');
})
.then(res => {
  assert.strictEqual(res, TESTS);
  return cache.keys('rcw-test:*');
})
.then(res => {
  assert.strictEqual(res.length, 0);
  console.timeEnd('Flush keys');
  return null;
})
.then(_ => {
  console.time('wrapPromise.');
  return Promise.mapSeries(arr, i => {
    return cache.wrapPromise('rcw-test:wrapPromise', TESTS, doWork);
  });
})
.then(res => {
  assert.strictEqual(res.length, TESTS);
  assert.strictEqual(res.every(r => r === 'foo'), true);
  assert.strictEqual(workerCalls, 1);
  console.timeEnd('wrapPromise.');
})
.catch(err => {
  console.error(err);
  process.exitCode = 1;
  return null;
})
.finally(_ => setTimeout(process.exit, 300));



