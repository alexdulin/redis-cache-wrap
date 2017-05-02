


const crypto = require('crypto');
const md5 = require('md5');


const stuff = crypto.randomBytes(5000).toString('hex');
const TESTS = 50000;

console.time('md5');
var i = 0;
while (i < TESTS) {
  i++;
  void md5(stuff);
}
console.timeEnd('md5');


console.time('sha1');
var j = 0;
while (j < TESTS) {
  j++;
  void crypto.createHash('sha1').update(stuff).digest('hex');
}
console.timeEnd('sha1');







