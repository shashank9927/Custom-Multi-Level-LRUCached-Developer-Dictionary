const Logger = require('./Logger');


// Implement LRU Cache using doubly linked list with hashmap  with O(1) time complexity that can automatically expire items after specified time
class LRUCacheWithTTL {
    constructor(capacity) {
        this.capacity = capacity;
        this.cache = new Map();

        // Doubly linked list with dummy head and tail
        this.head = { key: 'head', next: null, prev: null};
        this.tail = {key: 'tail', next: null, prev: null};
        
        this.head.next = this.tail;
        this.tail.prev = this.head;
    }

    moveToFront(node) {
        this.removeFromList(node);
        this.addToFront(node);
    }

    addToFront(node) {
        node.next = this.head.next;
        node.prev = this.head;
        this.head.next.prev = node;
        this.head.next = node;
    }

    removeFromList(node) {
        node.prev.next = node.next;
        node.next.prev = node.prev;
    }

    get(key) {
        if(!this.cache.has(key)) {
            return undefined;
        }

        const node = this.cache.get(key);

        // check if it is expired
        if(node.expiresAt && Date.now() > node.expiresAt) {
            Logger.logCache(`Item "${key}" expired`);
            this.delete(key);
            return undefined;
        }

        this.moveToFront(node);
        return {
            data: node.value,
            metadata: this.getItemMetadata(node)
        };
    }

    getItemMetadata(node) {
        const now = Date.now();
        return {
            expiresAt: node.expiresAt ? new Date(node.expiresAt).toISOString() : null,
            ttlRemaining: node.expiresAt ? Math.max(0, Math.floor((node.expiresAt - now) / 1000)) : null
        };
    }

    put(key, value, ttl = 0) {
        if(this.cache.has(key)) {
            const node = this.cache.get(key);
            node.value = value;
            node.expiresAt = ttl > 0 ? Date.now() + ttl * 1000 : null;
            if (ttl > 0) {
                Logger.logCache(`Updated: "${key}" TTL ${ttl}s`);
            }
            this.moveToFront(node);
            return;
        }

        if(this.cache.size >= this.capacity) {
            this.removeLRU();
        }

        const newNode = {
            key,
            value,
            next: null,
            prev: null,
            expiresAt: ttl > 0 ? Date.now() + ttl * 1000 : null
        };

        if(ttl > 0) {
            Logger.logCache(`New: "${key}" TTL ${ttl}s`);
        }

        this.cache.set(key, newNode);
        this.addToFront(newNode);
    }

    delete(key) {
        if(!this.cache.has(key)) {
            return false;
        }

        const node = this.cache.get(key);
        this.removeFromList(node);
        this.cache.delete(key);
        return true;
    }

    // clear all items from the cache
    clear() {
        this.head.next = this.tail;
        this.tail.prev = this.head;
        this.cache.clear();
    }
    
    // Get all entries in cache with metadata and also remove any expired entries during traversal
    getEntries() {
        const entries = [];
        const now = Date.now();
        const expired = [];

        let current = this.head.next;
        while(current !== this.tail) {
            if(current.expiresAt && now > current.expiresAt) {
                expired.push(current.key);
                current = current.next;
                continue;
            }

            entries.push({
                key: current.key,
                value: current.value,
                expiresAt: current.expiresAt ? new Date(current.expiresAt).toISOString() : null,
                ttlRemaining: current.expiresAt ? Math.max(0, Math.floor((current.expiresAt - now) / 1000)) : null
            });

            current = current.next;
        }
        
        expired.forEach(k => this.delete(k));
        if(expired.length) {
            Logger.logCache(`Removed ${expired.length} expired entries`);
        }  
        return entries;
    }

    getContents() {
      return this.getEntries();  
    }

    getSize() {
        return this.cache.size;
    }

    getCapacity() {
        return this.capacity;
    }

    cleanExpired() {
        const now = Date.now();
        let removed = 0;

        for(const [key, node] of this.cache.entries()) {
            if(node.expiresAt && now > node.expiresAt) {
                this.delete(key);
                removed++;
            }
        }
        return removed;
    }

    // Remove the least recently used item from cache when cache reaches capacity
    removeLRU() {
        const lruNode = this.tail.prev;
        if(lruNode === this.head) {
            return;
        }
        this.removeFromList(lruNode);
        this.cache.delete(lruNode.key);
    }
}

module.exports = LRUCacheWithTTL;