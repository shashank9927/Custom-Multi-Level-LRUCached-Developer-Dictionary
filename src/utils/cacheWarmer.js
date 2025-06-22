const cron = require('node-cron');
const Word = require('../models/wordModel');
const multiLevelCache = require('./cacheManager');
const Logger = require('./Logger');

// Set default TTL to 300 seconds or 5 minutes
const DEFAULT_TTL = 300;

// Pre load cache with recently updated terms when server is re-started
class CacheWarmer {
    constructor() {
        this.isWarming = false;
        this.lastWarmedAt = null;
    }

    async warmMultiLevelCache(limit = 50) {
        if(this.isWarming) {
            Logger.logCache('Cache warming already in progress. Skipping...');
            return {termsFetched: 0, actualCacheSize: 0};
        }

        this.isWarming = true;

        try {
            // get most recently updated terms from database
            const recentTerms = await Word.find({}).sort({updatedAt: -1}).limit(limit);

            if(!recentTerms?.length) {
                Logger.logCache('No terms found for multi-level cache warming');
                this.lastWarmedAt = new Date();
                return {
                    termsFetched: 0,
                    actualCacheSize: 0,
                    cacheStats: {
                        l1Size: 0,
                        l2Size: 0,
                        l1Capacity: multiLevelCache.getStats().l1.capacity,
                        l2Capacity: multiLevelCache.getStats().l2.capacity
                    }
                };
            }

            // Load all terms into cache with default TTL
            recentTerms.forEach(term => multiLevelCache.put(term.term, term, DEFAULT_TTL));

            const termsFetched = recentTerms.length;

            // Get actual cache sizes after warming
            const stats = multiLevelCache.getStats();
            const actualCacheSize = stats.l1.size + stats.l2.size;
            this.lastWarmedAt = new Date();
            Logger.logCache(`Multi-level cache warming: ${termsFetched} terms fetched from database, ${actualCacheSize} terms in cache after warming`);
            console.log(`Multi-level cache warming: ${termsFetched} terms fetched from database, ${actualCacheSize} terms in cache after warming`);
            return {
                termsFetched,
                actualCacheSize,
                cacheStats: {
                    l1Size: stats.l1.size,
                    l2Size: stats.l2.size,
                    l1Capacity: stats.l1.capacity,
                    l2Capacity: stats.l2.capacity
                }
            };

        }
        catch(err) {
                Logger.logCache(`ERROR: Error warming multi-level cache: ${err.message}`);
                throw err;
            }
            finally {
                this.isWarming = false;
            }
    }

    // schedule automatic cache warming - every hour
    scheduleWarming(cronExpression = '0 * * * *') {
        if(!cron.validate(cronExpression)){
            Logger.logCache(`Error! Invalid cron expression: ${cronExpression}`);
            console.error(`Invalid cron expression: ${cronExpression}`);
            return false;
        }
        Logger.logCache(`Schedule cache warming with cron: ${cronExpression}`);
        console.log(`Schedule cache warming with cron: ${cronExpression}`);

        cron.schedule(cronExpression, async () => {
            Logger.logCache('Running scheduled cache warming...');
            try {
                await this.warmMultiLevelCache();
            }
            catch(err) {
                Logger.logCache(`Error: Scheduled cache warming failed: ${err.message}`);
                console.error(`Error: Scheduled cache warming failed: ${err.message}`)
            }
        });
        return true;
    }

    getStatus(){
        return {
            isWarming: this.isWarming,
            lastWarmedAt: this.lastWarmedAt
        };
    }

}

const cacheWarmer = new CacheWarmer();

module.exports = cacheWarmer;