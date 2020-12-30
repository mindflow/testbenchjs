import { Map, List, Logger } from './coreutil_v1.js'

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
        this.testObjectMap = new Map();

        /** @type {List} */
        this.runSuccessTestList = new List();

        /** @type {List} */
        this.runFailTestList = new List();
        
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

const LOG = new Logger("TestBench");

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
        this.testClassMap = new Map();

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
        if (!testClass.testFunctions || !(testClass.testFunctions() instanceof List)) {
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
        Logger.listener = this.logListener;
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
        Logger.listener = this.logListener;
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
        Logger.listener = this.logListener;
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
     */
    static run(testClassName, testClass, context, functionName = null) {
        return new Promise((resolve, reject) => {
            TestBench.printHeader(testClass.name);
            TestBench.runFunctionsByClass(testClass, context, functionName).then(() => {
                resolve();
            }).catch((error) => {
                reject(error);
            });
        });
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
                return new Promise((resolve,reject) => { resolve(); });
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
            Logger.clearListener();
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

export { AssertBoolean, AssertString, ObjectProvider, TestBench, TestClassState, TestExecutionContext, TestTrigger };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdGJlbmNoX3YxLmpzIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdGVzdGJlbmNoL2Fzc2VydGlvbnMvYXNzZXJ0Qm9vbGVhbi5qcyIsIi4uLy4uL3NyYy90ZXN0YmVuY2gvYXNzZXJ0aW9ucy9hc3NlcnRTdHJpbmcuanMiLCIuLi8uLi9zcmMvdGVzdGJlbmNoL29iamVjdFByb3ZpZGVyLmpzIiwiLi4vLi4vc3JjL3Rlc3RiZW5jaC90ZXN0Q2xhc3NTdGF0ZS5qcyIsIi4uLy4uL3NyYy90ZXN0YmVuY2gvdGVzdEV4ZWN1dGlvbkNvbnRleHQuanMiLCIuLi8uLi9zcmMvdGVzdGJlbmNoL3Rlc3RUcmlnZ2VyLmpzIiwiLi4vLi4vc3JjL3Rlc3RiZW5jaC90ZXN0QmVuY2guanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGNsYXNzIEFzc2VydEJvb2xlYW4ge1xyXG5cclxuICAgIHN0YXRpYyBhc3NlcnRUcnVlKGJvb2xlYW4gPSB0cnVlKSB7XHJcbiAgICAgICAgaWYoYm9vbGVhbikge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRocm93IFwiQm9vbGVhbiBhc3NlcnRpb24gZmFpbGVkLiBFeHBlY3RlZCB0cnVlIGJ1dCB3YXMgXCIgKyBib29sZWFuO1xyXG4gICAgfVxyXG5cclxufSIsImV4cG9ydCBjbGFzcyBBc3NlcnRTdHJpbmcge1xyXG5cclxuICAgIHN0YXRpYyBhc3NlcnRFcXVhbHMoZXhwZWN0ZWQsIGFjdHVhbCkge1xyXG4gICAgICAgIGlmIChleHBlY3RlZCA9PT0gYWN0dWFsKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhyb3cgXCJTdHJpbmcgQXNzZXJ0aW9uIEZhaWxlZC4gRXhwZWN0ZWQ6ICdcIiArIGV4cGVjdGVkICsgXCInIEFjdHVhbDogJ1wiICsgYWN0dWFsICsgXCInXCI7XHJcbiAgICB9XHJcblxyXG59IiwiZXhwb3J0IGNsYXNzIE9iamVjdFByb3ZpZGVyIHtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcigpIHtcclxuICAgIH1cclxuXHJcblxyXG4gICAgXHJcbiAgICBwcm92aWRlKHRoZUNsYXNzLCBhcmdzID0gW10pIHtcclxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICAgICAgICByZXNvbHZlKG5ldyB0aGVDbGFzcyguLi5hcmdzKSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG59IiwiZXhwb3J0IGNsYXNzIFRlc3RDbGFzc1N0YXRlIHtcclxuXHJcbiAgICBzdGF0aWMgZ2V0IFJVTk5JTkcoKSB7IHJldHVybiAwOyB9XHJcbiAgICBzdGF0aWMgZ2V0IFNVQ0NFU1MoKSB7IHJldHVybiAxOyB9XHJcbiAgICBzdGF0aWMgZ2V0IEZBSUwoKSB7IHJldHVybiAtMTsgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogXHJcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gY2xhc3NOYW1lIFxyXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHN0YXRlIFxyXG4gICAgICovXHJcbiAgICBjb25zdHJ1Y3RvcihzdGF0ZSwgY2xhc3NOYW1lLCBmdW5jdGlvbk5hbWUpIHtcclxuXHJcbiAgICAgICAgLyoqIEB0eXBlIHtTdHJpbmd9ICovXHJcbiAgICAgICAgdGhpcy5zdGF0ZSA9IHN0YXRlO1xyXG5cclxuICAgICAgICAvKiogQHR5cGUge1N0cmluZ30gKi9cclxuICAgICAgICB0aGlzLmNsYXNzTmFtZSA9IGNsYXNzTmFtZTtcclxuXHJcbiAgICAgICAgLyoqIEB0eXBlIHtTdHJpbmd9ICovXHJcbiAgICAgICAgdGhpcy5mdW5jdGlvbk5hbWUgPSBmdW5jdGlvbk5hbWU7XHJcbiAgICAgICAgXHJcbiAgICB9XHJcbn0iLCJpbXBvcnQgeyBMaXN0LCBNYXAsIE9iamVjdEZ1bmN0aW9uIH0gZnJvbSBcImNvcmV1dGlsX3YxXCI7XHJcbmltcG9ydCB7IE9iamVjdFByb3ZpZGVyIH0gZnJvbSBcIi4vb2JqZWN0UHJvdmlkZXIuanNcIjtcclxuXHJcbmV4cG9ydCBjbGFzcyBUZXN0RXhlY3V0aW9uQ29udGV4dCB7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBcclxuICAgICAqIEBwYXJhbSB7TWFwfSB0ZXN0Q2xhc3NNYXBcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0UHJvdmlkZXJ9IG9iamVjdFByb3ZpZGVyIFxyXG4gICAgICogQHBhcmFtIHtPYmplY3RGdW5jdGlvbn0gcmVzdWx0TGlzdGVuZXIgXHJcbiAgICAgKi9cclxuICAgIGNvbnN0cnVjdG9yKHRlc3RDbGFzc01hcCwgb2JqZWN0UHJvdmlkZXIsIHJlc3VsdExpc3RlbmVyID0gbnVsbCkge1xyXG5cclxuICAgICAgICAvKiogQHR5cGUge09iamVjdEZ1bmN0aW9ufSAqL1xyXG4gICAgICAgIHRoaXMucmVzdWx0TGlzdGVuZXIgPSByZXN1bHRMaXN0ZW5lcjtcclxuXHJcbiAgICAgICAgLyoqIEB0eXBlIHtPYmplY3RQcm92aWRlcn0gKi9cclxuICAgICAgICB0aGlzLm9iamVjdFByb3ZpZGVyID0gb2JqZWN0UHJvdmlkZXI7XHJcblxyXG4gICAgICAgIC8qKiBAdHlwZSB7TWFwfSAqL1xyXG4gICAgICAgIHRoaXMudGVzdENsYXNzTWFwID0gdGVzdENsYXNzTWFwO1xyXG5cclxuICAgICAgICAvKiogQHR5cGUge01hcH0gKi9cclxuICAgICAgICB0aGlzLnRlc3RPYmplY3RNYXAgPSBuZXcgTWFwKCk7XHJcblxyXG4gICAgICAgIC8qKiBAdHlwZSB7TGlzdH0gKi9cclxuICAgICAgICB0aGlzLnJ1blN1Y2Nlc3NUZXN0TGlzdCA9IG5ldyBMaXN0KCk7XHJcblxyXG4gICAgICAgIC8qKiBAdHlwZSB7TGlzdH0gKi9cclxuICAgICAgICB0aGlzLnJ1bkZhaWxUZXN0TGlzdCA9IG5ldyBMaXN0KCk7XHJcbiAgICAgICAgXHJcbiAgICB9XHJcblxyXG59IiwiZXhwb3J0IGNsYXNzIFRlc3RUcmlnZ2VyIHtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFJ1biB0ZXN0IGJ5IGNsYXNzIG5hbWVcclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBjbGFzc05hbWUgXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gZnVuY3Rpb25OYW1lIFxyXG4gICAgICovXHJcbiAgICBydW5GdW5jdGlvbihjbGFzc05hbWUsIGZ1bmN0aW9uTmFtZSkge1xyXG5cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFJ1biB0ZXN0IGJ5IGNsYXNzIG5hbWVcclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBjbGFzc05hbWUgXHJcbiAgICAgKi9cclxuICAgIHJ1bkNsYXNzKGNsYXNzTmFtZSkge1xyXG5cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFJ1biBhbGwgdGVzdCBjbGFzc2VzXHJcbiAgICAgKi9cclxuICAgIHJ1bkFsbCgpIHtcclxuICAgICAgICBcclxuICAgIH1cclxufSIsImltcG9ydCB7IExpc3QsIExvZ2dlciwgTWFwLCBPYmplY3RGdW5jdGlvbiB9IGZyb20gXCJjb3JldXRpbF92MVwiO1xyXG5pbXBvcnQgeyBPYmplY3RQcm92aWRlciB9IGZyb20gXCIuL29iamVjdFByb3ZpZGVyLmpzXCI7XHJcbmltcG9ydCB7IFRlc3RDbGFzc1N0YXRlIH0gZnJvbSBcIi4vdGVzdENsYXNzU3RhdGUuanNcIjtcclxuaW1wb3J0IHsgVGVzdEV4ZWN1dGlvbkNvbnRleHQgfSBmcm9tIFwiLi90ZXN0RXhlY3V0aW9uQ29udGV4dC5qc1wiO1xyXG5pbXBvcnQgeyBUZXN0VHJpZ2dlciB9IGZyb20gXCIuL3Rlc3RUcmlnZ2VyLmpzXCI7XHJcblxyXG5jb25zdCBMT0cgPSBuZXcgTG9nZ2VyKFwiVGVzdEJlbmNoXCIpO1xyXG5cclxuZXhwb3J0IGNsYXNzIFRlc3RCZW5jaCBleHRlbmRzIFRlc3RUcmlnZ2VyIHtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFxyXG4gICAgICogQHBhcmFtIHtPYmplY3RGdW5jdGlvbn0gbG9nTGlzdGVuZXIgXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdEZ1bmN0aW9ufSByZXN1bHRMaXN0ZW5lciBcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0UHJvdmlkZXJ9IG9iamVjdFByb3ZpZGVyXHJcbiAgICAgKi9cclxuICAgIGNvbnN0cnVjdG9yKGxvZ0xpc3RlbmVyID0gbnVsbCxcclxuICAgICAgICAgICAgcmVzdWx0TGlzdGVuZXIgPSBudWxsLCBcclxuICAgICAgICAgICAgb2JqZWN0UHJvdmlkZXIgPSBuZXcgT2JqZWN0UHJvdmlkZXIoKSkge1xyXG4gICAgICAgIFxyXG4gICAgICAgIHN1cGVyKCk7XHJcblxyXG4gICAgICAgIC8qKiBAdHlwZSB7T2JqZWN0RnVuY3Rpb259ICovXHJcbiAgICAgICAgdGhpcy5sb2dMaXN0ZW5lciA9IGxvZ0xpc3RlbmVyO1xyXG5cclxuICAgICAgICAvKiogQHR5cGUge01hcH0gKi9cclxuICAgICAgICB0aGlzLnRlc3RDbGFzc01hcCA9IG5ldyBNYXAoKTtcclxuXHJcbiAgICAgICAgLyoqIEB0eXBlIHtPYmplY3RGdW5jdGlvbn0gKi9cclxuICAgICAgICB0aGlzLnJlc3VsdExpc3RlbmVyID0gcmVzdWx0TGlzdGVuZXI7XHJcblxyXG4gICAgICAgIC8qKiBAdHlwZSB7T2JqZWN0UHJvdmlkZXJ9ICovXHJcbiAgICAgICAgdGhpcy5vYmplY3RQcm92aWRlciA9IG9iamVjdFByb3ZpZGVyO1xyXG5cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFxyXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gdGVzdENsYXNzIFxyXG4gICAgICogQHJldHVybnMge1Rlc3RCZW5jaH1cclxuICAgICAqL1xyXG4gICAgYWRkVGVzdCh0ZXN0Q2xhc3MpIHtcclxuICAgICAgICBpZiAoIXRlc3RDbGFzcy50ZXN0RnVuY3Rpb25zIHx8ICEodGVzdENsYXNzLnRlc3RGdW5jdGlvbnMoKSBpbnN0YW5jZW9mIExpc3QpKSB7XHJcbiAgICAgICAgICAgIHRocm93IFwiQSBzdGF0aWMgZnVuY3Rpb24gY2FsbGVkICd0ZXN0RnVuY3Rpb25zJyBtdXN0IGJlIHByb3ZpZGVkIGluIFwiIFxyXG4gICAgICAgICAgICAgICAgKyB0ZXN0Q2xhc3MubmFtZSBcclxuICAgICAgICAgICAgICAgICsgXCIgd2hpY2ggcmV0dXJucyBhIExpc3QgYWxsIHRoZSB0ZXN0IGZ1bmN0aW9ucyBpbiBcIlxyXG4gICAgICAgICAgICAgICAgKyB0ZXN0Q2xhc3MubmFtZSArIFwiLnByb3RvdHlwZVwiXHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRlc3RDbGFzcy50ZXN0RnVuY3Rpb25zKCkuZm9yRWFjaCgodmFsdWUscGFyZW50KSA9PiB7XHJcbiAgICAgICAgICAgIGlmKCF2YWx1ZSkge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgdGVzdENsYXNzLm5hbWUgKyBcIi50ZXN0RnVuY3Rpb25zKCkgcmVmZXJzIHRvIG1pc3NpbmcgZnVuY3Rpb25zXCI7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfSwgdGhpcyk7XHJcbiAgICAgICAgdGhpcy50ZXN0Q2xhc3NNYXAuc2V0KHRlc3RDbGFzcy5uYW1lLCB0ZXN0Q2xhc3MpO1xyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnRhaW5zKHRlc3RDbGFzcykge1xyXG4gICAgICAgIHJldHVybiB0aGlzLnRlc3RDbGFzc01hcC5jb250YWlucyh0ZXN0Q2xhc3MubmFtZSk7XHJcbiAgICB9XHJcblxyXG4gICAgcnVuQWxsKCkge1xyXG4gICAgICAgIExvZ2dlci5saXN0ZW5lciA9IHRoaXMubG9nTGlzdGVuZXI7XHJcbiAgICAgICAgbGV0IGNvbnRleHQgPSBuZXcgVGVzdEV4ZWN1dGlvbkNvbnRleHQodGhpcy50ZXN0Q2xhc3NNYXAsIHRoaXMub2JqZWN0UHJvdmlkZXIsIHRoaXMucmVzdWx0TGlzdGVuZXIpO1xyXG4gICAgICAgIHJldHVybiB0aGlzLnRlc3RDbGFzc01hcC5wcm9taXNlQ2hhaW4oVGVzdEJlbmNoLnJ1biwgY29udGV4dCkudGhlbigoKSA9PiB7XHJcbiAgICAgICAgICAgIFRlc3RCZW5jaC5jbG9zZShjb250ZXh0KTtcclxuICAgICAgICB9KS5jYXRjaCgoZXJyb3IpID0+IHtcclxuICAgICAgICAgICAgdGhyb3cgZXJyb3I7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSdW4gdGVzdCBieSBjbGFzcyBuYW1lXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdGVzdENsYXNzTmFtZSBcclxuICAgICAqL1xyXG4gICAgcnVuQ2xhc3ModGVzdENsYXNzTmFtZSkge1xyXG4gICAgICAgIExvZ2dlci5saXN0ZW5lciA9IHRoaXMubG9nTGlzdGVuZXI7XHJcbiAgICAgICAgbGV0IHRlc3RDbGFzcyA9IHRoaXMudGVzdENsYXNzTWFwLmdldCh0ZXN0Q2xhc3NOYW1lKTtcclxuICAgICAgICBsZXQgY29udGV4dCA9IG5ldyBUZXN0RXhlY3V0aW9uQ29udGV4dCh0aGlzLnRlc3RDbGFzc01hcCwgdGhpcy5vYmplY3RQcm92aWRlciwgdGhpcy5yZXN1bHRMaXN0ZW5lcik7XHJcbiAgICAgICAgcmV0dXJuIFRlc3RCZW5jaC5ydW4odGVzdENsYXNzTmFtZSwgdGVzdENsYXNzLCBjb250ZXh0KS50aGVuKCgpID0+IHtcclxuICAgICAgICAgICAgVGVzdEJlbmNoLmNsb3NlKGNvbnRleHQpO1xyXG4gICAgICAgIH0pLmNhdGNoKChlcnJvcikgPT4ge1xyXG4gICAgICAgICAgICB0aHJvdyBlcnJvcjtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFJ1biB0ZXN0IGJ5IGNsYXNzIG5hbWVcclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB0ZXN0Q2xhc3NOYW1lIFxyXG4gICAgICovXHJcbiAgICBydW5GdW5jdGlvbih0ZXN0Q2xhc3NOYW1lLCBmdW5jdGlvbk5hbWUpIHtcclxuICAgICAgICBMb2dnZXIubGlzdGVuZXIgPSB0aGlzLmxvZ0xpc3RlbmVyO1xyXG4gICAgICAgIGxldCB0ZXN0Q2xhc3MgPSB0aGlzLnRlc3RDbGFzc01hcC5nZXQodGVzdENsYXNzTmFtZSk7XHJcbiAgICAgICAgbGV0IGNvbnRleHQgPSBuZXcgVGVzdEV4ZWN1dGlvbkNvbnRleHQodGhpcy50ZXN0Q2xhc3NNYXAsIHRoaXMub2JqZWN0UHJvdmlkZXIsIHRoaXMucmVzdWx0TGlzdGVuZXIpO1xyXG4gICAgICAgIHJldHVybiBUZXN0QmVuY2gucnVuKHRlc3RDbGFzc05hbWUsIHRlc3RDbGFzcywgY29udGV4dCwgZnVuY3Rpb25OYW1lKS50aGVuKCgpID0+IHtcclxuICAgICAgICAgICAgVGVzdEJlbmNoLmNsb3NlKGNvbnRleHQpO1xyXG4gICAgICAgIH0pLmNhdGNoKChlcnJvcikgPT4ge1xyXG4gICAgICAgICAgICB0aHJvdyBlcnJvcjtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFxyXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHRlc3RDbGFzc05hbWVcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSB0ZXN0Q2xhc3MgXHJcbiAgICAgKiBAcGFyYW0ge1Rlc3RFeGVjdXRpb25Db250ZXh0fSBjb250ZXh0IFxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgcnVuKHRlc3RDbGFzc05hbWUsIHRlc3RDbGFzcywgY29udGV4dCwgZnVuY3Rpb25OYW1lID0gbnVsbCkge1xyXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgICAgICAgIFRlc3RCZW5jaC5wcmludEhlYWRlcih0ZXN0Q2xhc3MubmFtZSk7XHJcbiAgICAgICAgICAgIFRlc3RCZW5jaC5ydW5GdW5jdGlvbnNCeUNsYXNzKHRlc3RDbGFzcywgY29udGV4dCwgZnVuY3Rpb25OYW1lKS50aGVuKCgpID0+IHtcclxuICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcclxuICAgICAgICAgICAgfSkuY2F0Y2goKGVycm9yKSA9PiB7XHJcbiAgICAgICAgICAgICAgICByZWplY3QoZXJyb3IpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFxyXG4gICAgICogQHBhcmFtIHtMaXN0fSBmdW5jdGlvbnMgXHJcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gZnVuY3Rpb25OYW1lIFxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgZmlsdGVyKGZ1bmN0aW9ucywgZnVuY3Rpb25OYW1lKSB7XHJcbiAgICAgICAgaWYgKCFmdW5jdGlvbk5hbWUpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9ucztcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9ucy5maWx0ZXIoKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICAgIHJldHVybiB2YWx1ZSA9PT0gZnVuY3Rpb25OYW1lO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gdGVzdENsYXNzIFxyXG4gICAgICogQHBhcmFtIHtUZXN0RXhlY3V0aW9uQ29udGV4dH0gY29udGV4dCBcclxuICAgICAqL1xyXG4gICAgc3RhdGljIGxvYWRPYmplY3RCeUNsYXNzKHRlc3RDbGFzcywgY29udGV4dCkge1xyXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgICAgICAgIGlmIChjb250ZXh0LnRlc3RPYmplY3RNYXAuY29udGFpbnModGVzdENsYXNzLm5hbWUpKSB7XHJcbiAgICAgICAgICAgICAgICByZXNvbHZlKCk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgY29udGV4dC5vYmplY3RQcm92aWRlci5wcm92aWRlKHRlc3RDbGFzcykudGhlbigodGVzdE9iamVjdCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgY29udGV4dC50ZXN0T2JqZWN0TWFwLnNldCh0ZXN0Q2xhc3MubmFtZSwgdGVzdE9iamVjdCk7XHJcbiAgICAgICAgICAgICAgICByZXNvbHZlKCk7XHJcbiAgICAgICAgICAgIH0pLmNhdGNoKChlcnJvcikgPT4ge1xyXG4gICAgICAgICAgICAgICAgcmVqZWN0KGVycm9yKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSB0ZXN0Q2xhc3MgXHJcbiAgICAgKiBAcGFyYW0ge1Rlc3RFeGVjdXRpb25Db250ZXh0fSBjb250ZXh0IFxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgcnVuRnVuY3Rpb25zQnlDbGFzcyh0ZXN0Q2xhc3MsIGNvbnRleHQsIGZ1bmN0aW9uTmFtZSkge1xyXG4gICAgICAgIC8qKiBAdHlwZSB7TGlzdH0gKi9cclxuICAgICAgICBjb25zdCB0ZXN0RnVuY3Rpb25zID0gdGVzdENsYXNzLnRlc3RGdW5jdGlvbnMoKTtcclxuICAgICAgICByZXR1cm4gdGVzdEZ1bmN0aW9ucy5wcm9taXNlQ2hhaW4oKHRlc3RGdW5jdGlvbikgPT4ge1xyXG4gICAgICAgICAgICBpZiAoZnVuY3Rpb25OYW1lICYmIHRlc3RGdW5jdGlvbi5uYW1lICE9PSBmdW5jdGlvbk5hbWUpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSxyZWplY3QpID0+IHsgcmVzb2x2ZSgpOyB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKGZ1bmN0aW9uQ29tcGxldGVSZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgICAgICAgICAgIFRlc3RCZW5jaC5ydW5GdW5jdGlvbih0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbiwgZnVuY3Rpb25Db21wbGV0ZVJlc29sdmUsIGNvbnRleHQpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9LCBjb250ZXh0KTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHRlc3RDbGFzcyBcclxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IHRlc3RGdW5jdGlvbiBcclxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmN0aW9uQ29tcGxldGVSZXNvbHZlXHJcbiAgICAgKiBAcGFyYW0ge1Rlc3RFeGVjdXRpb25Db250ZXh0fSBjb250ZXh0IFxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgcnVuRnVuY3Rpb24odGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24sIGZ1bmN0aW9uQ29tcGxldGVSZXNvbHZlLCBjb250ZXh0KSB7XHJcbiAgICAgICAgVGVzdEJlbmNoLmNhbGxSZXN1bHRMaXN0ZW5lcihjb250ZXh0LCBUZXN0Q2xhc3NTdGF0ZS5SVU5OSU5HLCB0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbik7XHJcbiAgICAgICAgVGVzdEJlbmNoLmxvYWRPYmplY3RCeUNsYXNzKHRlc3RDbGFzcywgY29udGV4dCkudGhlbigoKSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IHRlc3RPYmplY3QgPSBjb250ZXh0LnRlc3RPYmplY3RNYXAuZ2V0KHRlc3RDbGFzcy5uYW1lKTtcclxuXHJcbiAgICAgICAgICAgIC8qKiBAdHlwZSB7UHJvbWlzZX0gKi9cclxuICAgICAgICAgICAgbGV0IHRlc3RGdW5jdGlvblJlc3VsdCA9IG51bGw7XHJcblxyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgdGVzdEZ1bmN0aW9uUmVzdWx0ID0gdGVzdEZ1bmN0aW9uLmNhbGwodGVzdE9iamVjdCk7XHJcbiAgICAgICAgICAgICAgICBpZiAoISh0ZXN0RnVuY3Rpb25SZXN1bHQgaW5zdGFuY2VvZiBQcm9taXNlKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIFRlc3RCZW5jaC5yZXBvcnRTdWNjZXNzKHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uLCBjb250ZXh0KTtcclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKGV4Y2VwdGlvbikge1xyXG4gICAgICAgICAgICAgICAgVGVzdEJlbmNoLnJlcG9ydEZhaWx1cmUodGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24sIGV4Y2VwdGlvbiwgY29udGV4dCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmICghKHRlc3RGdW5jdGlvblJlc3VsdCBpbnN0YW5jZW9mIFByb21pc2UpKSB7XHJcbiAgICAgICAgICAgICAgICBmdW5jdGlvbkNvbXBsZXRlUmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0ZXN0RnVuY3Rpb25SZXN1bHQudGhlbigoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBUZXN0QmVuY2gucmVwb3J0U3VjY2Vzcyh0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbiwgY29udGV4dCk7XHJcbiAgICAgICAgICAgICAgICBmdW5jdGlvbkNvbXBsZXRlUmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICB9KS5jYXRjaCgoZXhjZXB0aW9uKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBUZXN0QmVuY2gucmVwb3J0RmFpbHVyZSh0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbiwgZXhjZXB0aW9uLCBjb250ZXh0KTtcclxuICAgICAgICAgICAgICAgIGZ1bmN0aW9uQ29tcGxldGVSZXNvbHZlKCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gdGVzdENsYXNzIFxyXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gdGVzdEZ1bmN0aW9uIFxyXG4gICAgICogQHBhcmFtIHtFcnJvcn0gZXhjZXB0aW9uIFxyXG4gICAgICogQHBhcmFtIHtUZXN0RXhlY3V0aW9uQ29udGV4dH0gY29udGV4dCBcclxuICAgICAqL1xyXG4gICAgc3RhdGljIHJlcG9ydEZhaWx1cmUodGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24sIGV4Y2VwdGlvbiwgY29udGV4dCkge1xyXG4gICAgICAgIFRlc3RCZW5jaC5hZGRGYWlsKHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uLCBjb250ZXh0KTtcclxuICAgICAgICBUZXN0QmVuY2guY2FsbFJlc3VsdExpc3RlbmVyKGNvbnRleHQsIFRlc3RDbGFzc1N0YXRlLkZBSUwsIHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uKTtcclxuICAgICAgICBMT0cuZXJyb3IoVGVzdEJlbmNoLnNpZ25hdHVyZSh0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbikgKyBcIiBmYWlsZWQuIFJlYXNvbjpcIik7XHJcbiAgICAgICAgTE9HLmVycm9yKGV4Y2VwdGlvbik7XHJcbiAgICAgICAgTE9HLmVycm9yKFwiXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gdGVzdENsYXNzIFxyXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gdGVzdEZ1bmN0aW9uIFxyXG4gICAgICogQHBhcmFtIHtUZXN0RXhlY3V0aW9uQ29udGV4dH0gY29udGV4dCBcclxuICAgICAqL1xyXG4gICAgc3RhdGljIHJlcG9ydFN1Y2Nlc3ModGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24sIGNvbnRleHQpIHtcclxuICAgICAgICBUZXN0QmVuY2guYWRkU3VjY2Vzcyh0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbiwgY29udGV4dCk7XHJcbiAgICAgICAgVGVzdEJlbmNoLmNhbGxSZXN1bHRMaXN0ZW5lcihjb250ZXh0LCBUZXN0Q2xhc3NTdGF0ZS5TVUNDRVNTLCB0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbik7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSB0ZXN0Q2xhc3MgXHJcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gc3RhdGUgXHJcbiAgICAgKiBAcGFyYW0ge1Rlc3RFeGVjdXRpb25Db250ZXh0fSBjb250ZXh0IFxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgY2FsbFJlc3VsdExpc3RlbmVyKGNvbnRleHQsIHN0YXRlLCB0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbikge1xyXG4gICAgICAgIGlmICghY29udGV4dC5yZXN1bHRMaXN0ZW5lcikge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNvbnRleHQucmVzdWx0TGlzdGVuZXIuY2FsbChuZXcgVGVzdENsYXNzU3RhdGUoc3RhdGUsIHRlc3RDbGFzcy5uYW1lLCB0ZXN0RnVuY3Rpb24gPyB0ZXN0RnVuY3Rpb24ubmFtZSA6IG51bGwpKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHRlc3RDbGFzcyBcclxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IHRlc3RGdW5jdGlvbiBcclxuICAgICAqIEBwYXJhbSB7VGVzdEV4ZWN1dGlvbkNvbnRleHR9IGNvbnRleHQgXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBhZGRTdWNjZXNzKHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uLCBjb250ZXh0KSB7XHJcbiAgICAgICAgY29udGV4dC5ydW5TdWNjZXNzVGVzdExpc3QuYWRkKFRlc3RCZW5jaC5zaWduYXR1cmUodGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24pKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHRlc3RDbGFzcyBcclxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IHRlc3RGdW5jdGlvbiBcclxuICAgICAqIEBwYXJhbSB7VGVzdEV4ZWN1dGlvbkNvbnRleHR9IGNvbnRleHQgXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBhZGRGYWlsKHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uLCBjb250ZXh0KSB7XHJcbiAgICAgICAgY29udGV4dC5ydW5GYWlsVGVzdExpc3QuYWRkKFRlc3RCZW5jaC5zaWduYXR1cmUodGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24pKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHRlc3RDbGFzcyBcclxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IHRlc3RGdW5jdGlvbiBcclxuICAgICAqL1xyXG4gICAgc3RhdGljIHNpZ25hdHVyZSh0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbikge1xyXG4gICAgICAgIHJldHVybiB0ZXN0Q2xhc3MubmFtZSArIFwiLlwiICsgdGVzdEZ1bmN0aW9uLm5hbWUgKyBcIigpXCI7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBcclxuICAgICAqIEBwYXJhbSB7VGVzdEV4ZWN1dGlvbkNvbnRleHR9IGNvbnRleHQgXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBjbG9zZShjb250ZXh0KSB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgVGVzdEJlbmNoLnByaW50UmVwb3J0KGNvbnRleHQpO1xyXG4gICAgICAgIH0gZmluYWxseSB7XHJcbiAgICAgICAgICAgIExvZ2dlci5jbGVhckxpc3RlbmVyKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogXHJcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gdGVzdE5hbWUgXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBwcmludEhlYWRlcih0ZXN0TmFtZSkge1xyXG4gICAgICAgIGNvbnN0IGxpbmUgPSBcIiMgIFJ1bm5pbmcgdGVzdDogXCIgKyB0ZXN0TmFtZSArIFwiICAjXCI7XHJcbiAgICAgICAgbGV0IGRlY29yYXRpb24gPSBcIlwiO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGluZS5sZW5ndGggOyBpKyspIHtcclxuICAgICAgICAgICAgZGVjb3JhdGlvbiA9IGRlY29yYXRpb24gKyBcIiNcIjtcclxuICAgICAgICB9XHJcbiAgICAgICAgTE9HLmluZm8oZGVjb3JhdGlvbik7XHJcbiAgICAgICAgTE9HLmluZm8obGluZSk7XHJcbiAgICAgICAgTE9HLmluZm8oZGVjb3JhdGlvbik7XHJcbiAgICAgICAgTE9HLmluZm8oXCJcIik7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBcclxuICAgICAqIEBwYXJhbSB7VGVzdEV4ZWN1dGlvbkNvbnRleHR9IGNvbnRleHQgXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBwcmludFJlcG9ydChjb250ZXh0KSB7XHJcbiAgICAgICAgTE9HLmluZm8oXCIjIyMjIyMjIyMjIyMjIyMjIyMjXCIpO1xyXG4gICAgICAgIExPRy5pbmZvKFwiIyAgIFRlc3QgUmVwb3J0ICAgI1wiKTtcclxuICAgICAgICBMT0cuaW5mbyhcIiMjIyMjIyMjIyMjIyMjIyMjIyNcIik7XHJcbiAgICAgICAgTE9HLmluZm8oXCJcIik7XHJcblxyXG4gICAgICAgIGxldCBzdWNjZXNzQ291bnRlciA9IDA7XHJcbiAgICAgICAgaWYgKGNvbnRleHQucnVuU3VjY2Vzc1Rlc3RMaXN0LnNpemUoKSA+IDApe1xyXG4gICAgICAgICAgICBMT0cuaW5mbyhcIlN1Y2NlZWRlZDpcIik7XHJcbiAgICAgICAgICAgIGNvbnRleHQucnVuU3VjY2Vzc1Rlc3RMaXN0LmZvckVhY2goKHZhbHVlLGNvbnRleHQpID0+IHtcclxuICAgICAgICAgICAgICAgIExPRy5pbmZvKHN1Y2Nlc3NDb3VudGVyKysgKyBcIi4gXCIgKyB2YWx1ZSk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIExPRy5pbmZvKFwiXCIpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IGZhaWxDb3VudGVyID0gMDtcclxuICAgICAgICBpZiAoY29udGV4dC5ydW5GYWlsVGVzdExpc3Quc2l6ZSgpID4gMCl7XHJcbiAgICAgICAgICAgIExPRy5pbmZvKFwiRmFpbGVkOlwiKTtcclxuICAgICAgICAgICAgY29udGV4dC5ydW5GYWlsVGVzdExpc3QuZm9yRWFjaCgodmFsdWUsY29udGV4dCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgTE9HLmluZm8oZmFpbENvdW50ZXIrKyArIFwiLiBcIiArIHZhbHVlKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgTE9HLmluZm8oXCJcIik7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoZmFpbENvdW50ZXIgIT0gMCkge1xyXG4gICAgICAgICAgICB0aHJvdyBjb250ZXh0LnJ1bkZhaWxUZXN0TGlzdC5zaXplKCkgKyBcIiBUZXN0cyBmYWlsZWRcIjtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG59Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQU8sTUFBTSxhQUFhLENBQUM7QUFDM0I7QUFDQSxJQUFJLE9BQU8sVUFBVSxDQUFDLE9BQU8sR0FBRyxJQUFJLEVBQUU7QUFDdEMsUUFBUSxHQUFHLE9BQU8sRUFBRTtBQUNwQixZQUFZLE9BQU87QUFDbkIsU0FBUztBQUNULFFBQVEsTUFBTSxrREFBa0QsR0FBRyxPQUFPLENBQUM7QUFDM0UsS0FBSztBQUNMO0FBQ0E7O0FDVE8sTUFBTSxZQUFZLENBQUM7QUFDMUI7QUFDQSxJQUFJLE9BQU8sWUFBWSxDQUFDLFFBQVEsRUFBRSxNQUFNLEVBQUU7QUFDMUMsUUFBUSxJQUFJLFFBQVEsS0FBSyxNQUFNLEVBQUU7QUFDakMsWUFBWSxPQUFPO0FBQ25CLFNBQVM7QUFDVCxRQUFRLE1BQU0sc0NBQXNDLEdBQUcsUUFBUSxHQUFHLGFBQWEsR0FBRyxNQUFNLEdBQUcsR0FBRyxDQUFDO0FBQy9GLEtB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
