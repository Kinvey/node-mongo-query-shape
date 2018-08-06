mongo-query-shape
=================
[![Build Status](https://api.travis-ci.org/andrasq/node-mongo-query-shape.svg?branch=master)](https://travis-ci.org/andrasq/node-mongo-query-shape)
[![Coverage Status](https://codecov.io/github/andrasq/node-mongo-query-shape/coverage.svg?branch=master)](https://codecov.io/github/andrasq/node-mongo-query-shape?branch=master)

Determine the "shape" of a mongo query, to help identify queries that are the same
other than the specific values being looked for.


Summary
-------

    const queryShape = require('mongo-query-shape');

    var query1 = { a: 1, b: {$gt: 1, $lt: 11}, c: {$not: { $eq: 1 } } }
    var query2 = { a: 2, b: {$gt: 2, $lt: 12}, c: {$not: { $eq: 2 } } }
    var shape;

    shape = queryShape(query1);
    // => { a: 'EXACT', b: 'RANGE', c: 'TEST' }
    shape = queryShape(query2);
    // => { a: 'EXACT', b: 'RANGE', c: 'TEST' }

    shape = queryShape(query1, { shapes: { EXACT: '*', RANGE: '*', TEST: '*' });
    // => { a: '*', b: '*', c: '*' }
    shape = queryShape(query2, { shapes: { EXACT: '*', RANGE: '*', TEST: '*' });
    // => { a: '*', b: '*', c: '*' }


API
---

### queryShape( query, [options] )

Return an object corresponding to the shape of the given mongo query.  Queries that
differ only in the specific values being compared to will have the same shape.

Options:
- `shapes` - hash of shape names to use, must contain entries for 'EXACT', 'RANGE' and 'TEST'

### queryShape.isSame( shape1, shape2 )

Return `true` if the objects representing the two shapes are deep equal, else `false`.
