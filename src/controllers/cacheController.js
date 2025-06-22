const multiLevelCache = require('../utils/cacheManager');
const Word = require('../models/wordModel');


const DEFAULT_TTL = 300;

exports.getCacheContents = (req, res) => {
    try {
        const cacheContents = multiLevelCache.getContents();
        const stats = multiLevelCache.getStats();

        res.json({
            stats,
            cache: cacheContents
        });
    }
    catch(err) {
        res.status(500).json({
            message: 'Server error',
            error: err.message 
        }
        );

    }
};

// Get stats about multilevel cache
exports.getCacheStats = (req, res) => {
    try {
        const stats = multiLevelCache.getStats();
        res.json({
            message: 'Multi-level cache statistics',
            stats 
        });
    }
    catch(err) {
        res.status(500).json({
            message: 'Server error',
            error: err.message
        });
    }
};

// Check if the term is in multi level cache
exports.checkTermInCache = (req, res) => {
    try {
        const term = req.params.term.toLowerCase();
        const cachedResult = multiLevelCache.get(term);

        if(cachedResult) {
            res.json({
                message: `Term '${term}' found in cache`,
                cacheLevel: cachedResult.level,
                word: cachedResult.value,
                metadata: cachedResult.metadata
            });
        }
        else {
            res.status(404).json({
                message: `Term '${term}' not found in cache`,
                suggestion: `Use POST /api/cache/${term} to add it to the cache`
            });
        }
    }
    catch(err) {
        res.status(500).json({
            message: 'Server error',
            error: err.message
        });
    }
};

// Add a term to multi level cache
exports.addTermToCache = async (req,res) => {
    try {
        const term = req.params.term.toLowerCase();

        const ttl = req.query.ttl ? parseInt(req.query.ttl, 10) : DEFAULT_TTL;

        // Check if already in cache
        const existingCache = multiLevelCache.get(term);
        if(existingCache) {
            return res.status(409).json({
                message: `Term '${term}' is already in cache (${existingCache.level})`,
                cacheLevel: existingCache.level,
                word: existingCache.value,
                metadata: existingCache.metadata
            });
        }

        // Get from DB
        const word = await Word.findOne({
            term: {$regex: new RegExp(`^${term}$`,'i')}
        });

        if(!word) {
            return res.status(404).json({
                message: `Term '${term}' not found in the database`,
                suggestion: `Create the term first using POST /api/words`
            });
        }

        // Add to cache with TTL if specified
        multiLevelCache.put(term, word, ttl);

        res.json({
            message: `Term '${term}' added to cache successfully`,
            word,
            cacheTtl: `Cache entry will expire in ${ttl} seconds`
        });
    }
    catch(err) {
        res.status(500).json({
            message: 'Server error',
            error: err.message
        });
    }
};

// Remove a term from multi level cache
exports.removeTermFromCache = (req,res) => {
    try {
        const term = req.params.term.toLowerCase();

        const existingCache = multiLevelCache.get(term);

        if(!existingCache) {
            return res.status(404).json({
                message: `Term '${term}' not found in the cache`
            });
        }

        multiLevelCache.delete(term);

        res.json({
            message: `Term '${term}' removed from cache successfully`,

        });

    }
    catch(err) {
        res.status(500).json({
            message: 'Server error',
            error: err.message
        });
    }
};

// Clear entire multi level cache
exports.clearCache = (req, res) => {
    try {
        multiLevelCache.clear();

        res.json({
            message: 'Cache cleared successfully'
        });
    }
    catch(err) {
        res.status(500).json({
            message: 'Server error',
            error: err.message
        });
    }
};

