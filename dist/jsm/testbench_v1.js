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
     * @param {Object} testObject 
     * @returns {TestBench}
     */
    addTest(testClass) {
        if (!testClass.testFunctions || !(testClass.testFunctions() instanceof List)) {
            throw "A static function called 'testFunctions' must be provided in " 
                + testClass.name 
                + " which returns a List all the test functions in "
                + testClass.name + ".prototype"
        }
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
        return new List(functions.getArray().filter((value) => {
            return value === functionName;
        }));
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdGJlbmNoX3YxLmpzIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdGVzdGJlbmNoL2Fzc2VydGlvbnMvYXNzZXJ0Qm9vbGVhbi5qcyIsIi4uLy4uL3NyYy90ZXN0YmVuY2gvYXNzZXJ0aW9ucy9hc3NlcnRTdHJpbmcuanMiLCIuLi8uLi9zcmMvdGVzdGJlbmNoL29iamVjdFByb3ZpZGVyLmpzIiwiLi4vLi4vc3JjL3Rlc3RiZW5jaC90ZXN0Q2xhc3NTdGF0ZS5qcyIsIi4uLy4uL3NyYy90ZXN0YmVuY2gvdGVzdEV4ZWN1dGlvbkNvbnRleHQuanMiLCIuLi8uLi9zcmMvdGVzdGJlbmNoL3Rlc3RUcmlnZ2VyLmpzIiwiLi4vLi4vc3JjL3Rlc3RiZW5jaC90ZXN0QmVuY2guanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGNsYXNzIEFzc2VydEJvb2xlYW4ge1xyXG5cclxuICAgIHN0YXRpYyBhc3NlcnRUcnVlKGJvb2xlYW4gPSB0cnVlKSB7XHJcbiAgICAgICAgaWYoYm9vbGVhbikge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRocm93IFwiQm9vbGVhbiBhc3NlcnRpb24gZmFpbGVkLiBFeHBlY3RlZCB0cnVlIGJ1dCB3YXMgXCIgKyBib29sZWFuO1xyXG4gICAgfVxyXG5cclxufSIsImV4cG9ydCBjbGFzcyBBc3NlcnRTdHJpbmcge1xyXG5cclxuICAgIHN0YXRpYyBhc3NlcnRFcXVhbHMoZXhwZWN0ZWQsIGFjdHVhbCkge1xyXG4gICAgICAgIGlmIChleHBlY3RlZCA9PT0gYWN0dWFsKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhyb3cgXCJTdHJpbmcgQXNzZXJ0aW9uIEZhaWxlZC4gRXhwZWN0ZWQ6ICdcIiArIGV4cGVjdGVkICsgXCInIEFjdHVhbDogJ1wiICsgYWN0dWFsICsgXCInXCI7XHJcbiAgICB9XHJcblxyXG59IiwiZXhwb3J0IGNsYXNzIE9iamVjdFByb3ZpZGVyIHtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcigpIHtcclxuXHJcbiAgICB9XHJcblxyXG4gICAgcHJvdmlkZSh0aGVDbGFzcywgYXJncyA9IFtdKSB7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgICAgICAgcmVzb2x2ZShuZXcgdGhlQ2xhc3MoLi4uYXJncykpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxufSIsImV4cG9ydCBjbGFzcyBUZXN0Q2xhc3NTdGF0ZSB7XHJcblxyXG4gICAgc3RhdGljIGdldCBSVU5OSU5HKCkgeyByZXR1cm4gMDsgfVxyXG4gICAgc3RhdGljIGdldCBTVUNDRVNTKCkgeyByZXR1cm4gMTsgfVxyXG4gICAgc3RhdGljIGdldCBGQUlMKCkgeyByZXR1cm4gLTE7IH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFxyXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IGNsYXNzTmFtZSBcclxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBzdGF0ZSBcclxuICAgICAqL1xyXG4gICAgY29uc3RydWN0b3Ioc3RhdGUsIGNsYXNzTmFtZSwgZnVuY3Rpb25OYW1lKSB7XHJcblxyXG4gICAgICAgIC8qKiBAdHlwZSB7U3RyaW5nfSAqL1xyXG4gICAgICAgIHRoaXMuc3RhdGUgPSBzdGF0ZTtcclxuXHJcbiAgICAgICAgLyoqIEB0eXBlIHtTdHJpbmd9ICovXHJcbiAgICAgICAgdGhpcy5jbGFzc05hbWUgPSBjbGFzc05hbWU7XHJcblxyXG4gICAgICAgIC8qKiBAdHlwZSB7U3RyaW5nfSAqL1xyXG4gICAgICAgIHRoaXMuZnVuY3Rpb25OYW1lID0gZnVuY3Rpb25OYW1lO1xyXG4gICAgICAgIFxyXG4gICAgfVxyXG59IiwiaW1wb3J0IHsgTGlzdCwgTWFwLCBPYmplY3RGdW5jdGlvbiB9IGZyb20gXCJjb3JldXRpbF92MVwiO1xyXG5pbXBvcnQgeyBPYmplY3RQcm92aWRlciB9IGZyb20gXCIuL29iamVjdFByb3ZpZGVyLmpzXCI7XHJcblxyXG5leHBvcnQgY2xhc3MgVGVzdEV4ZWN1dGlvbkNvbnRleHQge1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogXHJcbiAgICAgKiBAcGFyYW0ge01hcH0gdGVzdENsYXNzTWFwXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdFByb3ZpZGVyfSBvYmplY3RQcm92aWRlciBcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0RnVuY3Rpb259IHJlc3VsdExpc3RlbmVyIFxyXG4gICAgICovXHJcbiAgICBjb25zdHJ1Y3Rvcih0ZXN0Q2xhc3NNYXAsIG9iamVjdFByb3ZpZGVyLCByZXN1bHRMaXN0ZW5lciA9IG51bGwpIHtcclxuXHJcbiAgICAgICAgLyoqIEB0eXBlIHtPYmplY3RGdW5jdGlvbn0gKi9cclxuICAgICAgICB0aGlzLnJlc3VsdExpc3RlbmVyID0gcmVzdWx0TGlzdGVuZXI7XHJcblxyXG4gICAgICAgIC8qKiBAdHlwZSB7T2JqZWN0UHJvdmlkZXJ9ICovXHJcbiAgICAgICAgdGhpcy5vYmplY3RQcm92aWRlciA9IG9iamVjdFByb3ZpZGVyO1xyXG5cclxuICAgICAgICAvKiogQHR5cGUge01hcH0gKi9cclxuICAgICAgICB0aGlzLnRlc3RDbGFzc01hcCA9IHRlc3RDbGFzc01hcDtcclxuXHJcbiAgICAgICAgLyoqIEB0eXBlIHtNYXB9ICovXHJcbiAgICAgICAgdGhpcy50ZXN0T2JqZWN0TWFwID0gbmV3IE1hcCgpO1xyXG5cclxuICAgICAgICAvKiogQHR5cGUge0xpc3R9ICovXHJcbiAgICAgICAgdGhpcy5ydW5TdWNjZXNzVGVzdExpc3QgPSBuZXcgTGlzdCgpO1xyXG5cclxuICAgICAgICAvKiogQHR5cGUge0xpc3R9ICovXHJcbiAgICAgICAgdGhpcy5ydW5GYWlsVGVzdExpc3QgPSBuZXcgTGlzdCgpO1xyXG4gICAgICAgIFxyXG4gICAgfVxyXG5cclxufSIsImV4cG9ydCBjbGFzcyBUZXN0VHJpZ2dlciB7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSdW4gdGVzdCBieSBjbGFzcyBuYW1lXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY2xhc3NOYW1lIFxyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGZ1bmN0aW9uTmFtZSBcclxuICAgICAqL1xyXG4gICAgcnVuRnVuY3Rpb24oY2xhc3NOYW1lLCBmdW5jdGlvbk5hbWUpIHtcclxuXHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSdW4gdGVzdCBieSBjbGFzcyBuYW1lXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY2xhc3NOYW1lIFxyXG4gICAgICovXHJcbiAgICBydW5DbGFzcyhjbGFzc05hbWUpIHtcclxuXHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSdW4gYWxsIHRlc3QgY2xhc3Nlc1xyXG4gICAgICovXHJcbiAgICBydW5BbGwoKSB7XHJcbiAgICAgICAgXHJcbiAgICB9XHJcbn0iLCJpbXBvcnQgeyBMaXN0LCBMb2dnZXIsIE1hcCwgT2JqZWN0RnVuY3Rpb24gfSBmcm9tIFwiY29yZXV0aWxfdjFcIjtcclxuaW1wb3J0IHsgT2JqZWN0UHJvdmlkZXIgfSBmcm9tIFwiLi9vYmplY3RQcm92aWRlci5qc1wiO1xyXG5pbXBvcnQgeyBUZXN0Q2xhc3NTdGF0ZSB9IGZyb20gXCIuL3Rlc3RDbGFzc1N0YXRlLmpzXCI7XHJcbmltcG9ydCB7IFRlc3RFeGVjdXRpb25Db250ZXh0IH0gZnJvbSBcIi4vdGVzdEV4ZWN1dGlvbkNvbnRleHQuanNcIjtcclxuaW1wb3J0IHsgVGVzdFRyaWdnZXIgfSBmcm9tIFwiLi90ZXN0VHJpZ2dlci5qc1wiO1xyXG5cclxuY29uc3QgTE9HID0gbmV3IExvZ2dlcihcIlRlc3RCZW5jaFwiKTtcclxuXHJcbmV4cG9ydCBjbGFzcyBUZXN0QmVuY2ggZXh0ZW5kcyBUZXN0VHJpZ2dlciB7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0RnVuY3Rpb259IGxvZ0xpc3RlbmVyIFxyXG4gICAgICogQHBhcmFtIHtPYmplY3RGdW5jdGlvbn0gcmVzdWx0TGlzdGVuZXIgXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdFByb3ZpZGVyfSBvYmplY3RQcm92aWRlclxyXG4gICAgICovXHJcbiAgICBjb25zdHJ1Y3Rvcihsb2dMaXN0ZW5lciA9IG51bGwsXHJcbiAgICAgICAgICAgIHJlc3VsdExpc3RlbmVyID0gbnVsbCwgXHJcbiAgICAgICAgICAgIG9iamVjdFByb3ZpZGVyID0gbmV3IE9iamVjdFByb3ZpZGVyKCkpIHtcclxuICAgICAgICBcclxuICAgICAgICBzdXBlcigpO1xyXG5cclxuICAgICAgICAvKiogQHR5cGUge09iamVjdEZ1bmN0aW9ufSAqL1xyXG4gICAgICAgIHRoaXMubG9nTGlzdGVuZXIgPSBsb2dMaXN0ZW5lcjtcclxuXHJcbiAgICAgICAgLyoqIEB0eXBlIHtNYXB9ICovXHJcbiAgICAgICAgdGhpcy50ZXN0Q2xhc3NNYXAgPSBuZXcgTWFwKCk7XHJcblxyXG4gICAgICAgIC8qKiBAdHlwZSB7T2JqZWN0RnVuY3Rpb259ICovXHJcbiAgICAgICAgdGhpcy5yZXN1bHRMaXN0ZW5lciA9IHJlc3VsdExpc3RlbmVyO1xyXG5cclxuICAgICAgICAvKiogQHR5cGUge09iamVjdFByb3ZpZGVyfSAqL1xyXG4gICAgICAgIHRoaXMub2JqZWN0UHJvdmlkZXIgPSBvYmplY3RQcm92aWRlcjtcclxuXHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSB0ZXN0T2JqZWN0IFxyXG4gICAgICogQHJldHVybnMge1Rlc3RCZW5jaH1cclxuICAgICAqL1xyXG4gICAgYWRkVGVzdCh0ZXN0Q2xhc3MpIHtcclxuICAgICAgICBpZiAoIXRlc3RDbGFzcy50ZXN0RnVuY3Rpb25zIHx8ICEodGVzdENsYXNzLnRlc3RGdW5jdGlvbnMoKSBpbnN0YW5jZW9mIExpc3QpKSB7XHJcbiAgICAgICAgICAgIHRocm93IFwiQSBzdGF0aWMgZnVuY3Rpb24gY2FsbGVkICd0ZXN0RnVuY3Rpb25zJyBtdXN0IGJlIHByb3ZpZGVkIGluIFwiIFxyXG4gICAgICAgICAgICAgICAgKyB0ZXN0Q2xhc3MubmFtZSBcclxuICAgICAgICAgICAgICAgICsgXCIgd2hpY2ggcmV0dXJucyBhIExpc3QgYWxsIHRoZSB0ZXN0IGZ1bmN0aW9ucyBpbiBcIlxyXG4gICAgICAgICAgICAgICAgKyB0ZXN0Q2xhc3MubmFtZSArIFwiLnByb3RvdHlwZVwiXHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMudGVzdENsYXNzTWFwLnNldCh0ZXN0Q2xhc3MubmFtZSwgdGVzdENsYXNzKTtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxuXHJcbiAgICBjb250YWlucyh0ZXN0Q2xhc3MpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy50ZXN0Q2xhc3NNYXAuY29udGFpbnModGVzdENsYXNzLm5hbWUpO1xyXG4gICAgfVxyXG5cclxuICAgIHJ1bkFsbCgpIHtcclxuICAgICAgICBMb2dnZXIubGlzdGVuZXIgPSB0aGlzLmxvZ0xpc3RlbmVyO1xyXG4gICAgICAgIGxldCBjb250ZXh0ID0gbmV3IFRlc3RFeGVjdXRpb25Db250ZXh0KHRoaXMudGVzdENsYXNzTWFwLCB0aGlzLm9iamVjdFByb3ZpZGVyLCB0aGlzLnJlc3VsdExpc3RlbmVyKTtcclxuICAgICAgICByZXR1cm4gdGhpcy50ZXN0Q2xhc3NNYXAucHJvbWlzZUNoYWluKFRlc3RCZW5jaC5ydW4sIGNvbnRleHQpLnRoZW4oKCkgPT4ge1xyXG4gICAgICAgICAgICBUZXN0QmVuY2guY2xvc2UoY29udGV4dCk7XHJcbiAgICAgICAgfSkuY2F0Y2goKGVycm9yKSA9PiB7XHJcbiAgICAgICAgICAgIHRocm93IGVycm9yO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUnVuIHRlc3QgYnkgY2xhc3MgbmFtZVxyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHRlc3RDbGFzc05hbWUgXHJcbiAgICAgKi9cclxuICAgIHJ1bkNsYXNzKHRlc3RDbGFzc05hbWUpIHtcclxuICAgICAgICBMb2dnZXIubGlzdGVuZXIgPSB0aGlzLmxvZ0xpc3RlbmVyO1xyXG4gICAgICAgIGxldCB0ZXN0Q2xhc3MgPSB0aGlzLnRlc3RDbGFzc01hcC5nZXQodGVzdENsYXNzTmFtZSk7XHJcbiAgICAgICAgbGV0IGNvbnRleHQgPSBuZXcgVGVzdEV4ZWN1dGlvbkNvbnRleHQodGhpcy50ZXN0Q2xhc3NNYXAsIHRoaXMub2JqZWN0UHJvdmlkZXIsIHRoaXMucmVzdWx0TGlzdGVuZXIpO1xyXG4gICAgICAgIHJldHVybiBUZXN0QmVuY2gucnVuKHRlc3RDbGFzc05hbWUsIHRlc3RDbGFzcywgY29udGV4dCkudGhlbigoKSA9PiB7XHJcbiAgICAgICAgICAgIFRlc3RCZW5jaC5jbG9zZShjb250ZXh0KTtcclxuICAgICAgICB9KS5jYXRjaCgoZXJyb3IpID0+IHtcclxuICAgICAgICAgICAgdGhyb3cgZXJyb3I7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSdW4gdGVzdCBieSBjbGFzcyBuYW1lXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdGVzdENsYXNzTmFtZSBcclxuICAgICAqL1xyXG4gICAgcnVuRnVuY3Rpb24odGVzdENsYXNzTmFtZSwgZnVuY3Rpb25OYW1lKSB7XHJcbiAgICAgICAgTG9nZ2VyLmxpc3RlbmVyID0gdGhpcy5sb2dMaXN0ZW5lcjtcclxuICAgICAgICBsZXQgdGVzdENsYXNzID0gdGhpcy50ZXN0Q2xhc3NNYXAuZ2V0KHRlc3RDbGFzc05hbWUpO1xyXG4gICAgICAgIGxldCBjb250ZXh0ID0gbmV3IFRlc3RFeGVjdXRpb25Db250ZXh0KHRoaXMudGVzdENsYXNzTWFwLCB0aGlzLm9iamVjdFByb3ZpZGVyLCB0aGlzLnJlc3VsdExpc3RlbmVyKTtcclxuICAgICAgICByZXR1cm4gVGVzdEJlbmNoLnJ1bih0ZXN0Q2xhc3NOYW1lLCB0ZXN0Q2xhc3MsIGNvbnRleHQsIGZ1bmN0aW9uTmFtZSkudGhlbigoKSA9PiB7XHJcbiAgICAgICAgICAgIFRlc3RCZW5jaC5jbG9zZShjb250ZXh0KTtcclxuICAgICAgICB9KS5jYXRjaCgoZXJyb3IpID0+IHtcclxuICAgICAgICAgICAgdGhyb3cgZXJyb3I7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBcclxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSB0ZXN0Q2xhc3NOYW1lXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gdGVzdENsYXNzIFxyXG4gICAgICogQHBhcmFtIHtUZXN0RXhlY3V0aW9uQ29udGV4dH0gY29udGV4dCBcclxuICAgICAqL1xyXG4gICAgc3RhdGljIHJ1bih0ZXN0Q2xhc3NOYW1lLCB0ZXN0Q2xhc3MsIGNvbnRleHQsIGZ1bmN0aW9uTmFtZSA9IG51bGwpIHtcclxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICAgICAgICBUZXN0QmVuY2gucHJpbnRIZWFkZXIodGVzdENsYXNzLm5hbWUpO1xyXG4gICAgICAgICAgICBUZXN0QmVuY2gucnVuRnVuY3Rpb25zQnlDbGFzcyh0ZXN0Q2xhc3MsIGNvbnRleHQsIGZ1bmN0aW9uTmFtZSkudGhlbigoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICByZXNvbHZlKCk7XHJcbiAgICAgICAgICAgIH0pLmNhdGNoKChlcnJvcikgPT4ge1xyXG4gICAgICAgICAgICAgICAgcmVqZWN0KGVycm9yKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBcclxuICAgICAqIEBwYXJhbSB7TGlzdH0gZnVuY3Rpb25zIFxyXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IGZ1bmN0aW9uTmFtZSBcclxuICAgICAqL1xyXG4gICAgc3RhdGljIGZpbHRlcihmdW5jdGlvbnMsIGZ1bmN0aW9uTmFtZSkge1xyXG4gICAgICAgIGlmICghZnVuY3Rpb25OYW1lKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbnM7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBuZXcgTGlzdChmdW5jdGlvbnMuZ2V0QXJyYXkoKS5maWx0ZXIoKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgICAgIHJldHVybiB2YWx1ZSA9PT0gZnVuY3Rpb25OYW1lO1xyXG4gICAgICAgIH0pKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHRlc3RDbGFzcyBcclxuICAgICAqIEBwYXJhbSB7VGVzdEV4ZWN1dGlvbkNvbnRleHR9IGNvbnRleHQgXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBsb2FkT2JqZWN0QnlDbGFzcyh0ZXN0Q2xhc3MsIGNvbnRleHQpIHtcclxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICAgICAgICBpZiAoY29udGV4dC50ZXN0T2JqZWN0TWFwLmNvbnRhaW5zKHRlc3RDbGFzcy5uYW1lKSkge1xyXG4gICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGNvbnRleHQub2JqZWN0UHJvdmlkZXIucHJvdmlkZSh0ZXN0Q2xhc3MpLnRoZW4oKHRlc3RPYmplY3QpID0+IHtcclxuICAgICAgICAgICAgICAgIGNvbnRleHQudGVzdE9iamVjdE1hcC5zZXQodGVzdENsYXNzLm5hbWUsIHRlc3RPYmplY3QpO1xyXG4gICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICB9KS5jYXRjaCgoZXJyb3IpID0+IHtcclxuICAgICAgICAgICAgICAgIHJlamVjdChlcnJvcik7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gdGVzdENsYXNzIFxyXG4gICAgICogQHBhcmFtIHtUZXN0RXhlY3V0aW9uQ29udGV4dH0gY29udGV4dCBcclxuICAgICAqL1xyXG4gICAgc3RhdGljIHJ1bkZ1bmN0aW9uc0J5Q2xhc3ModGVzdENsYXNzLCBjb250ZXh0LCBmdW5jdGlvbk5hbWUpIHtcclxuICAgICAgICAvKiogQHR5cGUge0xpc3R9ICovXHJcbiAgICAgICAgY29uc3QgdGVzdEZ1bmN0aW9ucyA9IHRlc3RDbGFzcy50ZXN0RnVuY3Rpb25zKCk7XHJcbiAgICAgICAgcmV0dXJuIHRlc3RGdW5jdGlvbnMucHJvbWlzZUNoYWluKCh0ZXN0RnVuY3Rpb24pID0+IHtcclxuICAgICAgICAgICAgaWYgKGZ1bmN0aW9uTmFtZSAmJiB0ZXN0RnVuY3Rpb24ubmFtZSAhPT0gZnVuY3Rpb25OYW1lKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUscmVqZWN0KSA9PiB7IHJlc29sdmUoKTsgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChmdW5jdGlvbkNvbXBsZXRlUmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgICAgICAgICAgICBUZXN0QmVuY2gucnVuRnVuY3Rpb24odGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24sIGZ1bmN0aW9uQ29tcGxldGVSZXNvbHZlLCBjb250ZXh0KTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSwgY29udGV4dCk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSB0ZXN0Q2xhc3MgXHJcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSB0ZXN0RnVuY3Rpb24gXHJcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jdGlvbkNvbXBsZXRlUmVzb2x2ZVxyXG4gICAgICogQHBhcmFtIHtUZXN0RXhlY3V0aW9uQ29udGV4dH0gY29udGV4dCBcclxuICAgICAqL1xyXG4gICAgc3RhdGljIHJ1bkZ1bmN0aW9uKHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uLCBmdW5jdGlvbkNvbXBsZXRlUmVzb2x2ZSwgY29udGV4dCkge1xyXG4gICAgICAgIFRlc3RCZW5jaC5jYWxsUmVzdWx0TGlzdGVuZXIoY29udGV4dCwgVGVzdENsYXNzU3RhdGUuUlVOTklORywgdGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24pO1xyXG4gICAgICAgIFRlc3RCZW5jaC5sb2FkT2JqZWN0QnlDbGFzcyh0ZXN0Q2xhc3MsIGNvbnRleHQpLnRoZW4oKCkgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCB0ZXN0T2JqZWN0ID0gY29udGV4dC50ZXN0T2JqZWN0TWFwLmdldCh0ZXN0Q2xhc3MubmFtZSk7XHJcblxyXG4gICAgICAgICAgICAvKiogQHR5cGUge1Byb21pc2V9ICovXHJcbiAgICAgICAgICAgIGxldCB0ZXN0RnVuY3Rpb25SZXN1bHQgPSBudWxsO1xyXG5cclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIHRlc3RGdW5jdGlvblJlc3VsdCA9IHRlc3RGdW5jdGlvbi5jYWxsKHRlc3RPYmplY3QpO1xyXG4gICAgICAgICAgICAgICAgaWYgKCEodGVzdEZ1bmN0aW9uUmVzdWx0IGluc3RhbmNlb2YgUHJvbWlzZSkpIHtcclxuICAgICAgICAgICAgICAgICAgICBUZXN0QmVuY2gucmVwb3J0U3VjY2Vzcyh0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbiwgY29udGV4dCk7XHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICB9IGNhdGNoIChleGNlcHRpb24pIHtcclxuICAgICAgICAgICAgICAgIFRlc3RCZW5jaC5yZXBvcnRGYWlsdXJlKHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uLCBleGNlcHRpb24sIGNvbnRleHQpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZiAoISh0ZXN0RnVuY3Rpb25SZXN1bHQgaW5zdGFuY2VvZiBQcm9taXNlKSkge1xyXG4gICAgICAgICAgICAgICAgZnVuY3Rpb25Db21wbGV0ZVJlc29sdmUoKTtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdGVzdEZ1bmN0aW9uUmVzdWx0LnRoZW4oKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgVGVzdEJlbmNoLnJlcG9ydFN1Y2Nlc3ModGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24sIGNvbnRleHQpO1xyXG4gICAgICAgICAgICAgICAgZnVuY3Rpb25Db21wbGV0ZVJlc29sdmUoKTtcclxuICAgICAgICAgICAgfSkuY2F0Y2goKGV4Y2VwdGlvbikgPT4ge1xyXG4gICAgICAgICAgICAgICAgVGVzdEJlbmNoLnJlcG9ydEZhaWx1cmUodGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24sIGV4Y2VwdGlvbiwgY29udGV4dCk7XHJcbiAgICAgICAgICAgICAgICBmdW5jdGlvbkNvbXBsZXRlUmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHRlc3RDbGFzcyBcclxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IHRlc3RGdW5jdGlvbiBcclxuICAgICAqIEBwYXJhbSB7RXJyb3J9IGV4Y2VwdGlvbiBcclxuICAgICAqIEBwYXJhbSB7VGVzdEV4ZWN1dGlvbkNvbnRleHR9IGNvbnRleHQgXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyByZXBvcnRGYWlsdXJlKHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uLCBleGNlcHRpb24sIGNvbnRleHQpIHtcclxuICAgICAgICBUZXN0QmVuY2guYWRkRmFpbCh0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbiwgY29udGV4dCk7XHJcbiAgICAgICAgVGVzdEJlbmNoLmNhbGxSZXN1bHRMaXN0ZW5lcihjb250ZXh0LCBUZXN0Q2xhc3NTdGF0ZS5GQUlMLCB0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbik7XHJcbiAgICAgICAgTE9HLmVycm9yKFRlc3RCZW5jaC5zaWduYXR1cmUodGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24pICsgXCIgZmFpbGVkLiBSZWFzb246XCIpO1xyXG4gICAgICAgIExPRy5lcnJvcihleGNlcHRpb24pO1xyXG4gICAgICAgIExPRy5lcnJvcihcIlwiKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHRlc3RDbGFzcyBcclxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IHRlc3RGdW5jdGlvbiBcclxuICAgICAqIEBwYXJhbSB7VGVzdEV4ZWN1dGlvbkNvbnRleHR9IGNvbnRleHQgXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyByZXBvcnRTdWNjZXNzKHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uLCBjb250ZXh0KSB7XHJcbiAgICAgICAgVGVzdEJlbmNoLmFkZFN1Y2Nlc3ModGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24sIGNvbnRleHQpO1xyXG4gICAgICAgIFRlc3RCZW5jaC5jYWxsUmVzdWx0TGlzdGVuZXIoY29udGV4dCwgVGVzdENsYXNzU3RhdGUuU1VDQ0VTUywgdGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24pO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gdGVzdENsYXNzIFxyXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHN0YXRlIFxyXG4gICAgICogQHBhcmFtIHtUZXN0RXhlY3V0aW9uQ29udGV4dH0gY29udGV4dCBcclxuICAgICAqL1xyXG4gICAgc3RhdGljIGNhbGxSZXN1bHRMaXN0ZW5lcihjb250ZXh0LCBzdGF0ZSwgdGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24pIHtcclxuICAgICAgICBpZiAoIWNvbnRleHQucmVzdWx0TGlzdGVuZXIpIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjb250ZXh0LnJlc3VsdExpc3RlbmVyLmNhbGwobmV3IFRlc3RDbGFzc1N0YXRlKHN0YXRlLCB0ZXN0Q2xhc3MubmFtZSwgdGVzdEZ1bmN0aW9uID8gdGVzdEZ1bmN0aW9uLm5hbWUgOiBudWxsKSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSB0ZXN0Q2xhc3MgXHJcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSB0ZXN0RnVuY3Rpb24gXHJcbiAgICAgKiBAcGFyYW0ge1Rlc3RFeGVjdXRpb25Db250ZXh0fSBjb250ZXh0IFxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgYWRkU3VjY2Vzcyh0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbiwgY29udGV4dCkge1xyXG4gICAgICAgIGNvbnRleHQucnVuU3VjY2Vzc1Rlc3RMaXN0LmFkZChUZXN0QmVuY2guc2lnbmF0dXJlKHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uKSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSB0ZXN0Q2xhc3MgXHJcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSB0ZXN0RnVuY3Rpb24gXHJcbiAgICAgKiBAcGFyYW0ge1Rlc3RFeGVjdXRpb25Db250ZXh0fSBjb250ZXh0IFxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgYWRkRmFpbCh0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbiwgY29udGV4dCkge1xyXG4gICAgICAgIGNvbnRleHQucnVuRmFpbFRlc3RMaXN0LmFkZChUZXN0QmVuY2guc2lnbmF0dXJlKHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uKSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSB0ZXN0Q2xhc3MgXHJcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSB0ZXN0RnVuY3Rpb24gXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBzaWduYXR1cmUodGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24pIHtcclxuICAgICAgICByZXR1cm4gdGVzdENsYXNzLm5hbWUgKyBcIi5cIiArIHRlc3RGdW5jdGlvbi5uYW1lICsgXCIoKVwiO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogXHJcbiAgICAgKiBAcGFyYW0ge1Rlc3RFeGVjdXRpb25Db250ZXh0fSBjb250ZXh0IFxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgY2xvc2UoY29udGV4dCkge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIFRlc3RCZW5jaC5wcmludFJlcG9ydChjb250ZXh0KTtcclxuICAgICAgICB9IGZpbmFsbHkge1xyXG4gICAgICAgICAgICBMb2dnZXIuY2xlYXJMaXN0ZW5lcigpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFxyXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHRlc3ROYW1lIFxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgcHJpbnRIZWFkZXIodGVzdE5hbWUpIHtcclxuICAgICAgICBjb25zdCBsaW5lID0gXCIjICBSdW5uaW5nIHRlc3Q6IFwiICsgdGVzdE5hbWUgKyBcIiAgI1wiO1xyXG4gICAgICAgIGxldCBkZWNvcmF0aW9uID0gXCJcIjtcclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpbmUubGVuZ3RoIDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGRlY29yYXRpb24gPSBkZWNvcmF0aW9uICsgXCIjXCI7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIExPRy5pbmZvKGRlY29yYXRpb24pO1xyXG4gICAgICAgIExPRy5pbmZvKGxpbmUpO1xyXG4gICAgICAgIExPRy5pbmZvKGRlY29yYXRpb24pO1xyXG4gICAgICAgIExPRy5pbmZvKFwiXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogXHJcbiAgICAgKiBAcGFyYW0ge1Rlc3RFeGVjdXRpb25Db250ZXh0fSBjb250ZXh0IFxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgcHJpbnRSZXBvcnQoY29udGV4dCkge1xyXG4gICAgICAgIExPRy5pbmZvKFwiIyMjIyMjIyMjIyMjIyMjIyMjI1wiKTtcclxuICAgICAgICBMT0cuaW5mbyhcIiMgICBUZXN0IFJlcG9ydCAgICNcIik7XHJcbiAgICAgICAgTE9HLmluZm8oXCIjIyMjIyMjIyMjIyMjIyMjIyMjXCIpO1xyXG4gICAgICAgIExPRy5pbmZvKFwiXCIpO1xyXG5cclxuICAgICAgICBsZXQgc3VjY2Vzc0NvdW50ZXIgPSAwO1xyXG4gICAgICAgIGlmIChjb250ZXh0LnJ1blN1Y2Nlc3NUZXN0TGlzdC5zaXplKCkgPiAwKXtcclxuICAgICAgICAgICAgTE9HLmluZm8oXCJTdWNjZWVkZWQ6XCIpO1xyXG4gICAgICAgICAgICBjb250ZXh0LnJ1blN1Y2Nlc3NUZXN0TGlzdC5mb3JFYWNoKCh2YWx1ZSxjb250ZXh0KSA9PiB7XHJcbiAgICAgICAgICAgICAgICBMT0cuaW5mbyhzdWNjZXNzQ291bnRlcisrICsgXCIuIFwiICsgdmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBMT0cuaW5mbyhcIlwiKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCBmYWlsQ291bnRlciA9IDA7XHJcbiAgICAgICAgaWYgKGNvbnRleHQucnVuRmFpbFRlc3RMaXN0LnNpemUoKSA+IDApe1xyXG4gICAgICAgICAgICBMT0cuaW5mbyhcIkZhaWxlZDpcIik7XHJcbiAgICAgICAgICAgIGNvbnRleHQucnVuRmFpbFRlc3RMaXN0LmZvckVhY2goKHZhbHVlLGNvbnRleHQpID0+IHtcclxuICAgICAgICAgICAgICAgIExPRy5pbmZvKGZhaWxDb3VudGVyKysgKyBcIi4gXCIgKyB2YWx1ZSk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIExPRy5pbmZvKFwiXCIpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKGZhaWxDb3VudGVyICE9IDApIHtcclxuICAgICAgICAgICAgdGhyb3cgY29udGV4dC5ydW5GYWlsVGVzdExpc3Quc2l6ZSgpICsgXCIgVGVzdHMgZmFpbGVkXCI7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxufSJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFPLE1BQU0sYUFBYSxDQUFDO0FBQzNCO0FBQ0EsSUFBSSxPQUFPLFVBQVUsQ0FBQyxPQUFPLEdBQUcsSUFBSSxFQUFFO0FBQ3RDLFFBQVEsR0FBRyxPQUFPLEVBQUU7QUFDcEIsWUFBWSxPQUFPO0FBQ25CLFNBQVM7QUFDVCxRQUFRLE1BQU0sa0RBQWtELEdBQUcsT0FBTyxDQUFDO0FBQzNFLEtBQUs7QUFDTDtBQUNBOztBQ1RPLE1BQU0sWUFBWSxDQUFDO0FBQzFCO0FBQ0EsSUFBSSxPQUFPLFlBQVksQ0FBQyxRQUFRLEVBQUUsTUFBTSxFQUFFO0FBQzFDLFFBQVEsSUFBSSxRQUFRLEtBQUssTUFBTSxFQUFFO0FBQ2pDLFlBQVksT0FBTztBQUNuQixTQUFTO0FBQ1QsUUFBUSxNQUFNLHNDQUFzQyxHQUFHLFFBQVEsR0FBRyxhQUFhLEdBQUcsTUFBTSxHQUFHLEdBQUcsQ0FBQztBQUMvRixLQUFLO0FBQ0w7QUFDQTs7Q0FBQyxLQ1RZLGNBQWMsQ0FBQztBQUM1QjtBQUNBLElBQUksV0FBVyxHQUFHO0FBQ2xCO0FBQ0EsS0FBSztBQUNMO0FBQ0EsSUFBSSxPQUFPLENBQUMsUUFBUSxFQUFFLElBQUksR0FBRyxFQUFFLEVBQUU7QUFDakMsUUFBUSxPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLE1BQU0sS0FBSztBQUNoRCxZQUFZLE9BQU8sQ0FBQyxJQUFJLFFBQVEsQ0FBQyxHQUFHLElBQUksQ0FBQyxD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
