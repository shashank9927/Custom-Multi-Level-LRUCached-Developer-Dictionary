const mongoose = require('mongoose');

// Define schema for the Developer Dictionary
const wordSchema = new mongoose.Schema({
    term: {
        type: String,
        required: true,
        unique: true, //ensure there are no duplicate terms
        trim: true,
        lowercase: true,
        index: true
    },

    definitions: [{
        type: String,
        required: true
    }],

    tags: [{
        type: String,
        trim: true,
        lowercase: true 
    }],

    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

wordSchema.index({term: 'text', tags: 'text'}); //add text index for searching terms

// update 'updatedAt' timestamp when document is updated
wordSchema.pre('save', function(next) {
    if(this.isModified()){
        this.updatedAt = Date.now();
    }
    next();
});

const Word = mongoose.model('Word',  wordSchema);

module.exports = Word;
