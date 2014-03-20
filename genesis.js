#!/usr/bin/env node
'use strict';

var async = require('async'),
    path = require('path');

/**
 * Expose the functions that make the DSL to the given context.
 */
function seedContext(ctx) {
    var buckets = {},
        lastObj;

    /**
     * Define a new bucket, the returned value is a function that creates
     * members of the bucket.
     */
    ctx.bucket = function (name) {
        var bucket = buckets[name];

        if (!bucket) {
            buckets[name] = bucket = function (key, data, fun) {
                if (typeof data === 'function') {
                    fun = data;
                    data = undefined;
                }

                lastObj = bucket[key];

                if (!lastObj) {
                    bucket[key] = lastObj = {
                        key: key,
                        bucket: name,
                        data: data || {},
                        links: []
                    };
                } else if (data) {
                    throw new Error("Trying to override data of " + bucket + "/" + key);
                }

                // Run callback in context of data object.
                if (fun) {
                    fun.call(lastObj.data);
                }

                return lastObj;
            };
        }

        return bucket;
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
        if (!lastObj) {
            throw new Error("link called with no active object");
        }

        if (!link) {
            throw new Error("link called without arguments");
        }

        if (link.bucket && link.key) {
            link = {
                bucket: link.bucket,
                key: link.key,
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

        lastObj.links.push(link);
    };

    return buckets;
}

/**
 * Iterate over each item in each bucket.
 */
function iterateContextAsync(context, iterator, done) {
    var workers = 4;

    async.eachSeries(Object.keys(context), function (name, callback) {
        var bucket = context[name];

        async.eachLimit(Object.keys(bucket), workers, function (key, callback) {
            var obj = bucket[key];
            iterator(name, obj, callback);
        }, callback);
    }, done);
}

/**
 * Execute a seed file and save the defined objects to RIAK.
 */
function processFile(file, riak, options, callback) {
    var abspath = path.resolve(file),
        buckets;

    function saveOne(bucket, obj, callback) {
        if (options.verbose) {
            console.error('Saving ' + bucket + '/' + obj.key);
        }

        var meta = {links: obj.links};
        riak.save(bucket, obj.key, obj.data, meta, function (err) {
            if (err) {
                console.error(err);
            }
            callback();
        });
    }

    buckets = seedContext(global);
    require(abspath);
    iterateContextAsync(buckets, saveOne, callback);
}

/**
 * Script behaviour
 */
function main() {
    var riak = require('riak-js'),
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
        require('coffee-script');
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
