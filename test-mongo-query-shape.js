/*
 * Copyright (C) 2017-2018 Andras Radics
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

var queryShape = require('./');

module.exports = {
    'should parse package': function(t) {
        require('./package.json');
        t.done();
    },

    'should test matching types': function(t) {
        var tests = [
            [ 1, 1, true ],
            [ {}, {}, true ],
            [ {a:1}, {a:1}, true ],
            [ {a:'*'}, {a:'*'}, true ],

            [ 1, 0, false ],
            [ {a:1}, {a:1, b:2}, false ],
            [ {a:1}, {b:1}, false ],
            [ {a:'EXACT'}, {a:'RANGE'}, false ],
        ];

        for (var i=0; i<tests.length; i++) {
            t.equal(queryShape.isSame(tests[i][0], tests[i][1]), tests[i][2]);
        }

        t.done();
    },

    'should accept non-object queries': function(t) {
        var shape = queryShape(1);
        t.deepEqual(shape, 'EXACT');
        t.done();
    },

    'should distinguish match types': function(t) {
        var shape = queryShape({ a: 1, b: {$gt: 2}, c: {$not: {$eq: 3}}});
        t.deepEqual(shape, {a: 'EXACT', b: 'RANGE', c: 'TEST'});
        t.done();
    },

    'should user caller-provided shape names': function(t) {
        var options = { shapeNames: { EXACT: 'e', RANGE: 'r', TEST: 't' } };
        var shape = queryShape({ a: 1, b: {$gt: 2}, c: {$not: {$eq: 3}}}, options);
        t.deepEqual(shape, {a: 'e', b: 'r', c: 't'});
        t.done();
    },

    'should assume TEST for unrecognized $ comparator': function(t) {
        var shape = queryShape({ a: { $someOtherComparator: {} } });
        t.deepEqual(shape, { a: 'TEST' });
        t.done();
    },

    'should return shape tree for nested objects': function(t) {
        var shape = queryShape({ a: { b: { c: 1 } } });
        t.deepEqual(shape, { a: { b: { c: 'EXACT' } } });
        t.done();
    },

    'should normalize shapes': function(t) {
        var tests = [
            [ { a: 1, b: { bb: 1 } }, { a: 'EXACT', b: { bb: 'EXACT' } } ],
            [ { a: { $gt: 10, $lt: 20 } }, { a: 'RANGE' } ],
            [ { a: { a: 1, b: 2, c: 3 } }, { a: { a: 'EXACT', b: 'EXACT', c: 'EXACT' } } ],
            [ { $and: [ {c: 3}, {a: 1}, {d: 4}, {b: 2} ] }, { $and: [ {a:'EXACT'}, {b:'EXACT'}, {c:'EXACT'}, {d:'EXACT'} ] } ],
            [ { $or: [ {$or: [ {c: 1}, {c: 2} ]} ] }, { $or: [ {$or: [{c:'EXACT'}, {c:'EXACT'}] } ] } ],

            [ { a: { $not: { $eq: 3 } } }, { a: 'TEST' } ],
            [ { a: { $not: { $ne: 3 } } }, { a: 'TEST' } ],
            [ { a: { $not: { $not: { $eq: 3 } } } }, { a: 'TEST' } ],   // heuristics is dumb, not not eq == eq, not test

            [ { a: new String('a'), b: new Number(2) }, { a: 'EXACT', b: 'EXACT' } ],

            [ { a: null }, { a: 'EXACT' } ],
        ];
        if (global.Symbol) tests.push([ { a: Symbol('sym') }, { a: 'EXACT' } ]);

        for (var i=0; i<tests.length; i++) {
            var shape = queryShape(tests[i][0]);
            t.deepEqual(shape, tests[i][1], t.sprintf("testing shape %O", tests[i][0]));
        }

        t.done();
    },

    'should normalize non-mongo shapes': function(t) {
        var tests = [
            [ { a: { $not: { b: 1 } } }, { a: { b: 'EXACT' } } ],
        ];

        for (var i=0; i<tests.length; i++) {
            var shape = queryShape(tests[i][0]);
            t.deepEqual(shape, tests[i][1], t.sprintf("testing shape %O", tests[i][0]));
        }

        t.done();
    },

    'code should work even if Symbol is not defined': function(t) {
        if (!global.Symbol) return t.done();

        var sym = global.Symbol;
        delete global.Symbol;
        t.unrequire('./');
        queryShape = require('./');
        var shape = queryShape({ a: 1 });

        global.Symbol = sym;
        t.unrequire('./');
        queryShape = require('./');

        t.done();
    },

    'should sort shape keys': function(t) {
        var shape = queryShape({ c: 3, b: 2, a: 1 });
        t.deepEqual(Object.keys(shape), ['a', 'b', 'c']);
        t.done();
    },

    'should recognize exact matches': function(t) {
        var tests = [ {'$eq': 1}, {'$in': [1]} ];
        for (var i=0; i<tests.length; i++) {
            var shape = queryShape({ a: tests[i] });
            t.equal(shape.a, 'EXACT');
        }
        t.done();
    },

    'should recognize existential and relational operators as range scans': function(t) {
        var tests = [ '$lt', '$lte', '$gt', '$gte', '$exists', {$nin: [1]} ];
        for (var i=0; i<tests.length; i++) {
            var query = { a: {} };
            if (typeof tests[i] === 'string') query.a[tests[i]] = 1;
            else query.a = tests[i];
            var shape = queryShape(query);
            t.equal(shape.a, 'RANGE');
        }
        t.done();
    },

    'should recognize test matches': function(t) {
        var tests = [ {$ne: 1}, {$regex: '^'}, /^/, {$all: [1,2]}, {$size: 2}, {$not: {$eq: 1}}, {$mod: [2, 1]} ];
        for (var i=0; i<tests.length; i++) {
            var query = { a: tests[i] };
            var shape = queryShape(query);
            t.equal(shape.a, 'TEST');
        }
        t.done();
    },

    'should shape and sort $and': function(t) {
        var shape = queryShape({ a:1, '$and':[ { d:4 }, { c:3, b:2 } ] });
        t.deepEqual(shape, {a:'EXACT', '$and':[{ b:'EXACT', c:'EXACT'}, {d:'EXACT'}]});
        t.deepEqual(Object.keys(shape), ['$and', 'a']);
        t.deepEqual(Object.keys(shape.$and[0]), ['b', 'c']);
        t.done();
    },

    'should shape and sort $or': function(t) {
        var shape = queryShape({ a:1, '$or':[{ d:4 }, { c:3, b:2 }] });
        t.deepEqual(shape, { a:'EXACT', '$or': [{ b:'EXACT', c:'EXACT' }, {d:'EXACT'}]});
        t.deepEqual(Object.keys(shape), ['$or', 'a']);
        t.deepEqual(Object.keys(shape.$or[0]), ['b', 'c']);
        t.done();
    },

    'should shape and sort $query': function(t) {
        var shape = queryShape({ $query: {b:2, a:1} });
        t.deepEqual(shape, { $query: {a:'EXACT', b:'EXACT'} });
        t.deepEqual(Object.keys(shape.$query), ['a', 'b']);
        t.done();
    },

    'should shape and sort $orderby': function(t) {
        var shape = queryShape({ $orderby: {b:2, a:1} });
        t.deepEqual(shape, { $orderby: {a:'EXACT', b:'EXACT'} });
        t.deepEqual(Object.keys(shape.$orderby), ['a', 'b']);
        t.done();
    },

    'should ignore other $ keywords': function(t) {
        var shape = queryShape({ $where: '', $other: {a:1} });
        t.deepEqual(shape, {});
        t.done();
    },
}


/** quicktest:

var tests = [
    { b: 2, c: 3, a: 1 },
    { x: 3 },
    { x: {$gt: 2} },
    { x: {$ne: 2} },
    { x: {$gt: 0, $eq: 1} },
    { $and: [ {a: 1}, {b: {$gt: 1}}, {c: {$ne: 0}} ] },
];
for (var i=0; i<tests.length; i++) {
    var q = tests[i];
    console.log(JSON.stringify(q), " ", queryShape(q, { xshapeNames: {EXACT: '*', RANGE: '*', TEST: '*'}} ));
}

/**/
