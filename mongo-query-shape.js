/**
 * find mongo query abstract shape
 *
 * Copyright (C) 2017 Andras Radics
 * Licensed under the Apache License, Version 2.0
 *
 * 2017-09-15 AR.
 */

'use strict'


var EXACT = 'EXACT';            // value needs exact match, can direct lookup
var RANGE = 'RANGE';            // value must fall within range, can walk index
var TEST = 'TEST';              // value is tested, must check every doc

module.exports = queryShape;

function queryShape( query, options ) {
    options = options || {};

    var shape = {};
    var shapeNames = options.shapes || { EXACT: 'EXACT', RANGE: 'RANGE', TEST: 'TEST' };

    for (var key in query) {
        var value = query[key];
        var match;

        switch (true) {
        case Array.isArray(value):
        case value === null:
            match = EXACT;
            break;
        case value instanceof RegExp:
            match = TEST;
            break;
        case value instanceof Object:
            match = valueShape(value, shapeNames);
            break;
        default:
            match = EXACT;
            break;
        }

        shape[key] = shapeNames[match];
    }

    return sortShape(shape);
}


// given a condition { key: { ... value ... } }, determine the shape of value
function valueShape( value, shapeNames ) {
    var keys = Object.keys(value);

    var shape = TEST;

    // all properties of value must hold, so the shape is the most restrictive condition
    // Conveniently, the shape names 'exact', 'range' and 'test' sort into precendence order.
    for (var i=0; i<keys.length; i++) {
        var key = keys[i];

        switch (true) {
        case key === '$eq':
        case key === '$in':         // { x: {$in: [1, 2, 3]} }
            if (EXACT < shape) shape = EXACT;
            break;
        case key === '$lt':
        case key === '$lte':
        case key === '$gt':
        case key === '$gte':
        case key === '$exists':
            if (RANGE < shape) shape = RANGE;
            break;
        case key === '$ne':
        case key === '$nin':
        case key === '$regex':          
        case key === '$all':            // { arr: {$all: [1, 2, 3]} }
        case key === '$size':           // { arr: {$size: 3} } => arr.length == 3
        case key === '$not':            // { x: {$not: {$eq: 1}} } => x != 1
        case key === '$mod':            // { x: {$mod: [2, 1]} } => x is odd test
        case key === '$elemMatch':      // { arr: {$elemMatch: {$gt: 0, $lt: 10}} } => find element meeting conditions
        default:
            // all other conditions are tests that require examining the value,
            // and shape = TEST was set by default
            break;
        }
    }

    return shapeNames[shape];
}

// return the fields in a normalized order, to make {a:1,b:2} and {b:2,a:1} the same
function sortShape( shape ) {
    var keys = Object.keys(shape);
    var sortedShape = {};

    keys.sort();

    for (var i=0; i<keys.length; i++) {
        var key = keys[i];
        sortedShape[key] = shape[key];
    }

    return sortedShape;
}


// /** quicktest:

var tests = [
    { b: 2, c: 3, a: 1 },
    { x: 3 },
    { x: {$gt: 2} },
    { x: {$ne: 2} },
    { x: {$gt: 0, $eq: 1} },
];
for (var i=0; i<tests.length; i++) {
    var q = tests[i];
    console.log(JSON.stringify(q), " ", queryShape(q, { xshapes: {EXACT: '*', RANGE: '*', TEST: '*'}} ));
}

/**/
