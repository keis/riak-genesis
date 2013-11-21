genesis = require '../genesis'

describe "seedContext", ->
    ctx = null
    buckets = null

    beforeEach ->
        ctx = {}
        buckets = genesis.seedContext ctx

    describe "bucket", ->
        it "registers a new bucket", ->
            ctx.bucket 'foo'
            assert.property buckets, 'foo'

        it "returns a function", ->
            bucket = ctx.bucket 'foo'
            assert.isFunction bucket

        it "returns the same instance if called twice", ->
            bucket_a = ctx.bucket 'foo'
            bucket_b = ctx.bucket 'foo'
            assert.strictEqual bucket_a, bucket_b
