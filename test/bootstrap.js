'use strict';

var chai = require('chai'),
    sinon = require('sinon');

global.assert = chai.assert;
sinon.assert.expose(chai.assert, {prefix: ''});
