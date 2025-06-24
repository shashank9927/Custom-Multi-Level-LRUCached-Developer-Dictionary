const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./utils/db');
const routes = require('./routes');
const Logger = require('./utils/Logger');
const cacheWarmer = require('./utils/cacheWarmer');

dotenv.config();

const app = express();

connectDB();

//Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount api routes
app.use('/api', routes);

// Home route
app.get('/', (req, res) => {
    res.json({
        message: 'Custom Multi Level LRUCached Developer Dictionary',
        endpoints: {
            words: {
                get_all: 'GET /api/words (supports pagination with ?page=1&limit=10 and filtering with ?term=value&tags=tag1,tag2)',
                get_one: 'GET /api/words/:term',
                create: 'POST /api/words',
                create_bulk: 'POST /api/words/bulk',
                update: 'PUT /api/words/:term',
                delete: 'DELETE /api/words/:term'
            },
            cache: {
            get_contents: 'GET /api/cache (shows unified cache contents)',
            get_stats: 'GET /api/cache/stats',     
            clear: 'DELETE /api/cache'
            },
            admin: {
                cache_warmer: {
                status: 'GET /api/admin/cache-warmer',
                trigger: 'POST /api/admin/cache-warmer/trigger'
                }
            }}
    });
});

const PORT = process.env.PORT || 5000;


const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Initialize cache warmer - warm on startup and schedule hourly warming
  console.log('Initializing cache warmer...');
  cacheWarmer.warmMultiLevelCache(50)
    .then(result => {
      Logger.logImportant(`Initial cache warming completed with ${result.termsFetched} terms`);
      // Schedule hourly cache warming (at minute 0 of every hour)
      cacheWarmer.scheduleWarming('0 * * * *');    })    
                 .catch(err => {
                            Logger.logCache(`ERROR: Cache initialization failed: ${err.message}`);
                            console.error(`Cache initialization failed: ${err.message}`);
                            }
);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error(`Error: ${err.message}`.red);
  // close server & exit process
  server.close(() => process.exit(1));
});

module.exports = server;

