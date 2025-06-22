const Word = require('../models/wordModel');
const multiLevelCache = require('../utils/cacheManager');

const DEFAULT_TTL = 300; //set default ttl to 300 seconds (5 minutes)

// clear cache paginated entries
const clearPaginationCache = () => {
    const cacheContents = multiLevelCache.getContents();

    [...cacheContents.l1, ...cacheContents.l2].forEach( item => {
        if(item.key.startsWith('list_')){
        multiLevelCache.delete(item.key);
        }
    });
};

// Get term by name
exports.getWord = async (req, res) => {
    const term = req.params.term.toLowerCase();

    try {
        // check if term is in cache
        const cachedResult = multiLevelCache.get(term);

        if(cachedResult) {
            return res.json({
                word: cachedResult.value,
                source: `cache-${cachedResult.level}`,
                cacheLevel: cachedResult.level,
                message: `Term retrieved from ${cachedResult.level} cache`,
                metadata: cachedResult.metadata
            });
        }

        // If not in cache get it from database
        const word = await Word.findOne({
            term: { $regex: new RegExp(`^${term}$`,'i')}
        });

        if(!word) {
            return res.status(404).json({
                message: `Term '${term}' not found`
            });
        }

        // add to cache with default TTL
        multiLevelCache.put(term, word, DEFAULT_TTL);
        return res.json({
            word,
            source: 'database',
            message: 'Term retrieved from database and added to cache',
            cacheTtl: `Cache entry will expire in ${DEFAULT_TTL} seconds`
        });
    }
    catch(err) {
        res.status(500).json({
            message: 'Server error',
            error: err.message
        });
    }
};

// Get all terms - with pagination and filtering
exports.getAllWords = async (req,res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filterTerm = req.query.term || '';
    const filterTags = req.query.tags ? req.query.tags.split(',') : [];

    try {
        // create a cache key based on request parameters
        const cacheKey = `list_page${page}_limit${limit}_term${filterTerm}_tags${filterTags.join('+')}`;

        const cachedResult = multiLevelCache.get(cacheKey);

        if(cachedResult) {
            const cachedValue = cachedResult.value || {};
            return res.json({
                words: cachedValue.words || [],
                pagination: cachedValue.pagination || {
                    totalItems: 0,
                    totalPages: 0,
                    currentPage: page,
                    pageSize: limit
                },
                source: `cache-${cachedResult.level}`,
                cacheLevel: cachedResult.level,
                message: `Results retrieved from ${cachedResult.level} cache`
            });
        }

        // build filter object
        const filter = {};

        if(filterTerm) {
            filter.term = {$regex: filterTerm, $options: 'i'};
        }

        if(filterTags.length > 0) {
            filter.tags = { $in: filterTags.map(tag => new RegExp(tag, 'i'))};

        }

        const words = await Word.find(filter).sort({term: 1}).skip(skip).limit(limit);

        const total = await Word.countDocuments(filter);

        const result = {
            words,
            pagination: {
                totalItems: total,
                totalPages: Math.ceil(total/limit),
                currentPage: page,
                pageSize: limit
            }
        };

        // cache paginated result
        multiLevelCache.put(cacheKey, result);

        res.json({
            ...result,
            source: 'database',
            message: 'Results retrieved from database and added to cache'

        });
    } 
    catch(err) {
        res.status(500).json({message: 'Server error', error: err.message});
    } 

};

// create a new term
exports.createWord = async(req,res) => {
    try {
        const {term,definition, definitions, tags = [], examples = [], ttl} = req.body;
        
        if(!term) {
            return res.status(400).json({
                message: 'Term is required'
            });
        }

        if(!definition && (!definitions || !definitions.length)) {
            return res.status(400).json({
                message: 'Either definition (string) or definition (array) is required'
            });
        }

        const finalDefinitions = definition ? [definition] : definitions;

        const existingWord = await Word.findOne({
            term: {$regex: new RegExp(`^${term}$`,'i')}
        });

        if(existingWord) {
            return res.status(409).json({
                message: `Term '${term} already exists`,
                suggestion: `Use PUT /api/words/${term} to update the existing term`
            });
        }

        // create new word
        const newWord = new Word({
            term: term.toLowerCase(),
            definitions: finalDefinitions,
            tags,
            examples
        });

        await newWord.save();

        clearPaginationCache();

        // Add to cache with specified TTL or default TTL
        const cacheTtl = ttl > 0 ? ttl : DEFAULT_TTL;
        multiLevelCache.put(term.toLowerCase(), newWord, cacheTtl);

        res.status(201).json({
            message: `Term '${term}' created successfully`,
            word: newWord,
            cacheTtl: `Cache entry will expire in ${cacheTtl} seconds`
        });
    }
    catch(err) {
        res.status(500).json({
            message: 'Server error',
            error: err.message
        });
    }
};

