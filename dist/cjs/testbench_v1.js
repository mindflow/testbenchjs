'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var coreutil_v1 = require('coreutil_v1');

class ObjectProvider {

    constructor() {
    }


    
    provide(theClass, args = []) {
        return new Promise((resolve, reject) => {
            resolve(new theClass(...args));
        });
    }

}

class TestClassState {

    static get RUNNING() { return 0; }
    static get SUCCESS() { return 1; }
    static get FAIL() { return -1; }

    /**
     * 
     * @param {String} className 
     * @param {String} state 
     */
    constructor(state, className, functionName) {

        /** @type {String} */
        this.state = state;

        /** @type {String} */
        this.className = className;

        /** @type {String} */
        this.functionName = functionName;
        
    }
}

class TestExecutionContext {

    /**
     * 
     * @param {Map} testClassMap
     * @param {ObjectProvider} objectProvider 
     * @param {ObjectFunction} resultListener 
     */
    constructor(testClassMap, objectProvider, resultListener = null) {

        /** @type {ObjectFunction} */
        this.resultListener = resultListener;

        /** @type {ObjectProvider} */
        this.objectProvider = objectProvider;

        /** @type {Map} */
        this.testClassMap = testClassMap;

        /** @type {Map} */
        this.testObjectMap = new coreutil_v1.Map();

        /** @type {List} */
        this.runSuccessTestList = new coreutil_v1.List();

        /** @type {List} */
        this.runFailTestList = new coreutil_v1.List();
        
    }

}

class TestTrigger {

    /**
     * Run test by class name
     * @param {string} className 
     * @param {string} functionName 
     */
    runFunction(className, functionName) {

    }

    /**
     * Run test by class name
     * @param {string} className 
     */
    runClass(className) {

    }

    /**
     * Run all test classes
     */
    runAll() {
        
    }
}

const LOG = new coreutil_v1.Logger("TestBench");

class TestBench extends TestTrigger {

    /**
     * 
     * @param {ObjectFunction} logListener 
     * @param {ObjectFunction} resultListener 
     * @param {ObjectProvider} objectProvider
     */
    constructor(logListener = null,
            resultListener = null, 
            objectProvider = new ObjectProvider()) {
        
        super();

        /** @type {ObjectFunction} */
        this.logListener = logListener;

        /** @type {Map} */
        this.testClassMap = new coreutil_v1.Map();

        /** @type {ObjectFunction} */
        this.resultListener = resultListener;

        /** @type {ObjectProvider} */
        this.objectProvider = objectProvider;

    }

    /**
     * 
     * @param {Function} testClass 
     * @returns {TestBench}
     */
    addTest(testClass) {
        if (!testClass.testFunctions || !(testClass.testFunctions() instanceof coreutil_v1.List)) {
            throw "A static function called 'testFunctions' must be provided in " 
                + testClass.name 
                + " which returns a List all the test functions in "
                + testClass.name + ".prototype"
        }
        testClass.testFunctions().forEach((value,parent) => {
            if(!value) {
                throw testClass.name + ".testFunctions() refers to missing functions";
            }
            return true;
        }, this);
        this.testClassMap.set(testClass.name, testClass);
        return this;
    }

    contains(testClass) {
        return this.testClassMap.contains(testClass.name);
    }

    runAll() {
        coreutil_v1.Logger.listener = this.logListener;
        let context = new TestExecutionContext(this.testClassMap, this.objectProvider, this.resultListener);
        return this.testClassMap.promiseChain(TestBench.run, context).then(() => {
            TestBench.close(context);
        }).catch((error) => {
            throw error;
        });
    }

    /**
     * Run test by class name
     * @param {string} testClassName 
     */
    runClass(testClassName) {
        coreutil_v1.Logger.listener = this.logListener;
        let testClass = this.testClassMap.get(testClassName);
        let context = new TestExecutionContext(this.testClassMap, this.objectProvider, this.resultListener);
        return TestBench.run(testClassName, testClass, context).then(() => {
            TestBench.close(context);
        }).catch((error) => {
            throw error;
        });
    }

    /**
     * Run test by class name
     * @param {string} testClassName 
     */
    runFunction(testClassName, functionName) {
        coreutil_v1.Logger.listener = this.logListener;
        let testClass = this.testClassMap.get(testClassName);
        let context = new TestExecutionContext(this.testClassMap, this.objectProvider, this.resultListener);
        return TestBench.run(testClassName, testClass, context, functionName).then(() => {
            TestBench.close(context);
        }).catch((error) => {
            throw error;
        });
    }

    /**
     * 
     * @param {String} testClassName
     * @param {Object} testClass 
     * @param {TestExecutionContext} context 
     * @return {Promise}
     */
    static run(testClassName, testClass, context, functionName = null) {
        TestBench.printHeader(testClass.name);
        return TestBench.runFunctionsByClass(testClass, context, functionName);
    }

    /**
     * 
     * @param {List} functions 
     * @param {String} functionName 
     */
    static filter(functions, functionName) {
        if (!functionName) {
            return functions;
        }
        return functions.filter((value) => {
            return value === functionName;
        });
    }

    /**
     * 
     * @param {Object} testClass 
     * @param {TestExecutionContext} context 
     */
    static loadObjectByClass(testClass, context) {
        return new Promise((resolve, reject) => {
            if (context.testObjectMap.contains(testClass.name)) {
                resolve();
                return;
            }
            context.objectProvider.provide(testClass).then((testObject) => {
                context.testObjectMap.set(testClass.name, testObject);
                resolve();
            }).catch((error) => {
                reject(error);
            });
        });
    }

