#!/usr/bin/env node
'use strict';

var async = require('async'),
    path = require('path');

function forEach (callback) {
    var self = this;
    Object.keys(this.objects).forEach(function (key) {
        callback.call(self, self.objects[key], key);
    });
}

/**
 * Expose the functions that make the DSL to the given context.
 */
function seedContext(ctx) {
    var buckets = {},
        lastObj,
        lastValue;

    /**
     * Define a new bucket, the returned value is a function that creates
     * members of the bucket.
     */
    ctx.bucket = function (name, properties) {
        var bucket = buckets[name],
            objects = {};

        if (!bucket) {
            buckets[name] = bucket = function (key, data, fun) {

                if (typeof data === 'function') {
                    fun = data;
                    data = undefined;
                }

                lastObj = objects[key];

                if (!lastObj) {
                    lastValue = {
                        data: data || {},
                        links: []
                    };

                    objects[key] = lastObj = {
                        key: key,
                        bucket: name,
                        values: [lastValue]
                    };
                } else if (data) {
                    throw new Error("Trying to override data of " + bucket + "/" + key);
                }

                // Run callback in context of data object.
                if (fun) {
                    fun.call(lastValue.data);
                }

                return lastObj;
            };

            bucket.objects = objects;
            bucket.properties = properties || {};
            bucket.forEach = forEach;
        }

        return bucket;
    };

    /**
     * Create a sibling of the object currently being defined.
     */
    ctx.sibling = function (data, fun) {
        if (!lastObj) {
            throw new Error("sibling called with no active object");
        }

        if (typeof data === 'function') {
            fun = data;
            data = undefined;
        }

        lastValue = {
            data: data || {},
            links: []
        };

        lastObj.values.push(lastValue);

        // Run callback in context of data object.
        if (fun) {
            fun.call(lastValue.data);
        }

        return lastObj;
    };

    /**
     * Configure a link from the object currently being defined.
     *
     * The link can either be in the form of a item as returned by calling a
     * bucket, or a list with [bucket, key], or any object defining key, bucket
     * and optionally tag.
     *
     * The optional 2nd argument will be used as the tag of the link when used.
     */
    ctx.link = function (link, tag) {
        if (!lastValue) {
            throw new Error("link called with no active object");
        }

        if (!link) {
            throw new Error("link called without arguments");
        }

        if (link.bucket && link.key) {
            link = {
                bucket: link.bucket,
                key: link.key
            };
        } else {
            link = {
                bucket: link[0],
                key: link[1]
            };
        }

        if (tag) {
            link.tag = tag;
        }

        lastValue.links.push(link);
    };

    return buckets;
}

/**
 * Iterate over each item in each bucket.
 */
function iterateContextAsync(context, eachBucket, eachValue, done) {
    var workers = 4;

    async.eachSeries(Object.keys(context), function (name, callback) {
        var bucket = context[name],
            objects = bucket.objects;

        eachBucket(name, bucket, function () {
            async.eachLimit(Object.keys(objects), workers, function (key, callback) {
                var obj = objects[key];
                eachValue(name, obj, callback);
            }, callback);
        });
    }, done);
}

/**
 * Execute a seed file and save the defined objects to RIAK.
 */
function processFile(file, riak, options, callback) {
    var abspath = path.resolve(file),
        buckets;

    function saveBucket(name, bucket, callback) {
        if (!bucket.properties) {
            return callback();
        }

        if (options.verbose) {
            console.error('Configuring ' + name);
        }

        riak.saveBucket(name, bucket.properties, function (err) {
            if (err) {
                console.error(err);
            }
            callback();
        });
    }

    function saveValue(bucket, obj, callback) {
        if (options.verbose) {
            console.error('Saving ' + bucket + '/' + obj.key);
        }

        // should be a HEAD request but that causes riak-js to crash if the
        // resource has siblings.
        riak.get(bucket, obj.key, function (err, value, meta) {
            var vclock;

            if (err && err.statusCode !== 404) {
                console.error(err);
                return callback();
            }

            vclock = meta.vclock;

            async.eachSeries(obj.values, function (value, callback) {
                var meta = {
                    links: value.links,
                    vclock: vclock
                };

                riak.save(bucket, obj.key, value.data, meta, function (err) {
                    if (err) {
                        console.error(err);
                    }
                    callback();
                });
            }, callback);
        });
    }

    buckets = seedContext(global);
    require(abspath);
    iterateContextAsync(buckets, saveBucket, saveValue, callback);
}

/**
 * Script behaviour
 */
function main() {
    var riak = require('riak-js'),
        coffee,
        argv,
        url,
        client;

    argv = require('optimist')
        .usage('Seeds a RIAK database from a description file\nUsage: $0 host:port genesis-file')
        .demand(2)
        .alias('v', 'verbose')
        .argv;

    url = argv._[0].split(':');
    client = riak.getClient({host: url[0], port: url[1]});

    // Load coffee-script to get the require hook installed.
    try {
        coffee = require('coffee-script');
        if (coffee.register) {
            coffee.register();
        }
    } catch (e) {
        if (argv.verbose) {
            console.error('Could not load coffee-script');
            console.error('genesis files in coffee-script not supported');
        }
    }

    processFile(argv._[1], client, {verbose: argv.verbose});
}

module.exports = {
    processFile: processFile,
    iterateContextAsync: seedContext,
    seedContext: seedContext
};

// Do stuff if this is the main module.
if (require.main === module) {
    main();
}
