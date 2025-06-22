const cacheWarmer = require('../utils/cacheWarmer');
const { checkTermInCache } = require('./cacheController');

// Get cache warmer status
exports.getCacheWarmerStatus = (req, res) => {
    res.json(cacheWarmer.getStatus());
};

// Trigger cache warming
exports.triggerCacheWarmer = async (req, res) => {
    try {
        const limit = req.body.limit || 50;
        const result = await cacheWarmer.warmMultiLevelCache(limit);

        res.json({
            success: true,
            message: `Cache warming completed successfully`,
            termsLoaded: {
                fromDatabase: result.termsFetched,
                inCache: result.actualCacheSize
            },
            cacheCapacity: {
                l1: {
                    size: result.cacheStats.l1Size,
                    capacity: result.cacheStats.l1Capacity
                },
                l2: {
                    size: result.cacheStats.l2Size,
                    capacity: result.cacheStats.l2Capacity
                },
                total: {
                    size: result.actualCacheSize,
                    capacity: result.cacheStats.l1Capacity + result.cacheStats.l2Capacity
                }
            }
        });
    }
    catch(err) {
        res.status(500).json({
            success: false,
            message: 'Cache warming failed',
            error: err.message
        });
    }
};