    /**
     * 
     * @param {Object} testClass 
     * @param {TestExecutionContext} context 
     */
    static runFunctionsByClass(testClass, context, functionName) {
        /** @type {List} */
        const testFunctions = testClass.testFunctions();
        return testFunctions.promiseChain((testFunction) => {
            if (functionName && testFunction.name !== functionName) {
                return Promise.resolve();
            }
            return new Promise((functionCompleteResolve, reject) => {
                TestBench.runFunction(testClass, testFunction, functionCompleteResolve, context);
            });
        }, context);
    }

    /**
     * 
     * @param {Object} testClass 
     * @param {Function} testFunction 
     * @param {Function} functionCompleteResolve
     * @param {TestExecutionContext} context 
     */
    static runFunction(testClass, testFunction, functionCompleteResolve, context) {
        TestBench.callResultListener(context, TestClassState.RUNNING, testClass, testFunction);
        TestBench.loadObjectByClass(testClass, context).then(() => {
            const testObject = context.testObjectMap.get(testClass.name);

            /** @type {Promise} */
            let testFunctionResult = null;

            try {
                testFunctionResult = testFunction.call(testObject);
                if (!(testFunctionResult instanceof Promise)) {
                    TestBench.reportSuccess(testClass, testFunction, context);
                };
            } catch (exception) {
                TestBench.reportFailure(testClass, testFunction, exception, context);
            }

            if (!(testFunctionResult instanceof Promise)) {
                functionCompleteResolve();
                return;
            }

            testFunctionResult.then(() => {
                TestBench.reportSuccess(testClass, testFunction, context);
                functionCompleteResolve();
            }).catch((exception) => {
                TestBench.reportFailure(testClass, testFunction, exception, context);
                functionCompleteResolve();
            });
        });
    }

    /**
     * 
     * @param {Object} testClass 
     * @param {Function} testFunction 
     * @param {Error} exception 
     * @param {TestExecutionContext} context 
     */
    static reportFailure(testClass, testFunction, exception, context) {
        TestBench.addFail(testClass, testFunction, context);
        TestBench.callResultListener(context, TestClassState.FAIL, testClass, testFunction);
        LOG.error(TestBench.signature(testClass, testFunction) + " failed. Reason:");
        LOG.error(exception);
        LOG.error("");
    }

    /**
     * 
     * @param {Object} testClass 
     * @param {Function} testFunction 
     * @param {TestExecutionContext} context 
     */
    static reportSuccess(testClass, testFunction, context) {
        TestBench.addSuccess(testClass, testFunction, context);
        TestBench.callResultListener(context, TestClassState.SUCCESS, testClass, testFunction);
    }

    /**
     * 
     * @param {Object} testClass 
     * @param {Number} state 
     * @param {TestExecutionContext} context 
     */
    static callResultListener(context, state, testClass, testFunction) {
        if (!context.resultListener) {
            return;
        }
        context.resultListener.call(new TestClassState(state, testClass.name, testFunction ? testFunction.name : null));
    }

    /**
     * 
     * @param {Object} testClass 
     * @param {Function} testFunction 
     * @param {TestExecutionContext} context 
     */
    static addSuccess(testClass, testFunction, context) {
        context.runSuccessTestList.add(TestBench.signature(testClass, testFunction));
    }

    /**
     * 
     * @param {Object} testClass 
     * @param {Function} testFunction 
     * @param {TestExecutionContext} context 
     */
    static addFail(testClass, testFunction, context) {
        context.runFailTestList.add(TestBench.signature(testClass, testFunction));
    }

    /**
     * 
     * @param {Object} testClass 
     * @param {Function} testFunction 
     */
    static signature(testClass, testFunction) {
        return testClass.name + "." + testFunction.name + "()";
    }

    /**
     * 
     * @param {TestExecutionContext} context 
     */
    static close(context) {
        try {
            TestBench.printReport(context);
        } finally {
            coreutil_v1.Logger.clearListener();
        }
    }

    /**
     * 
     * @param {String} testName 
     */
    static printHeader(testName) {
        const line = "#  Running test: " + testName + "  #";
        let decoration = "";
        for (let i = 0; i < line.length ; i++) {
            decoration = decoration + "#";
        }
        LOG.info(decoration);
        LOG.info(line);
        LOG.info(decoration);
        LOG.info("");
    }

    /**
     * 
     * @param {TestExecutionContext} context 
     */
    static printReport(context) {
        LOG.info("###################");
        LOG.info("#   Test Report   #");
        LOG.info("###################");
        LOG.info("");

        let successCounter = 0;
        if (context.runSuccessTestList.size() > 0){
            LOG.info("Succeeded:");
            context.runSuccessTestList.forEach((value,context) => {
                LOG.info(successCounter++ + ". " + value);
                return true;
            });
            LOG.info("");
        }

        let failCounter = 0;
        if (context.runFailTestList.size() > 0){
            LOG.info("Failed:");
            context.runFailTestList.forEach((value,context) => {
                LOG.info(failCounter++ + ". " + value);
                return true;
            });
            LOG.info("");
        }

        if (failCounter != 0) {
            throw context.runFailTestList.size() + " Tests failed";
        }
    }

}

class AssertBoolean {

    static assertTrue(boolean = true) {
        if(boolean) {
            return;
        }
        throw "Boolean assertion failed. Expected true but was " + boolean;
    }

}

class AssertString {

    static assertEquals(expected, actual) {
        if (expected === actual) {
            return;
        }
        throw "String Assertion Failed. Expected: '" + expected + "' Actual: '" + actual + "'";
    }

}

