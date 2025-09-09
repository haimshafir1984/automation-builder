const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 300, useClones: false });

function getCached(key, fetchFn, ttlSec = 300) {
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  return Promise.resolve(fetchFn()).then((val) => {
    cache.set(key, val, ttlSec);
    return val;
  });
}

module.exports = { cache, getCached };
