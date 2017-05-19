'use strict';

/**
 * cache.js
 * ------------------------------------------------------
 *
 * Caches values in redis. Its pretty simple.
 *
 * ------------------------------------------------------
 */

const crypto = require('crypto'),
      Redis = require('ioredis'),
      Promise = require('bluebird');


// Utility to check if an argument is a function
const isFn = (x) => {
  return typeof x === 'function';
};



/**
 * Helper to create a client
 *
 * @param {Object} opts
 *    Options that get passed directly to ioredis
 *
 */
function createClient (opts) {
  opts = opts || {};
  return new Redis(opts);
};



/**
 * This is the actual workhorse behind
 * the wrapped caching functions
 *
 */
const wrapPromise = Promise.coroutine(function * (context, key, ex, worker) {
  let self = context;

  if (isFn(ex) && !worker) {
    worker = ex;
    ex = self.ex;
  }

  if (!key || typeof key !== 'string') {
    return Promise.reject(Error('Invalid \'key\' passed to cache. \'key\' must be a string.'));
  }

  try {
    let res = yield self.get(key);
    if (res) {
      return Promise.resolve(JSON.parse(res));
    }

    let stuff = yield worker();
    if (stuff) {
      self.set(key, stuff, ex);
    }

    return Promise.resolve(stuff);
  } catch (err) {
    return Promise.reject(err);
  }
});




/**
 * MAIN CONSTRUCTOR FUNCTION
 *
 * This create the cache object, and must be called with new Cache();
 * Optional values:
 *    @param {String} prefix
 *        Prefix to be appended to keys.
 *    @param {Number} ex
 *        Default expire time.
 *    @param {Object} client
 *        Optional redis client. If not provided, then a new connection will
 *        be created.
 */
class Cache {
  constructor (opts) {
    opts = opts || {};
    this.prefix = opts.prefix || 'data:';
    this.ex = opts.ex || (4 * 60 * 60);
    this.conn = opts.client || createClient(opts.connection);
  }


  /**
   * Test a key name to see if it has a prefix
   *
   * @param {String} key
   *    The key to check.
   */
  check (key) {
    return /:/gi.test(key) ? key : this.prefix + key;
  }


  /**
   * Create a sha1 hash of a value
   *
   * @param {String} str
   *    the value to hash.
   */
  hash (str) {
    return crypto.createHash('sha1').update(str).digest('hex');
  }


  /**
   * Do redis operations
   *
   * @internal
   *
   * @param {String} method
   *    The redis method to perform
   *
   * @param ...
   *    Arguments passed to method.
   */
  _do (...args) {
    let method = args[0].toLowerCase();

    // This must be the key
    args[1] = this.check(args[1]);

    // Remove method from call.
    args.splice(0, 1);

    return this.conn[method].apply(this.conn, args);
  }


  /**
   * List keys in Redis
   *
   * @param {String} pattern
   *    Pattern to search for. If missing, defaults to
   *    cache instance prefix.
   *
   * @return {Promise}
   */
  keys (pattern = '') {
    if (typeof pattern !== 'string' || !pattern.length) {
      pattern = this.prefix + '*';
    }

    return this.conn.keys(pattern);
  }


  /**
   * Get a key from redis cache
   *
   * @param {String} key
   *    The name of the key in redis to retreive.
   *
   * @param {Function} [cb]
   *    Standard callback function passed to redis.get.
   */
  get (key, cb) {
    key = this.check(key);
    if (isFn(cb)) {
      this.conn.get(key, cb);
    } else {
      return this.conn.get(key);
    }
  }


  /**
   * Delete a key from redis cache
   *
   * @param {String} key
   *    The name of the key in redis to delete.
   *
   * @param {Function} [cb]
   *    Standard callback function passed to redis.del.
   */
  del (key, cb) {
    key = this.check(key);
    if (isFn(cb)) {
      this.conn.del(key, cb);
    } else {
      return this.conn.del(key);
    }
  }



  /**
   * Delete all keys matching a pattern. If no pattern is provided,
   * then all keys matching the default prefix will be purged.
   *
   * @param {String} pattern
   *    The pattern to use.
   *
   */
  flush (pattern) {
    if (typeof pattern !== 'string' || !pattern.length) {
      pattern = this.prefix + '*';
    }

    return this.conn.keys(pattern).then(keys => {
      if (Array.isArray(keys) && keys.length) {
        return this.conn.del(keys);
      }
      return null;
    });
  }



  /**
   * Set a key in redis cache
   *
   * @param {String} key
   *    The name of the key in redis to set value to.
   *
   * @param {Object} value
   *    The value to set the key to. If not already stringified,
   *    then JSON.stringify will be called.
   *
   * @param {Number} ex
   *    [Optional] Time to set the expire for this key. If not
   *    provided, then the default will be used.
   *
   * @param {Function} cb
   *    [Optional] Standard callback function to invoke after
   *    setting the key.
   */
  set (key, value, ex, cb) {
    if (ex && !cb && isFn(ex)) {
      cb = ex;
      ex = this.ex;
    } else if (!ex && !cb) {
      ex = this.ex;
    }

    key = this.check(key);
    value = JSON.stringify(value);

    if (isFn(cb)) {
      this.conn.set(key, value, 'EX', ex, cb);
    } else {
      return this.conn.set(key, value, 'EX', ex);
    }
  }


  /**
   * Get an object from cache, or retreive from other
   * methods and set when done.
   *
   * @param {String} key
   *    The name of the key in redis to retreive/set the value of 'work' to..
   *
   * @param {Number} ex
   *    [Optional] Time to set the expire for this key. If not
   *    provided, then the default will be used.
   *
   * @param {Function} worker
   *    Function to be invoked if the key does not exist in the
   *    cache. It must take a single argument, callback, that
   *    gets passed (err, result). If no error occurs, then the
   *    value of 'result' will be set in the cache to 'key'.
   *
   * @param {Function} done
   *    Function to be invoked with (err, result), where result will
   *    be the value retreived from redis using the 'key', or the
   *    product from 'worker' if not found. Either way, this always
   *    gets called.
   */
  wrap (key, ex, worker, done) {
    const self = this;

    if (isFn(ex) && !done) {
      done = worker;
      worker = ex;
      ex = this.ex;
    }

    return wrapPromise(self, key, ex, worker).asCallback(done);
  }



  /**
   * Get an object from cache, or retreive from other
   * methods and set when done, but with PROMISES
   *
   * @param {String} key
   *    The name of the key in redis to retreive/set the value of 'work' to..
   *
   * @param {Number} ex
   *    [Optional] Time to set the expire for this key. If not
   *    provided, then the default will be used.
   *
   * @param {Function} worker
   *    Promise function to be invoked if the key does not exist in the
   *    cache. It must return the value of whatever is to be set in
   *    the cache for 'key'. This value will be returned after being set in
   *    the cache.
   */
  wrapPromise (key, ex, worker) {
    const self = this;
    return wrapPromise(self, key, ex, worker);
  }
}







/**
 * MAIN FUNCTION
 *
 * This just wraps the entire module in the export
 * so that it can be called without new Cache()
 */
module.exports = function (opts) {
  return new Cache(opts);
};