exports.AssertBoolean = AssertBoolean;
exports.AssertString = AssertString;
exports.ObjectProvider = ObjectProvider;
exports.TestBench = TestBench;
exports.TestClassState = TestClassState;
exports.TestExecutionContext = TestExecutionContext;
exports.TestTrigger = TestTrigger;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdGJlbmNoX3YxLmpzIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdGVzdGJlbmNoL29iamVjdFByb3ZpZGVyLmpzIiwiLi4vLi4vc3JjL3Rlc3RiZW5jaC90ZXN0Q2xhc3NTdGF0ZS5qcyIsIi4uLy4uL3NyYy90ZXN0YmVuY2gvdGVzdEV4ZWN1dGlvbkNvbnRleHQuanMiLCIuLi8uLi9zcmMvdGVzdGJlbmNoL3Rlc3RUcmlnZ2VyLmpzIiwiLi4vLi4vc3JjL3Rlc3RiZW5jaC90ZXN0QmVuY2guanMiLCIuLi8uLi9zcmMvdGVzdGJlbmNoL2Fzc2VydGlvbnMvYXNzZXJ0Qm9vbGVhbi5qcyIsIi4uLy4uL3NyYy90ZXN0YmVuY2gvYXNzZXJ0aW9ucy9hc3NlcnRTdHJpbmcuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGNsYXNzIE9iamVjdFByb3ZpZGVyIHtcblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgIH1cblxuXG4gICAgXG4gICAgcHJvdmlkZSh0aGVDbGFzcywgYXJncyA9IFtdKSB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICByZXNvbHZlKG5ldyB0aGVDbGFzcyguLi5hcmdzKSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxufSIsImV4cG9ydCBjbGFzcyBUZXN0Q2xhc3NTdGF0ZSB7XG5cbiAgICBzdGF0aWMgZ2V0IFJVTk5JTkcoKSB7IHJldHVybiAwOyB9XG4gICAgc3RhdGljIGdldCBTVUNDRVNTKCkgeyByZXR1cm4gMTsgfVxuICAgIHN0YXRpYyBnZXQgRkFJTCgpIHsgcmV0dXJuIC0xOyB9XG5cbiAgICAvKipcbiAgICAgKiBcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gY2xhc3NOYW1lIFxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBzdGF0ZSBcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihzdGF0ZSwgY2xhc3NOYW1lLCBmdW5jdGlvbk5hbWUpIHtcblxuICAgICAgICAvKiogQHR5cGUge1N0cmluZ30gKi9cbiAgICAgICAgdGhpcy5zdGF0ZSA9IHN0YXRlO1xuXG4gICAgICAgIC8qKiBAdHlwZSB7U3RyaW5nfSAqL1xuICAgICAgICB0aGlzLmNsYXNzTmFtZSA9IGNsYXNzTmFtZTtcblxuICAgICAgICAvKiogQHR5cGUge1N0cmluZ30gKi9cbiAgICAgICAgdGhpcy5mdW5jdGlvbk5hbWUgPSBmdW5jdGlvbk5hbWU7XG4gICAgICAgIFxuICAgIH1cbn0iLCJpbXBvcnQgeyBMaXN0LCBNYXAsIE9iamVjdEZ1bmN0aW9uIH0gZnJvbSBcImNvcmV1dGlsX3YxXCI7XG5pbXBvcnQgeyBPYmplY3RQcm92aWRlciB9IGZyb20gXCIuL29iamVjdFByb3ZpZGVyLmpzXCI7XG5cbmV4cG9ydCBjbGFzcyBUZXN0RXhlY3V0aW9uQ29udGV4dCB7XG5cbiAgICAvKipcbiAgICAgKiBcbiAgICAgKiBAcGFyYW0ge01hcH0gdGVzdENsYXNzTWFwXG4gICAgICogQHBhcmFtIHtPYmplY3RQcm92aWRlcn0gb2JqZWN0UHJvdmlkZXIgXG4gICAgICogQHBhcmFtIHtPYmplY3RGdW5jdGlvbn0gcmVzdWx0TGlzdGVuZXIgXG4gICAgICovXG4gICAgY29uc3RydWN0b3IodGVzdENsYXNzTWFwLCBvYmplY3RQcm92aWRlciwgcmVzdWx0TGlzdGVuZXIgPSBudWxsKSB7XG5cbiAgICAgICAgLyoqIEB0eXBlIHtPYmplY3RGdW5jdGlvbn0gKi9cbiAgICAgICAgdGhpcy5yZXN1bHRMaXN0ZW5lciA9IHJlc3VsdExpc3RlbmVyO1xuXG4gICAgICAgIC8qKiBAdHlwZSB7T2JqZWN0UHJvdmlkZXJ9ICovXG4gICAgICAgIHRoaXMub2JqZWN0UHJvdmlkZXIgPSBvYmplY3RQcm92aWRlcjtcblxuICAgICAgICAvKiogQHR5cGUge01hcH0gKi9cbiAgICAgICAgdGhpcy50ZXN0Q2xhc3NNYXAgPSB0ZXN0Q2xhc3NNYXA7XG5cbiAgICAgICAgLyoqIEB0eXBlIHtNYXB9ICovXG4gICAgICAgIHRoaXMudGVzdE9iamVjdE1hcCA9IG5ldyBNYXAoKTtcblxuICAgICAgICAvKiogQHR5cGUge0xpc3R9ICovXG4gICAgICAgIHRoaXMucnVuU3VjY2Vzc1Rlc3RMaXN0ID0gbmV3IExpc3QoKTtcblxuICAgICAgICAvKiogQHR5cGUge0xpc3R9ICovXG4gICAgICAgIHRoaXMucnVuRmFpbFRlc3RMaXN0ID0gbmV3IExpc3QoKTtcbiAgICAgICAgXG4gICAgfVxuXG59IiwiZXhwb3J0IGNsYXNzIFRlc3RUcmlnZ2VyIHtcblxuICAgIC8qKlxuICAgICAqIFJ1biB0ZXN0IGJ5IGNsYXNzIG5hbWVcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY2xhc3NOYW1lIFxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBmdW5jdGlvbk5hbWUgXG4gICAgICovXG4gICAgcnVuRnVuY3Rpb24oY2xhc3NOYW1lLCBmdW5jdGlvbk5hbWUpIHtcblxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJ1biB0ZXN0IGJ5IGNsYXNzIG5hbWVcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY2xhc3NOYW1lIFxuICAgICAqL1xuICAgIHJ1bkNsYXNzKGNsYXNzTmFtZSkge1xuXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUnVuIGFsbCB0ZXN0IGNsYXNzZXNcbiAgICAgKi9cbiAgICBydW5BbGwoKSB7XG4gICAgICAgIFxuICAgIH1cbn0iLCJpbXBvcnQgeyBMaXN0LCBMb2dnZXIsIE1hcCwgT2JqZWN0RnVuY3Rpb24gfSBmcm9tIFwiY29yZXV0aWxfdjFcIjtcbmltcG9ydCB7IE9iamVjdFByb3ZpZGVyIH0gZnJvbSBcIi4vb2JqZWN0UHJvdmlkZXIuanNcIjtcbmltcG9ydCB7IFRlc3RDbGFzc1N0YXRlIH0gZnJvbSBcIi4vdGVzdENsYXNzU3RhdGUuanNcIjtcbmltcG9ydCB7IFRlc3RFeGVjdXRpb25Db250ZXh0IH0gZnJvbSBcIi4vdGVzdEV4ZWN1dGlvbkNvbnRleHQuanNcIjtcbmltcG9ydCB7IFRlc3RUcmlnZ2VyIH0gZnJvbSBcIi4vdGVzdFRyaWdnZXIuanNcIjtcblxuY29uc3QgTE9HID0gbmV3IExvZ2dlcihcIlRlc3RCZW5jaFwiKTtcblxuZXhwb3J0IGNsYXNzIFRlc3RCZW5jaCBleHRlbmRzIFRlc3RUcmlnZ2VyIHtcblxuICAgIC8qKlxuICAgICAqIFxuICAgICAqIEBwYXJhbSB7T2JqZWN0RnVuY3Rpb259IGxvZ0xpc3RlbmVyIFxuICAgICAqIEBwYXJhbSB7T2JqZWN0RnVuY3Rpb259IHJlc3VsdExpc3RlbmVyIFxuICAgICAqIEBwYXJhbSB7T2JqZWN0UHJvdmlkZXJ9IG9iamVjdFByb3ZpZGVyXG4gICAgICovXG4gICAgY29uc3RydWN0b3IobG9nTGlzdGVuZXIgPSBudWxsLFxuICAgICAgICAgICAgcmVzdWx0TGlzdGVuZXIgPSBudWxsLCBcbiAgICAgICAgICAgIG9iamVjdFByb3ZpZGVyID0gbmV3IE9iamVjdFByb3ZpZGVyKCkpIHtcbiAgICAgICAgXG4gICAgICAgIHN1cGVyKCk7XG5cbiAgICAgICAgLyoqIEB0eXBlIHtPYmplY3RGdW5jdGlvbn0gKi9cbiAgICAgICAgdGhpcy5sb2dMaXN0ZW5lciA9IGxvZ0xpc3RlbmVyO1xuXG4gICAgICAgIC8qKiBAdHlwZSB7TWFwfSAqL1xuICAgICAgICB0aGlzLnRlc3RDbGFzc01hcCA9IG5ldyBNYXAoKTtcblxuICAgICAgICAvKiogQHR5cGUge09iamVjdEZ1bmN0aW9ufSAqL1xuICAgICAgICB0aGlzLnJlc3VsdExpc3RlbmVyID0gcmVzdWx0TGlzdGVuZXI7XG5cbiAgICAgICAgLyoqIEB0eXBlIHtPYmplY3RQcm92aWRlcn0gKi9cbiAgICAgICAgdGhpcy5vYmplY3RQcm92aWRlciA9IG9iamVjdFByb3ZpZGVyO1xuXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gdGVzdENsYXNzIFxuICAgICAqIEByZXR1cm5zIHtUZXN0QmVuY2h9XG4gICAgICovXG4gICAgYWRkVGVzdCh0ZXN0Q2xhc3MpIHtcbiAgICAgICAgaWYgKCF0ZXN0Q2xhc3MudGVzdEZ1bmN0aW9ucyB8fCAhKHRlc3RDbGFzcy50ZXN0RnVuY3Rpb25zKCkgaW5zdGFuY2VvZiBMaXN0KSkge1xuICAgICAgICAgICAgdGhyb3cgXCJBIHN0YXRpYyBmdW5jdGlvbiBjYWxsZWQgJ3Rlc3RGdW5jdGlvbnMnIG11c3QgYmUgcHJvdmlkZWQgaW4gXCIgXG4gICAgICAgICAgICAgICAgKyB0ZXN0Q2xhc3MubmFtZSBcbiAgICAgICAgICAgICAgICArIFwiIHdoaWNoIHJldHVybnMgYSBMaXN0IGFsbCB0aGUgdGVzdCBmdW5jdGlvbnMgaW4gXCJcbiAgICAgICAgICAgICAgICArIHRlc3RDbGFzcy5uYW1lICsgXCIucHJvdG90eXBlXCJcbiAgICAgICAgfVxuICAgICAgICB0ZXN0Q2xhc3MudGVzdEZ1bmN0aW9ucygpLmZvckVhY2goKHZhbHVlLHBhcmVudCkgPT4ge1xuICAgICAgICAgICAgaWYoIXZhbHVlKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgdGVzdENsYXNzLm5hbWUgKyBcIi50ZXN0RnVuY3Rpb25zKCkgcmVmZXJzIHRvIG1pc3NpbmcgZnVuY3Rpb25zXCI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSwgdGhpcyk7XG4gICAgICAgIHRoaXMudGVzdENsYXNzTWFwLnNldCh0ZXN0Q2xhc3MubmFtZSwgdGVzdENsYXNzKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgY29udGFpbnModGVzdENsYXNzKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnRlc3RDbGFzc01hcC5jb250YWlucyh0ZXN0Q2xhc3MubmFtZSk7XG4gICAgfVxuXG4gICAgcnVuQWxsKCkge1xuICAgICAgICBMb2dnZXIubGlzdGVuZXIgPSB0aGlzLmxvZ0xpc3RlbmVyO1xuICAgICAgICBsZXQgY29udGV4dCA9IG5ldyBUZXN0RXhlY3V0aW9uQ29udGV4dCh0aGlzLnRlc3RDbGFzc01hcCwgdGhpcy5vYmplY3RQcm92aWRlciwgdGhpcy5yZXN1bHRMaXN0ZW5lcik7XG4gICAgICAgIHJldHVybiB0aGlzLnRlc3RDbGFzc01hcC5wcm9taXNlQ2hhaW4oVGVzdEJlbmNoLnJ1biwgY29udGV4dCkudGhlbigoKSA9PiB7XG4gICAgICAgICAgICBUZXN0QmVuY2guY2xvc2UoY29udGV4dCk7XG4gICAgICAgIH0pLmNhdGNoKChlcnJvcikgPT4ge1xuICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJ1biB0ZXN0IGJ5IGNsYXNzIG5hbWVcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdGVzdENsYXNzTmFtZSBcbiAgICAgKi9cbiAgICBydW5DbGFzcyh0ZXN0Q2xhc3NOYW1lKSB7XG4gICAgICAgIExvZ2dlci5saXN0ZW5lciA9IHRoaXMubG9nTGlzdGVuZXI7XG4gICAgICAgIGxldCB0ZXN0Q2xhc3MgPSB0aGlzLnRlc3RDbGFzc01hcC5nZXQodGVzdENsYXNzTmFtZSk7XG4gICAgICAgIGxldCBjb250ZXh0ID0gbmV3IFRlc3RFeGVjdXRpb25Db250ZXh0KHRoaXMudGVzdENsYXNzTWFwLCB0aGlzLm9iamVjdFByb3ZpZGVyLCB0aGlzLnJlc3VsdExpc3RlbmVyKTtcbiAgICAgICAgcmV0dXJuIFRlc3RCZW5jaC5ydW4odGVzdENsYXNzTmFtZSwgdGVzdENsYXNzLCBjb250ZXh0KS50aGVuKCgpID0+IHtcbiAgICAgICAgICAgIFRlc3RCZW5jaC5jbG9zZShjb250ZXh0KTtcbiAgICAgICAgfSkuY2F0Y2goKGVycm9yKSA9PiB7XG4gICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUnVuIHRlc3QgYnkgY2xhc3MgbmFtZVxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB0ZXN0Q2xhc3NOYW1lIFxuICAgICAqL1xuICAgIHJ1bkZ1bmN0aW9uKHRlc3RDbGFzc05hbWUsIGZ1bmN0aW9uTmFtZSkge1xuICAgICAgICBMb2dnZXIubGlzdGVuZXIgPSB0aGlzLmxvZ0xpc3RlbmVyO1xuICAgICAgICBsZXQgdGVzdENsYXNzID0gdGhpcy50ZXN0Q2xhc3NNYXAuZ2V0KHRlc3RDbGFzc05hbWUpO1xuICAgICAgICBsZXQgY29udGV4dCA9IG5ldyBUZXN0RXhlY3V0aW9uQ29udGV4dCh0aGlzLnRlc3RDbGFzc01hcCwgdGhpcy5vYmplY3RQcm92aWRlciwgdGhpcy5yZXN1bHRMaXN0ZW5lcik7XG4gICAgICAgIHJldHVybiBUZXN0QmVuY2gucnVuKHRlc3RDbGFzc05hbWUsIHRlc3RDbGFzcywgY29udGV4dCwgZnVuY3Rpb25OYW1lKS50aGVuKCgpID0+IHtcbiAgICAgICAgICAgIFRlc3RCZW5jaC5jbG9zZShjb250ZXh0KTtcbiAgICAgICAgfSkuY2F0Y2goKGVycm9yKSA9PiB7XG4gICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHRlc3RDbGFzc05hbWVcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gdGVzdENsYXNzIFxuICAgICAqIEBwYXJhbSB7VGVzdEV4ZWN1dGlvbkNvbnRleHR9IGNvbnRleHQgXG4gICAgICogQHJldHVybiB7UHJvbWlzZX1cbiAgICAgKi9cbiAgICBzdGF0aWMgcnVuKHRlc3RDbGFzc05hbWUsIHRlc3RDbGFzcywgY29udGV4dCwgZnVuY3Rpb25OYW1lID0gbnVsbCkge1xuICAgICAgICBUZXN0QmVuY2gucHJpbnRIZWFkZXIodGVzdENsYXNzLm5hbWUpO1xuICAgICAgICByZXR1cm4gVGVzdEJlbmNoLnJ1bkZ1bmN0aW9uc0J5Q2xhc3ModGVzdENsYXNzLCBjb250ZXh0LCBmdW5jdGlvbk5hbWUpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFxuICAgICAqIEBwYXJhbSB7TGlzdH0gZnVuY3Rpb25zIFxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBmdW5jdGlvbk5hbWUgXG4gICAgICovXG4gICAgc3RhdGljIGZpbHRlcihmdW5jdGlvbnMsIGZ1bmN0aW9uTmFtZSkge1xuICAgICAgICBpZiAoIWZ1bmN0aW9uTmFtZSkge1xuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9ucztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZnVuY3Rpb25zLmZpbHRlcigodmFsdWUpID0+IHtcbiAgICAgICAgICAgIHJldHVybiB2YWx1ZSA9PT0gZnVuY3Rpb25OYW1lO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gdGVzdENsYXNzIFxuICAgICAqIEBwYXJhbSB7VGVzdEV4ZWN1dGlvbkNvbnRleHR9IGNvbnRleHQgXG4gICAgICovXG4gICAgc3RhdGljIGxvYWRPYmplY3RCeUNsYXNzKHRlc3RDbGFzcywgY29udGV4dCkge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgaWYgKGNvbnRleHQudGVzdE9iamVjdE1hcC5jb250YWlucyh0ZXN0Q2xhc3MubmFtZSkpIHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29udGV4dC5vYmplY3RQcm92aWRlci5wcm92aWRlKHRlc3RDbGFzcykudGhlbigodGVzdE9iamVjdCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnRleHQudGVzdE9iamVjdE1hcC5zZXQodGVzdENsYXNzLm5hbWUsIHRlc3RPYmplY3QpO1xuICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgIH0pLmNhdGNoKChlcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHRlc3RDbGFzcyBcbiAgICAgKiBAcGFyYW0ge1Rlc3RFeGVjdXRpb25Db250ZXh0fSBjb250ZXh0IFxuICAgICAqL1xuICAgIHN0YXRpYyBydW5GdW5jdGlvbnNCeUNsYXNzKHRlc3RDbGFzcywgY29udGV4dCwgZnVuY3Rpb25OYW1lKSB7XG4gICAgICAgIC8qKiBAdHlwZSB7TGlzdH0gKi9cbiAgICAgICAgY29uc3QgdGVzdEZ1bmN0aW9ucyA9IHRlc3RDbGFzcy50ZXN0RnVuY3Rpb25zKCk7XG4gICAgICAgIHJldHVybiB0ZXN0RnVuY3Rpb25zLnByb21pc2VDaGFpbigodGVzdEZ1bmN0aW9uKSA9PiB7XG4gICAgICAgICAgICBpZiAoZnVuY3Rpb25OYW1lICYmIHRlc3RGdW5jdGlvbi5uYW1lICE9PSBmdW5jdGlvbk5hbWUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKGZ1bmN0aW9uQ29tcGxldGVSZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgICAgICBUZXN0QmVuY2gucnVuRnVuY3Rpb24odGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24sIGZ1bmN0aW9uQ29tcGxldGVSZXNvbHZlLCBjb250ZXh0KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LCBjb250ZXh0KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gdGVzdENsYXNzIFxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IHRlc3RGdW5jdGlvbiBcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jdGlvbkNvbXBsZXRlUmVzb2x2ZVxuICAgICAqIEBwYXJhbSB7VGVzdEV4ZWN1dGlvbkNvbnRleHR9IGNvbnRleHQgXG4gICAgICovXG4gICAgc3RhdGljIHJ1bkZ1bmN0aW9uKHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uLCBmdW5jdGlvbkNvbXBsZXRlUmVzb2x2ZSwgY29udGV4dCkge1xuICAgICAgICBUZXN0QmVuY2guY2FsbFJlc3VsdExpc3RlbmVyKGNvbnRleHQsIFRlc3RDbGFzc1N0YXRlLlJVTk5JTkcsIHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uKTtcbiAgICAgICAgVGVzdEJlbmNoLmxvYWRPYmplY3RCeUNsYXNzKHRlc3RDbGFzcywgY29udGV4dCkudGhlbigoKSA9PiB7XG4gICAgICAgICAgICBjb25zdCB0ZXN0T2JqZWN0ID0gY29udGV4dC50ZXN0T2JqZWN0TWFwLmdldCh0ZXN0Q2xhc3MubmFtZSk7XG5cbiAgICAgICAgICAgIC8qKiBAdHlwZSB7UHJvbWlzZX0gKi9cbiAgICAgICAgICAgIGxldCB0ZXN0RnVuY3Rpb25SZXN1bHQgPSBudWxsO1xuXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHRlc3RGdW5jdGlvblJlc3VsdCA9IHRlc3RGdW5jdGlvbi5jYWxsKHRlc3RPYmplY3QpO1xuICAgICAgICAgICAgICAgIGlmICghKHRlc3RGdW5jdGlvblJlc3VsdCBpbnN0YW5jZW9mIFByb21pc2UpKSB7XG4gICAgICAgICAgICAgICAgICAgIFRlc3RCZW5jaC5yZXBvcnRTdWNjZXNzKHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uLCBjb250ZXh0KTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfSBjYXRjaCAoZXhjZXB0aW9uKSB7XG4gICAgICAgICAgICAgICAgVGVzdEJlbmNoLnJlcG9ydEZhaWx1cmUodGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24sIGV4Y2VwdGlvbiwgY29udGV4dCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghKHRlc3RGdW5jdGlvblJlc3VsdCBpbnN0YW5jZW9mIFByb21pc2UpKSB7XG4gICAgICAgICAgICAgICAgZnVuY3Rpb25Db21wbGV0ZVJlc29sdmUoKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRlc3RGdW5jdGlvblJlc3VsdC50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICBUZXN0QmVuY2gucmVwb3J0U3VjY2Vzcyh0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbiwgY29udGV4dCk7XG4gICAgICAgICAgICAgICAgZnVuY3Rpb25Db21wbGV0ZVJlc29sdmUoKTtcbiAgICAgICAgICAgIH0pLmNhdGNoKChleGNlcHRpb24pID0+IHtcbiAgICAgICAgICAgICAgICBUZXN0QmVuY2gucmVwb3J0RmFpbHVyZSh0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbiwgZXhjZXB0aW9uLCBjb250ZXh0KTtcbiAgICAgICAgICAgICAgICBmdW5jdGlvbkNvbXBsZXRlUmVzb2x2ZSgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSB0ZXN0Q2xhc3MgXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gdGVzdEZ1bmN0aW9uIFxuICAgICAqIEBwYXJhbSB7RXJyb3J9IGV4Y2VwdGlvbiBcbiAgICAgKiBAcGFyYW0ge1Rlc3RFeGVjdXRpb25Db250ZXh0fSBjb250ZXh0IFxuICAgICAqL1xuICAgIHN0YXRpYyByZXBvcnRGYWlsdXJlKHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uLCBleGNlcHRpb24sIGNvbnRleHQpIHtcbiAgICAgICAgVGVzdEJlbmNoLmFkZEZhaWwodGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24sIGNvbnRleHQpO1xuICAgICAgICBUZXN0QmVuY2guY2FsbFJlc3VsdExpc3RlbmVyKGNvbnRleHQsIFRlc3RDbGFzc1N0YXRlLkZBSUwsIHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uKTtcbiAgICAgICAgTE9HLmVycm9yKFRlc3RCZW5jaC5zaWduYXR1cmUodGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24pICsgXCIgZmFpbGVkLiBSZWFzb246XCIpO1xuICAgICAgICBMT0cuZXJyb3IoZXhjZXB0aW9uKTtcbiAgICAgICAgTE9HLmVycm9yKFwiXCIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSB0ZXN0Q2xhc3MgXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gdGVzdEZ1bmN0aW9uIFxuICAgICAqIEBwYXJhbSB7VGVzdEV4ZWN1dGlvbkNvbnRleHR9IGNvbnRleHQgXG4gICAgICovXG4gICAgc3RhdGljIHJlcG9ydFN1Y2Nlc3ModGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24sIGNvbnRleHQpIHtcbiAgICAgICAgVGVzdEJlbmNoLmFkZFN1Y2Nlc3ModGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24sIGNvbnRleHQpO1xuICAgICAgICBUZXN0QmVuY2guY2FsbFJlc3VsdExpc3RlbmVyKGNvbnRleHQsIFRlc3RDbGFzc1N0YXRlLlNVQ0NFU1MsIHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gdGVzdENsYXNzIFxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSBzdGF0ZSBcbiAgICAgKiBAcGFyYW0ge1Rlc3RFeGVjdXRpb25Db250ZXh0fSBjb250ZXh0IFxuICAgICAqL1xuICAgIHN0YXRpYyBjYWxsUmVzdWx0TGlzdGVuZXIoY29udGV4dCwgc3RhdGUsIHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uKSB7XG4gICAgICAgIGlmICghY29udGV4dC5yZXN1bHRMaXN0ZW5lcikge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnRleHQucmVzdWx0TGlzdGVuZXIuY2FsbChuZXcgVGVzdENsYXNzU3RhdGUoc3RhdGUsIHRlc3RDbGFzcy5uYW1lLCB0ZXN0RnVuY3Rpb24gPyB0ZXN0RnVuY3Rpb24ubmFtZSA6IG51bGwpKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gdGVzdENsYXNzIFxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IHRlc3RGdW5jdGlvbiBcbiAgICAgKiBAcGFyYW0ge1Rlc3RFeGVjdXRpb25Db250ZXh0fSBjb250ZXh0IFxuICAgICAqL1xuICAgIHN0YXRpYyBhZGRTdWNjZXNzKHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uLCBjb250ZXh0KSB7XG4gICAgICAgIGNvbnRleHQucnVuU3VjY2Vzc1Rlc3RMaXN0LmFkZChUZXN0QmVuY2guc2lnbmF0dXJlKHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uKSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHRlc3RDbGFzcyBcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSB0ZXN0RnVuY3Rpb24gXG4gICAgICogQHBhcmFtIHtUZXN0RXhlY3V0aW9uQ29udGV4dH0gY29udGV4dCBcbiAgICAgKi9cbiAgICBzdGF0aWMgYWRkRmFpbCh0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbiwgY29udGV4dCkge1xuICAgICAgICBjb250ZXh0LnJ1bkZhaWxUZXN0TGlzdC5hZGQoVGVzdEJlbmNoLnNpZ25hdHVyZSh0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbikpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSB0ZXN0Q2xhc3MgXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gdGVzdEZ1bmN0aW9uIFxuICAgICAqL1xuICAgIHN0YXRpYyBzaWduYXR1cmUodGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24pIHtcbiAgICAgICAgcmV0dXJuIHRlc3RDbGFzcy5uYW1lICsgXCIuXCIgKyB0ZXN0RnVuY3Rpb24ubmFtZSArIFwiKClcIjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBcbiAgICAgKiBAcGFyYW0ge1Rlc3RFeGVjdXRpb25Db250ZXh0fSBjb250ZXh0IFxuICAgICAqL1xuICAgIHN0YXRpYyBjbG9zZShjb250ZXh0KSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBUZXN0QmVuY2gucHJpbnRSZXBvcnQoY29udGV4dCk7XG4gICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgICBMb2dnZXIuY2xlYXJMaXN0ZW5lcigpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHRlc3ROYW1lIFxuICAgICAqL1xuICAgIHN0YXRpYyBwcmludEhlYWRlcih0ZXN0TmFtZSkge1xuICAgICAgICBjb25zdCBsaW5lID0gXCIjICBSdW5uaW5nIHRlc3Q6IFwiICsgdGVzdE5hbWUgKyBcIiAgI1wiO1xuICAgICAgICBsZXQgZGVjb3JhdGlvbiA9IFwiXCI7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGluZS5sZW5ndGggOyBpKyspIHtcbiAgICAgICAgICAgIGRlY29yYXRpb24gPSBkZWNvcmF0aW9uICsgXCIjXCI7XG4gICAgICAgIH1cbiAgICAgICAgTE9HLmluZm8oZGVjb3JhdGlvbik7XG4gICAgICAgIExPRy5pbmZvKGxpbmUpO1xuICAgICAgICBMT0cuaW5mbyhkZWNvcmF0aW9uKTtcbiAgICAgICAgTE9HLmluZm8oXCJcIik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogXG4gICAgICogQHBhcmFtIHtUZXN0RXhlY3V0aW9uQ29udGV4dH0gY29udGV4dCBcbiAgICAgKi9cbiAgICBzdGF0aWMgcHJpbnRSZXBvcnQoY29udGV4dCkge1xuICAgICAgICBMT0cuaW5mbyhcIiMjIyMjIyMjIyMjIyMjIyMjIyNcIik7XG4gICAgICAgIExPRy5pbmZvKFwiIyAgIFRlc3QgUmVwb3J0ICAgI1wiKTtcbiAgICAgICAgTE9HLmluZm8oXCIjIyMjIyMjIyMjIyMjIyMjIyMjXCIpO1xuICAgICAgICBMT0cuaW5mbyhcIlwiKTtcblxuICAgICAgICBsZXQgc3VjY2Vzc0NvdW50ZXIgPSAwO1xuICAgICAgICBpZiAoY29udGV4dC5ydW5TdWNjZXNzVGVzdExpc3Quc2l6ZSgpID4gMCl7XG4gICAgICAgICAgICBMT0cuaW5mbyhcIlN1Y2NlZWRlZDpcIik7XG4gICAgICAgICAgICBjb250ZXh0LnJ1blN1Y2Nlc3NUZXN0TGlzdC5mb3JFYWNoKCh2YWx1ZSxjb250ZXh0KSA9PiB7XG4gICAgICAgICAgICAgICAgTE9HLmluZm8oc3VjY2Vzc0NvdW50ZXIrKyArIFwiLiBcIiArIHZhbHVlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgTE9HLmluZm8oXCJcIik7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgZmFpbENvdW50ZXIgPSAwO1xuICAgICAgICBpZiAoY29udGV4dC5ydW5GYWlsVGVzdExpc3Quc2l6ZSgpID4gMCl7XG4gICAgICAgICAgICBMT0cuaW5mbyhcIkZhaWxlZDpcIik7XG4gICAgICAgICAgICBjb250ZXh0LnJ1bkZhaWxUZXN0TGlzdC5mb3JFYWNoKCh2YWx1ZSxjb250ZXh0KSA9PiB7XG4gICAgICAgICAgICAgICAgTE9HLmluZm8oZmFpbENvdW50ZXIrKyArIFwiLiBcIiArIHZhbHVlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgTE9HLmluZm8oXCJcIik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZmFpbENvdW50ZXIgIT0gMCkge1xuICAgICAgICAgICAgdGhyb3cgY29udGV4dC5ydW5GYWlsVGVzdExpc3Quc2l6ZSgpICsgXCIgVGVzdHMgZmFpbGVkXCI7XG4gICAgICAgIH1cbiAgICB9XG5cbn0iLCJleHBvcnQgY2xhc3MgQXNzZXJ0Qm9vbGVhbiB7XG5cbiAgICBzdGF0aWMgYXNzZXJ0VHJ1ZShib29sZWFuID0gdHJ1ZSkge1xuICAgICAgICBpZihib29sZWFuKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdGhyb3cgXCJCb29sZWFuIGFzc2VydGlvbiBmYWlsZWQuIEV4cGVjdGVkIHRydWUgYnV0IHdhcyBcIiArIGJvb2xlYW47XG4gICAgfVxuXG59IiwiZXhwb3J0IGNsYXNzIEFzc2VydFN0cmluZyB7XG5cbiAgICBzdGF0aWMgYXNzZXJ0RXF1YWxzKGV4cGVjdGVkLCBhY3R1YWwpIHtcbiAgICAgICAgaWYgKGV4cGVjdGVkID09PSBhY3R1YWwpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBcIlN0cmluZyBBc3NlcnRpb24gRmFpbGVkLiBFeHBlY3RlZDogJ1wiICsgZXhwZWN0ZWQgKyBcIicgQWN0dWFsOiAnXCIgKyBhY3R1YWwgKyBcIidcIjtcbiAgICB9XG5cbn0iXSwibmFtZXMiOlsiTWFwIiwiTGlzdCIsIkxvZ2dlciJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQU8sTUFBTSxjQUFjLENBQUM7QUFDNUI7QUFDQSxJQUFJLFdBQVcsR0FBRztBQUNsQixLQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0EsSUFBSSxPQUFPLENBQUMsUUFBUSxFQUFFLElBQUksR0FBRyxFQUFFLEVBQUU7QUFDakMsUUFBUSxPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLE1BQU0sS0FBSztBQUNoRCxZQUFZLE9BQU8sQ0FBQyxJQUFJLFFBQVEsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUM7QUFDM0MsU0FBUyxDQUFDLENBQUM7QUFDWCxLQUFLO0FBQ0w7QUFDQTs7QUNiTyxNQUFNLGNBQWMsQ0FBQztBQUM1QjtBQUNBLElBQUksV0FBVyxPQUFPLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQyxFQUFFO0FBQ3RDLElBQUksV0FBVyxPQUFPLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQyxFQUFFO0FBQ3RDLElBQUksV0FBVyxJQUFJLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUU7QUFDcEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBSSxXQUFXLENBQUMsS0FBSyxFQUFFLFNBQVMsRUFBRSxZQUFZLEVBQUU7QUFDaEQ7QUFDQTtBQUNBLFFBQVEs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
