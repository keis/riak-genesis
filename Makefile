LMOCHA=./node_modules/.bin/_mocha
MOCHA=./node_modules/.bin/mocha
ISTANBUL=./node_modules/.bin/istanbul

MOCHAFLAGS=--require test/bootstrap.js --compilers coffee:coffee-script

.PHONY: test coverage coverage/coverage.html coverage/coverage.json

test: ${MOCHA}
test:
	${MOCHA} ${MOCHAFLAGS} test

coverage: coverage/index.html

coverage/index.html: coverage/coverage.json
	${ISTANBUL} report html

coverage/coverage.json: ${ISTANBUL} ${MOCHA}
coverage/coverage.json:
	${ISTANBUL} cover ${LMOCHA} -- ${MOCHAFLAGS} test

node_modules/.bin/mocha node_modules/.bin/istanbul:
	npm install
