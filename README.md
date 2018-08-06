mongo-query-shape
=================
[![Build Status](https://api.travis-ci.org/andrasq/node-mongo-query-shape.svg?branch=master)](https://travis-ci.org/andrasq/node-mongo-query-shape)
[![Coverage Status](https://codecov.io/github/andrasq/node-mongo-query-shape/coverage.svg?branch=master)](https://codecov.io/github/andrasq/node-mongo-query-shape?branch=master)

Determine the "shape" of a mongo query, to help identify queries that are the same.

Queries have the same shape if they make the same type of tests on the same properties
of the documents in the collection.  The test types can be `EXACT` (test for equality),
`RANGE` (test for bounds), or `TEST` (test an indirect or computed attribute).


Summary
-------

    const queryShape = require('mongo-query-shape');

    var query1 = { a: 1, b: {$gt: 1, $lt: 11}, c: {$not: { $eq: 1 } } };
    var query2 = { a: 2, b: {$eq: 2}, c: {$gt: 100} };
    var shape1, shape2;

    shape1 = queryShape(query1);
    // => { a: 'EXACT', b: 'RANGE', c: 'TEST' }
    shape2 = queryShape(query2);
    // => { a: 'EXACT', b: 'EXACT', c: 'RANGE' }
    queryShape.isSame(shape1, shape2)
    // => false

    var shapeOptions = { shapeNames: { EXACT: '*', RANGE: '*', TEST: '*' } };
    shape1 = queryShape(query1, shapeOptions);
    // => { a: '*', b: '*', c: '*' }
    shape2 = queryShape(query2, shapeOptions);
    // => { a: '*', b: '*', c: '*' }
    queryShape.isSame(shape1, shape2)
    // => true

API
---

### queryShape( query, [options] )

Return an object corresponding to the shape of the given mongo query.  Queries that
differ only in the specific values being compared to will have the same shape.

Options:
- `shapeNames` - hash of shape names to use, must contain entries for 'EXACT', 'RANGE' and 'TEST'

### queryShape.isSame( shape1, shape2 )

Return `true` if the two queries are structurally the same, else `false`.


ChangeLog
---------

- 0.1.0 - first tagged version
