/**
 
Cache manager - to create a cache instance and automatic cleanup of expired items
 **/

const LRUCacheWithTTL = require('./utils/LRUCache');
const Logger = require('./utils/Logger');

// default configuration constants
const DEFAULT_L1_CAPACITY = 20;
const DEFAULT_L2_CAPACITY = 100;
const  CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Run cleanup every 5 minutes

class MultiLevelCache{
    constructor(l1Capacity, l2Capacity) {
        this.l1Cache = new LRUCacheWithTTL(l1Capacity); // Fast and small cache
        this.l2Cache = new LRUCacheWithTTL(l2Capacity); // Slow and large cache

        // Stats to track cache performance
        this.l1Hits = 0; // times items were found in L1
        this.l2Hits = 0; // times items were found in L2
        this.misses = 0; // times items weren't found in either cache
        this.requests = 0; // total number of get requests
    }

    
    get(key) {
        this.requests++;

        // first check L1 cache
        const l1Result = this.l1Cache.get(key);
        if(l1Result !== undefined) {
            this.l1Hits++;
            return {
                value: l1Result.data,
                level: 'L1',
                metadata: l1Result.metadata
            };
        }

        // If not in L1 check L2 cache
        const l2Result = this.l2Cache.get(key);
        if(l2Result !== undefined) {
            // Promote to L1 cache
            this.l1Cache.put(key, l2Result.data);
            this.l2Hits++;
            return {
                value: l2Result.data,
                level: 'L2',
                metadata: l2Result.metadata
            };
        }

        // not found in either cache
        this.misses++;
        return undefined;
    }

    put(key, value, ttl = null) {
        this.l1Cache.put(key, value, ttl);
        this.l2Cache.put(key, value, ttl);
    }

    delete(key) {
        const l1Removed = this.l1Cache.delete(key);
        const l2Removed = this.l2Cache.delete(key);
        return l1Removed || l2Removed;
    }

    // Clear all items from both cache
    clear() {
        this.l1Cache.clear();
        this.l2Cache.clear();
        this.l1Hits = 0;
        this.l2Hits = 0;
        this.misses = 0;
        this.requests = 0;
    }

    // Get contents of both level
    getContents() {
        return {
            l1: this.l1Cache.getContents(),
            l2: this.l2Cache.getContents()
        };
    }

    getStats() {
        const l1Size = this.l1Cache.getSize();
        const l2Size = this.l2Cache.getSize();

        return {
            l1: {
                size: l1Size,
                capacity: this.l1Cache.getCapacity(),
                hits: this.l1Hits,
                hitRate: this.requests > 0 ? (this.l1Hits/this.requests) * 100 : 0

            },
            l2: {
                size: l2Size,
                capacity: this.l2Cache.getCapacity(),
                hits: this.l2Hits,
                hitRate: this.requests > 0 ? (this.l2Hits/this.requests) * 100 : 0

            },
            overall: {
                requests: this.requests,
                hits: this.l1Hits + this.l2Hits,
                misses: this.misses,
                hitRate: this.requests > 0 ? ((this.l1Hits + this.l2Hits) / this.requests) * 100 : 0
            }
        };
    }

    // Set new capacities for L1 and L2 and clear cache
    setCapacity(l1Capacity, l2Capacity, clearCache = false) {
    // Create new caches with new capacities
        const newL1 = new LRUCacheWithTTL(l1Capacity);
        const newL2 = new LRUCacheWithTTL(l2Capacity);
        
        // Reset statistics if clearing cache
        if (clearCache) {
        this.l1Hits = 0;
        this.l2Hits = 0;
        this.misses = 0;
        this.requests = 0;
        }
        
        return {
        l1Capacity,
        l2Capacity,
        cacheCleared: clearCache
        };
    }

    getCapacity() {
        return {
            l1Capacity: this.l1Cache.getCapacity(),
            l2Capacity: this.l2Cache.getCapacity()
        };
    }

    // Clean expired items from both cache
    cleanExpired() {
        const l1Removed = this.l1Cache.cleanExpired();
        const l2Removed = this.l2Cache.cleanExpired();

        return {
            l1Removed,
            l2Removed,
            total: l1Removed + l2Removed
        };
    }
}

// Create instance with default capacity
const unifiedCache = new MultiLevelCache(DEFAULT_L1_CAPACITY, DEFAULT_L2_CAPACITY);

// set periodic cleanup
setInterval(()=> {
    const cleaned = unifiedCache.cleanExpired();
    if(cleaned.total > 0) {
        Logger.logCache(`Cache cleanup: Removed ${cleaned.total} expired items (L1: ${cleaned.l1Removed}, L2: ${cleaned.l2Removed})`);
    }
}, CLEANUP_INTERVAL_MS);

module.exports = unifiedCache;

