genesis = require '../genesis'

describe "bucket", ->
    bucket = null

    beforeEach ->
        ctx = {}
        buckets = genesis.seedContext ctx
        bucket = ctx.bucket 'test'

    it "returns the same instance if called twice", ->
        value_a = bucket 'foo', {'test': 'thing'}
        value_b = bucket 'foo'
        assert.strictEqual value_a, value_b

    it "throws if trying to override data", ->
        bucket 'foo', {'test': 'thing'}
        assert.throw (-> bucket 'foo', {'other': 'thing'}), Error, /override/

    describe "callback", ->
        it "carries over values from previous calls", ->
            value = null

            bucket 'foo', ->
                this.foo = 'testvalue'

            bucket 'foo', ->
                value = this.foo

            assert.equal value, 'testvalue'