// Create multiple terms - Bulk operation
exports.createBulkWords = async (req, res) => {
    try {
        const {words, defaultTtl} = req.body;

        if(!words || !Array.isArray(words) || words.length === 0) {
            return res.status(400).json({
                message: 'An array of words is required'
            });
        }

        const results = {
            added: [],
            skipped: []
        };

        for(const word of words) {
            const {term, definition, definitions, tags = [], ttl = defaultTtl || DEFAULT_TTL} = word;

            if(!term) {
                results.skipped.push({...word, reason: 'Missing term'});
                continue;
            }

            const finalDefinitions = definition ? [definition] : (definitions || []);

            if(!finalDefinitions.length) {
                results.skipped.push({term, reason: 'Missing definition(s)'});
                continue;
            }

            try {
                const existingWord = await Word.findOne({
                    term: {$regex: new RegExp(`^${term}$`,'i')}
                });

                if(existingWord) {
                    results.skipped.push({term, reason: 'term already exists'});
                    continue;
                }

                // create and save new word
                const newWord = new Word({
                    term: term.toLowerCase(),
                    definitions: finalDefinitions,
                    tags
                });

                await newWord.save();

                const cacheTtl = ttl > 0 ? ttl : DEFAULT_TTL;
                multiLevelCache.put(term.toLowerCase(), newWord, cacheTtl);

                results.added.push(newWord);
            }
            catch(err) {
                results.skipped.push({
                    term,
                    reason: `Error: ${err.message}`
                });
            }
        }

        clearPaginationCache();

        res.status(201).json({
            message: `Bulk operation completed. Added: ${results.added.length}, skipped: ${results.skipped.length}`,
            results
        });
    }
    catch(err) {
        res.status(500).json({message: 'Server error', error: err.message});

    }
};

// Update a term
exports.updateWord = async (req,res) => {
    const term = req.params.term.toLowerCase();

    try {
        const word = await Word.findOne({
            term: {$regex: new RegExp(`^${term}$`,'i')}
        });

        if(!word) {
            return res.status(404).json({
                message: `Term '${term}' not found`
            });
        }

        const {definition, definitions, tags, ttl } = req.body;

        if(definition || definitions){
            word.definitions = definition ? [definition] : (definitions || word.definitions);
        }

        if(tags) {
            word.tags = tags;
        }

        word.updatedAt = Date.now();

        await word.save();

        const cacheTtl = ttl > 0 ? ttl : DEFAULT_TTL;

        multiLevelCache.put(term, word, cacheTtl);
        clearPaginationCache();

        res.json({
            message: 'Term updated successfully',
            word,
            cacheTtl: `Cache entry will expire in ${cacheTtl} seconds`
        });

    }
    catch(err) {
        res.status(500).json({
            message: 'Server error',
            error: err.message
        });
    }
};

// Delete a term
exports.deleteWord = async (req,res) => {
    const term = req.params.term.toLowerCase();
    try {
        const word = await Word.findOneAndDelete({
            term: {$regex: new RegExp(`^${term}$`,'i')}
        });

        if(!word) {
            return res.status(404).json({
                message: `Term '${term}' not found`
            });
        }

        // Remove from cache
        multiLevelCache.delete(term);
        clearPaginationCache();

        res.json({
            message: 'Term deleted successfully',
            word
        });
    }

    catch(err) {
        res.status(500).json({
            message: 'Server error',
            error: err.message
        });
    }
};



