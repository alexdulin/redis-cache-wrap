'use strict';

/**
 * cache.js
 * ------------------------------------------------------
 *
 * Caches values in redis. Its pretty simple.
 *
 * ------------------------------------------------------
 */

const md5 = require('md5'),
      Redis = require('ioredis'),
      bluebird = require('bluebird');



/**
 * Helper to create a client
 * 
 * @param {Object} opts
 *    Options that get passed directly to ioredis
 * 
 */
function createClient (opts) {
  let options = Object.assign({}, opts, {
    host: process.env.NODE_ENV === 'production' && process.env.REDIS_URL ? process.env.REDIS_URL : (opts.host || 'localhost'),
    dropBufferSupport: true
  });
  
  return new Redis(options);
};




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
const Cache = function (opts) {
  opts = opts || {};
  this.prefix = opts.prefix || 'data:';
  this.ex = opts.ex || (4 * 60 * 60);
  this.conn = opts.client || createClient(opts.connection);
  
  return this;
};



/**
 * Test a key name to see if it has a prefix
 * 
 * @param {String} key
 *    The key to check.
 */
Cache.prototype.check = function (key) {
  return /:/gi.test(key) ? key : this.prefix + key;
};


/** 
 * Create a md5sum of a value
 * 
 * @param {String} str
 *    the value to hash.
 */
Cache.prototype.hash = function (str) {
  return md5(str);
};




/**
 * Get a key from redis cache
 * 
 * @param {String} key
 *    The name of the key in redis to retreive.
 * 
 * @param {Function}
 *    Standard callback function passed to redis.get.
 */
Cache.prototype.get = function (key, cb) {
  key = this.check(key);
  if (cb) {
    this.conn.get(key, cb);
  } else {
    return this.conn.get(key);
  }
};



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
Cache.prototype.set = function (key, value, ex, cb) {
  if (ex && !cb && typeof ex === 'function') {
    cb = ex;
    ex = this.ex;
  } else if (!ex && !cb) {
    ex = this.ex;
  }
  
  key = this.check(key);
  value = JSON.stringify(value);
  
  if (cb) {
    this.conn.set(key, value, 'EX', ex, cb);
  } else {
    return this.conn.set(key, value, 'EX', ex);
  }
};




/**
 * This is the actual workhorse behind 
 * the wrapped caching functions
 * 
 */
const wrapPromise = bluebird.coroutine(function* (context, key, ex, worker) {
  let self = context;
  
  if (typeof ex === 'function' && !worker) {
    worker = ex;
    ex = self.ex;
  }
  
  try {
    let res = yield self.get(key);
    if (res) {
      return JSON.parse(res);
    }
    
    let stuff = yield worker();
    if (stuff) {
      self.set(key, stuff, ex);
    }
    
    return stuff;
  } catch (err) {
    return err;
  }
});


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
Cache.prototype.wrap = function (key, ex, worker, done) {
  const self = this;
  if (typeof ex === 'function' && !done) {
    done = worker;
    worker = ex;
    ex = this.ex;
  }
  
  return wrapPromise(self, key, ex, worker).then(result => {
    done(null, result);
    return null;
  }).catch(err => {
    done(err, null);
    return null;
  });
};



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
Cache.prototype.wrapPromise = function (key, ex, worker) {
  const self = this;
  return wrapPromise(self, key, ex, worker);
};





/**
 * MAIN FUNCTION
 * 
 * This just wraps the entire module in the export
 * so that it can be called without new Cache()
 */
module.exports = function (opts) {
  return new Cache(opts);
};
