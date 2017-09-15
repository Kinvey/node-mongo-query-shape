mongo-query-shape
=================


Summary
-------

    const queryShape = require('mongo-query-shape');

    var query1 = { a: 1, b: {$gt: 1, $lt: 11}, c: {$ne: 1} }
    var query2 = { a: 2, b: {$gt: 2, $lt: 12}, c: {$ne: 2} }
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
