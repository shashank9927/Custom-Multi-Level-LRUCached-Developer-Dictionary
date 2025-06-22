const multiLevelCache = require('../utils/cacheManager');

exports.getCapacity = (req, res) => {
    try {
        const capacity = multiLevelCache.getCapacity();
        res.json({
            message: 'Current cache capacities',
            capacity
        });
    }
    catch(err) {
        res.status(500).json({
            message: 'Server error',
            error: err.message 
        });
    }
};

// Set new cache capacity
exports.setCapacity = (req, res) => {
    try {
        const {l1Capacity, l2Capacity} = req.body;

        if(!l1Capacity && !l2Capacity) {
            return res.status(400).json({
                message: 'At least one capacity (l1Capacity or l2Capacity) must be specified'
            });
        }

        if ((l1Capacity && (typeof l1Capacity !== 'number' || l1Capacity <=0)) || (l2Capacity && (typeof l2Capacity !== 'number' || l2Capacity <=0))) {
            return res.status(400).json({
                message: "Cache capacities must be positive number"
            });
        }

        const capacity = multiLevelCache.setCapacity(l1Capacity,l2Capacity,true); // Check

        res.json({
            message: "Cache capacities updated and cache cleared successfully",
            capacity 
        });
    }
    catch(err) {
        res.status(500).json({
            message: 'Server error',
            error: err.message
        });
    };
}