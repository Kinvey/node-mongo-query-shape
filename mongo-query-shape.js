/**
 * find mongo query abstract shape
 *
 * Copyright (C) 2017-2018 Andras Radics
 * Licensed under the Apache License, Version 2.0
 *
 * 2017-09-15 AR.
 */

'use strict'

var Symbol = global.Symbol || global.String;


// shape names.  Note that they sort by restrictiveness
var EXACT = 'EXACT';            // value needs exact match, can indexed lookup
var RANGE = 'RANGE';            // value must fall within range, can walk index
var TEST = 'TEST';              // value is tested, must scan every doc

module.exports = queryShape;
module.exports.isSame = function isSame( shape1, shape2 ) {
    // stringify is 20x faster than deepEqual
    return JSON.stringify(shape1) === JSON.stringify(shape2);
}

/*
 * analyze the mongo query and return its essential shape.
 * Queries with the same shape are the same other than the specific values being looked for.
 */
function queryShape( query, options ) {
    options = options || {};
    // TODO: options.flatten - simplify and normalize the shape of the query, eg {} == $and:[{}] == $or:[{}]
    // TODO: options.minimize - abstract and-lists and or-lists to a single shape

    // sanity test the query, it should be an object
    if (!query || typeof query !== 'object') return 'EXACT';

    var shape = {};
    var shapeNames = options.shapes || { EXACT: 'EXACT', RANGE: 'RANGE', TEST: 'TEST' };

    for (var key in query) {
        var value = query[key];
        var match;

        if (key === '$and') {
            match = new Array(value.length);
            for (var i=0; i<value.length; i++) match[i] = queryShape(value[i], options);
            shape[key] = match;
        }

        else if (key === '$or' || key === '$nor') {
            match = new Array(value.length);
            for (var i=0; i<value.length; i++) match[i] = queryShape(value[i], options);
            shape[key] = match;
        }

        else if (key === '$query') {
            // mongod ignores other conditions if a top-level $query is present
            // our query shape includes them, however
            shape[key] = queryShape(value, options);
        }

        else if (key === '$where') {
            // TODO: not supported
        }

        else if (key === '$orderby') {
            // TODO: sort fields are also examined and benefit from indexing
            shape[key] = queryShape(value, options);
        }

        else if (key[0] === '$') {
            // TODO: other $ keywords not supported
            match = valueShape(value, options);
        }

        else {
            switch (true) {
            case value instanceof RegExp:
                match = TEST;
                break;
            case value && [ Boolean, Number, String, Symbol, Date ].indexOf(value.constructor) >= 0:
                match = EXACT;
                break;
            case value && typeof value === 'object':
                var keys = Object.keys(value);
                match = valueShape(value, options);
                break;
            default:
                match = EXACT;
                break;
            }

            // match is either a shape name, or an object
            shape[key] = shapeNames[match] || match;
        }
    }

    return sortShape(shape);
}


/*
 * given a value = { k1: v1, k2: v2, ... }, determine the shape of value
 * If any of the v1, v2, ... are a nested object, the shape will be a tree.
 * If all the v1, v2, ... are $-keyword tests, the shape will be shape name.
 * All properties of value must hold, so the shape is the most condition requiring the most work.
 * Conveniently, the shape names 'exact', 'range' and 'test' sort by restrictiveness.
 */
function valueShape( value, options ) {
    var keys = Object.keys(value);
    var shape = {}, hasSubfield = false;

    var minMax = {
        min: 'ZZZZ',
        max: '',
        update: function(shape) {
            if (shape < this.min) this.min = shape;
            if (shape > this.max) this.max = shape;
        }
    };

    for (var i=0; i<keys.length; i++) {
        var key = keys[i];

        if (key[0] === '$') switch (key) {
        case '$eq':
        case '$in':             // { x: {$in: [1, 2, 3]} }
            // conditions that can use an indexed lookup
            shape[key] = EXACT;
            minMax.update(shape[key]);
            break;
        case '$lt':
        case '$lte':
        case '$gt':
        case '$gte':
        case '$exists':
        case '$nin':
            // conditions that can use an index scan
            shape[key] = RANGE;
            minMax.update(shape[key]);
            break;
        case '$not':            // { x: {$not: {$gt: 100}} } => x <= 100, $not shape is complement of its test
            // shape of $not is the whichever is worse, its query or its complement
            var shapeComplement = { EXACT: TEST, RANGE: RANGE, TEST: TEST };
            var subqueryShape = valueShape(value[key]);
            // mongo would error out if subquery contained non-$ keywords, we roll with it
            shape[key] = shapeComplement[subqueryShape] || subqueryShape;
            minMax.update(shape[key]);
            break;
        case '$ne':
        case '$regex':          
        case '$all':            // { arr: {$all: [1, 2, 3]} }
        case '$size':           // { arr: {$size: 3} } => arr.length == 3
        case '$mod':            // { x: {$mod: [2, 1]} } => x is odd test
        case '$elemMatch':      // { arr: {$elemMatch: {$gt: 0, $lt: 10}} } => find element meeting conditions
        case '$where':          // { $where: 'sleep(100) || true' }
            // conditions that need to examine the value
            shape[key] = TEST;
            minMax.update(shape[key]);
            break;
        default:
            // assume all other $ keywords must also examine the value
            shape[key] = TEST;
            minMax.update(shape[key]);
            break;
        }
        else {
            hasSubfield = true;

            if (value[key] && typeof value[key] === 'object') {
                // object compares return the comparison tree
                shape[key] = queryShape(value[key], options);
            }
            else {
                // non-object comparisons are looking for an exact match
                // note that mongo does not allow mix-and-match $ and non-$ conditionals in the same object
                shape[key] = EXACT;
                minMax.update(shape[key]);
            }
        }
    }

    // multi-field value { k1: v1, k2: v2, ... } shape is an object { k1:, k2:, ... }
    if (hasSubfield) return shape;

    // simplify single-field multi-$-clause conditions to the one that requires the most work, eg
    //   { x : { $eq: 1, $lt: 1000, $nin: [10, 100] } } => RANGE
    return minMax.max;
}

// return the fields in a normalized order, to make {a:1,b:2} and {b:2,a:1} the same
function sortShape( shape ) {
    var keys = Object.keys(shape);
    var sortedShape = {};

    keys.sort();

    for (var i=0; i<keys.length; i++) {
        var key = keys[i];
        switch (key ) {
        case '$and':
        case '$or':
        case '$nor':
            sortedShape[key] = sortShapeArray(shape[key]);
            break;
        case '$query':
        case '$orderby':
            sortedShape[key] = sortShape(shape[key]);
            break;
        default:
            sortedShape[key] = shape[key];
            break;
        }
    }

    return sortedShape;
}

// sort each shape in the array, and sort the array into a well-defined order
function sortShapeArray( shapes ) {
    var sortedShapes = new Array();

    for (var i=0; i<shapes.length; i++) {
        sortedShapes[i] = sortShape(shapes[i]);
    }

    sortedShapes.sort(function(a, b) {
        // TODO: find a faster way
        return Object.keys(a).join(':') <= Object.keys(b).join(':') ? -1 : 1;
    })

    return sortedShapes;
}
