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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdGJlbmNoX3YxLmpzIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdGVzdGJlbmNoL2Fzc2VydGlvbnMvYXNzZXJ0Qm9vbGVhbi5qcyIsIi4uLy4uL3NyYy90ZXN0YmVuY2gvYXNzZXJ0aW9ucy9hc3NlcnRTdHJpbmcuanMiLCIuLi8uLi9zcmMvdGVzdGJlbmNoL29iamVjdFByb3ZpZGVyLmpzIiwiLi4vLi4vc3JjL3Rlc3RiZW5jaC90ZXN0Q2xhc3NTdGF0ZS5qcyIsIi4uLy4uL3NyYy90ZXN0YmVuY2gvdGVzdEV4ZWN1dGlvbkNvbnRleHQuanMiLCIuLi8uLi9zcmMvdGVzdGJlbmNoL3Rlc3RUcmlnZ2VyLmpzIiwiLi4vLi4vc3JjL3Rlc3RiZW5jaC90ZXN0QmVuY2guanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGNsYXNzIEFzc2VydEJvb2xlYW4ge1xyXG5cclxuICAgIHN0YXRpYyBhc3NlcnRUcnVlKGJvb2xlYW4gPSB0cnVlKSB7XHJcbiAgICAgICAgaWYoYm9vbGVhbikge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRocm93IFwiQm9vbGVhbiBhc3NlcnRpb24gZmFpbGVkLiBFeHBlY3RlZCB0cnVlIGJ1dCB3YXMgXCIgKyBib29sZWFuO1xyXG4gICAgfVxyXG5cclxufSIsImV4cG9ydCBjbGFzcyBBc3NlcnRTdHJpbmcge1xyXG5cclxuICAgIHN0YXRpYyBhc3NlcnRFcXVhbHMoZXhwZWN0ZWQsIGFjdHVhbCkge1xyXG4gICAgICAgIGlmIChleHBlY3RlZCA9PT0gYWN0dWFsKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhyb3cgXCJTdHJpbmcgQXNzZXJ0aW9uIEZhaWxlZC4gRXhwZWN0ZWQ6ICdcIiArIGV4cGVjdGVkICsgXCInIEFjdHVhbDogJ1wiICsgYWN0dWFsICsgXCInXCI7XHJcbiAgICB9XHJcblxyXG59IiwiZXhwb3J0IGNsYXNzIE9iamVjdFByb3ZpZGVyIHtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcigpIHtcclxuXHJcbiAgICB9XHJcblxyXG4gICAgcHJvdmlkZSh0aGVDbGFzcywgYXJncyA9IFtdKSB7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgICAgICAgcmVzb2x2ZShuZXcgdGhlQ2xhc3MoLi4uYXJncykpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxufSIsImV4cG9ydCBjbGFzcyBUZXN0Q2xhc3NTdGF0ZSB7XHJcblxyXG4gICAgc3RhdGljIGdldCBSVU5OSU5HKCkgeyByZXR1cm4gMDsgfVxyXG4gICAgc3RhdGljIGdldCBTVUNDRVNTKCkgeyByZXR1cm4gMTsgfVxyXG4gICAgc3RhdGljIGdldCBGQUlMKCkgeyByZXR1cm4gLTE7IH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFxyXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IGNsYXNzTmFtZSBcclxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBzdGF0ZSBcclxuICAgICAqL1xyXG4gICAgY29uc3RydWN0b3Ioc3RhdGUsIGNsYXNzTmFtZSwgZnVuY3Rpb25OYW1lKSB7XHJcblxyXG4gICAgICAgIC8qKiBAdHlwZSB7U3RyaW5nfSAqL1xyXG4gICAgICAgIHRoaXMuc3RhdGUgPSBzdGF0ZTtcclxuXHJcbiAgICAgICAgLyoqIEB0eXBlIHtTdHJpbmd9ICovXHJcbiAgICAgICAgdGhpcy5jbGFzc05hbWUgPSBjbGFzc05hbWU7XHJcblxyXG4gICAgICAgIC8qKiBAdHlwZSB7U3RyaW5nfSAqL1xyXG4gICAgICAgIHRoaXMuZnVuY3Rpb25OYW1lID0gZnVuY3Rpb25OYW1lO1xyXG4gICAgICAgIFxyXG4gICAgfVxyXG59IiwiaW1wb3J0IHsgTGlzdCwgTWFwLCBPYmplY3RGdW5jdGlvbiB9IGZyb20gXCJjb3JldXRpbF92MVwiO1xyXG5pbXBvcnQgeyBPYmplY3RQcm92aWRlciB9IGZyb20gXCIuL29iamVjdFByb3ZpZGVyLmpzXCI7XHJcblxyXG5leHBvcnQgY2xhc3MgVGVzdEV4ZWN1dGlvbkNvbnRleHQge1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogXHJcbiAgICAgKiBAcGFyYW0ge01hcH0gdGVzdENsYXNzTWFwXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdFByb3ZpZGVyfSBvYmplY3RQcm92aWRlciBcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0RnVuY3Rpb259IHJlc3VsdExpc3RlbmVyIFxyXG4gICAgICovXHJcbiAgICBjb25zdHJ1Y3Rvcih0ZXN0Q2xhc3NNYXAsIG9iamVjdFByb3ZpZGVyLCByZXN1bHRMaXN0ZW5lciA9IG51bGwpIHtcclxuXHJcbiAgICAgICAgLyoqIEB0eXBlIHtPYmplY3RGdW5jdGlvbn0gKi9cclxuICAgICAgICB0aGlzLnJlc3VsdExpc3RlbmVyID0gcmVzdWx0TGlzdGVuZXI7XHJcblxyXG4gICAgICAgIC8qKiBAdHlwZSB7T2JqZWN0UHJvdmlkZXJ9ICovXHJcbiAgICAgICAgdGhpcy5vYmplY3RQcm92aWRlciA9IG9iamVjdFByb3ZpZGVyO1xyXG5cclxuICAgICAgICAvKiogQHR5cGUge01hcH0gKi9cclxuICAgICAgICB0aGlzLnRlc3RDbGFzc01hcCA9IHRlc3RDbGFzc01hcDtcclxuXHJcbiAgICAgICAgLyoqIEB0eXBlIHtNYXB9ICovXHJcbiAgICAgICAgdGhpcy50ZXN0T2JqZWN0TWFwID0gbmV3IE1hcCgpO1xyXG5cclxuICAgICAgICAvKiogQHR5cGUge0xpc3R9ICovXHJcbiAgICAgICAgdGhpcy5ydW5TdWNjZXNzVGVzdExpc3QgPSBuZXcgTGlzdCgpO1xyXG5cclxuICAgICAgICAvKiogQHR5cGUge0xpc3R9ICovXHJcbiAgICAgICAgdGhpcy5ydW5GYWlsVGVzdExpc3QgPSBuZXcgTGlzdCgpO1xyXG4gICAgICAgIFxyXG4gICAgfVxyXG5cclxufSIsImV4cG9ydCBjbGFzcyBUZXN0VHJpZ2dlciB7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSdW4gdGVzdCBieSBjbGFzcyBuYW1lXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY2xhc3NOYW1lIFxyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGZ1bmN0aW9uTmFtZSBcclxuICAgICAqL1xyXG4gICAgcnVuRnVuY3Rpb24oY2xhc3NOYW1lLCBmdW5jdGlvbk5hbWUpIHtcclxuXHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSdW4gdGVzdCBieSBjbGFzcyBuYW1lXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY2xhc3NOYW1lIFxyXG4gICAgICovXHJcbiAgICBydW5DbGFzcyhjbGFzc05hbWUpIHtcclxuXHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSdW4gYWxsIHRlc3QgY2xhc3Nlc1xyXG4gICAgICovXHJcbiAgICBydW5BbGwoKSB7XHJcbiAgICAgICAgXHJcbiAgICB9XHJcbn0iLCJpbXBvcnQgeyBMaXN0LCBMb2dnZXIsIE1hcCwgT2JqZWN0RnVuY3Rpb24gfSBmcm9tIFwiY29yZXV0aWxfdjFcIjtcclxuaW1wb3J0IHsgT2JqZWN0UHJvdmlkZXIgfSBmcm9tIFwiLi9vYmplY3RQcm92aWRlci5qc1wiO1xyXG5pbXBvcnQgeyBUZXN0Q2xhc3NTdGF0ZSB9IGZyb20gXCIuL3Rlc3RDbGFzc1N0YXRlLmpzXCI7XHJcbmltcG9ydCB7IFRlc3RFeGVjdXRpb25Db250ZXh0IH0gZnJvbSBcIi4vdGVzdEV4ZWN1dGlvbkNvbnRleHQuanNcIjtcclxuaW1wb3J0IHsgVGVzdFRyaWdnZXIgfSBmcm9tIFwiLi90ZXN0VHJpZ2dlci5qc1wiO1xyXG5cclxuY29uc3QgTE9HID0gbmV3IExvZ2dlcihcIlRlc3RCZW5jaFwiKTtcclxuXHJcbmV4cG9ydCBjbGFzcyBUZXN0QmVuY2ggZXh0ZW5kcyBUZXN0VHJpZ2dlciB7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0RnVuY3Rpb259IGxvZ0xpc3RlbmVyIFxyXG4gICAgICogQHBhcmFtIHtPYmplY3RGdW5jdGlvbn0gcmVzdWx0TGlzdGVuZXIgXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdFByb3ZpZGVyfSBvYmplY3RQcm92aWRlclxyXG4gICAgICovXHJcbiAgICBjb25zdHJ1Y3Rvcihsb2dMaXN0ZW5lciA9IG51bGwsXHJcbiAgICAgICAgICAgIHJlc3VsdExpc3RlbmVyID0gbnVsbCwgXHJcbiAgICAgICAgICAgIG9iamVjdFByb3ZpZGVyID0gbmV3IE9iamVjdFByb3ZpZGVyKCkpIHtcclxuICAgICAgICBcclxuICAgICAgICBzdXBlcigpO1xyXG5cclxuICAgICAgICAvKiogQHR5cGUge09iamVjdEZ1bmN0aW9ufSAqL1xyXG4gICAgICAgIHRoaXMubG9nTGlzdGVuZXIgPSBsb2dMaXN0ZW5lcjtcclxuXHJcbiAgICAgICAgLyoqIEB0eXBlIHtNYXB9ICovXHJcbiAgICAgICAgdGhpcy50ZXN0Q2xhc3NNYXAgPSBuZXcgTWFwKCk7XHJcblxyXG4gICAgICAgIC8qKiBAdHlwZSB7T2JqZWN0RnVuY3Rpb259ICovXHJcbiAgICAgICAgdGhpcy5yZXN1bHRMaXN0ZW5lciA9IHJlc3VsdExpc3RlbmVyO1xyXG5cclxuICAgICAgICAvKiogQHR5cGUge09iamVjdFByb3ZpZGVyfSAqL1xyXG4gICAgICAgIHRoaXMub2JqZWN0UHJvdmlkZXIgPSBvYmplY3RQcm92aWRlcjtcclxuXHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSB0ZXN0T2JqZWN0IFxyXG4gICAgICogQHJldHVybnMge1Rlc3RCZW5jaH1cclxuICAgICAqL1xyXG4gICAgYWRkVGVzdCh0ZXN0Q2xhc3MpIHtcclxuICAgICAgICBpZiAoIXRlc3RDbGFzcy50ZXN0RnVuY3Rpb25zIHx8ICEodGVzdENsYXNzLnRlc3RGdW5jdGlvbnMoKSBpbnN0YW5jZW9mIExpc3QpKSB7XHJcbiAgICAgICAgICAgIHRocm93IFwiQSBzdGF0aWMgZnVuY3Rpb24gY2FsbGVkICd0ZXN0RnVuY3Rpb25zJyBtdXN0IGJlIHByb3ZpZGVkIGluIFwiIFxyXG4gICAgICAgICAgICAgICAgKyB0ZXN0Q2xhc3MubmFtZSBcclxuICAgICAgICAgICAgICAgICsgXCIgd2hpY2ggcmV0dXJucyBhIExpc3QgYWxsIHRoZSB0ZXN0IGZ1bmN0aW9ucyBpbiBcIlxyXG4gICAgICAgICAgICAgICAgKyB0ZXN0Q2xhc3MubmFtZSArIFwiLnByb3RvdHlwZVwiXHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMudGVzdENsYXNzTWFwLnNldCh0ZXN0Q2xhc3MubmFtZSwgdGVzdENsYXNzKTtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxuXHJcbiAgICBjb250YWlucyh0ZXN0Q2xhc3MpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy50ZXN0Q2xhc3NNYXAuY29udGFpbnModGVzdENsYXNzLm5hbWUpO1xyXG4gICAgfVxyXG5cclxuICAgIHJ1bkFsbCgpIHtcclxuICAgICAgICBMb2dnZXIubGlzdGVuZXIgPSB0aGlzLmxvZ0xpc3RlbmVyO1xyXG4gICAgICAgIGxldCBjb250ZXh0ID0gbmV3IFRlc3RFeGVjdXRpb25Db250ZXh0KHRoaXMudGVzdENsYXNzTWFwLCB0aGlzLm9iamVjdFByb3ZpZGVyLCB0aGlzLnJlc3VsdExpc3RlbmVyKTtcclxuICAgICAgICByZXR1cm4gdGhpcy50ZXN0Q2xhc3NNYXAucHJvbWlzZUNoYWluKFRlc3RCZW5jaC5ydW4sIGNvbnRleHQpLnRoZW4oKCkgPT4ge1xyXG4gICAgICAgICAgICBUZXN0QmVuY2guY2xvc2UoY29udGV4dCk7XHJcbiAgICAgICAgfSkuY2F0Y2goKGVycm9yKSA9PiB7XHJcbiAgICAgICAgICAgIHRocm93IGVycm9yO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUnVuIHRlc3QgYnkgY2xhc3MgbmFtZVxyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHRlc3RDbGFzc05hbWUgXHJcbiAgICAgKi9cclxuICAgIHJ1bkNsYXNzKHRlc3RDbGFzc05hbWUpIHtcclxuICAgICAgICBMb2dnZXIubGlzdGVuZXIgPSB0aGlzLmxvZ0xpc3RlbmVyO1xyXG4gICAgICAgIGxldCB0ZXN0Q2xhc3MgPSB0aGlzLnRlc3RDbGFzc01hcC5nZXQodGVzdENsYXNzTmFtZSk7XHJcbiAgICAgICAgbGV0IGNvbnRleHQgPSBuZXcgVGVzdEV4ZWN1dGlvbkNvbnRleHQodGhpcy50ZXN0Q2xhc3NNYXAsIHRoaXMub2JqZWN0UHJvdmlkZXIsIHRoaXMucmVzdWx0TGlzdGVuZXIpO1xyXG4gICAgICAgIHJldHVybiBUZXN0QmVuY2gucnVuKHRlc3RDbGFzc05hbWUsIHRlc3RDbGFzcywgY29udGV4dCkudGhlbigoKSA9PiB7XHJcbiAgICAgICAgICAgIFRlc3RCZW5jaC5jbG9zZShjb250ZXh0KTtcclxuICAgICAgICB9KS5jYXRjaCgoZXJyb3IpID0+IHtcclxuICAgICAgICAgICAgdGhyb3cgZXJyb3I7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSdW4gdGVzdCBieSBjbGFzcyBuYW1lXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdGVzdENsYXNzTmFtZSBcclxuICAgICAqL1xyXG4gICAgcnVuRnVuY3Rpb24odGVzdENsYXNzTmFtZSwgZnVuY3Rpb25OYW1lKSB7XHJcbiAgICAgICAgTG9nZ2VyLmxpc3RlbmVyID0gdGhpcy5sb2dMaXN0ZW5lcjtcclxuICAgICAgICBsZXQgdGVzdENsYXNzID0gdGhpcy50ZXN0Q2xhc3NNYXAuZ2V0KHRlc3RDbGFzc05hbWUpO1xyXG4gICAgICAgIGxldCBjb250ZXh0ID0gbmV3IFRlc3RFeGVjdXRpb25Db250ZXh0KHRoaXMudGVzdENsYXNzTWFwLCB0aGlzLm9iamVjdFByb3ZpZGVyLCB0aGlzLnJlc3VsdExpc3RlbmVyKTtcclxuICAgICAgICByZXR1cm4gVGVzdEJlbmNoLnJ1bih0ZXN0Q2xhc3NOYW1lLCB0ZXN0Q2xhc3MsIGNvbnRleHQsIGZ1bmN0aW9uTmFtZSkudGhlbigoKSA9PiB7XHJcbiAgICAgICAgICAgIFRlc3RCZW5jaC5jbG9zZShjb250ZXh0KTtcclxuICAgICAgICB9KS5jYXRjaCgoZXJyb3IpID0+IHtcclxuICAgICAgICAgICAgdGhyb3cgZXJyb3I7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBcclxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSB0ZXN0Q2xhc3NOYW1lXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gdGVzdENsYXNzIFxyXG4gICAgICogQHBhcmFtIHtUZXN0RXhlY3V0aW9uQ29udGV4dH0gY29udGV4dCBcclxuICAgICAqL1xyXG4gICAgc3RhdGljIHJ1bih0ZXN0Q2xhc3NOYW1lLCB0ZXN0Q2xhc3MsIGNvbnRleHQsIGZ1bmN0aW9uTmFtZSA9IG51bGwpIHtcclxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICAgICAgICBUZXN0QmVuY2gucHJpbnRIZWFkZXIodGVzdENsYXNzLm5hbWUpO1xyXG4gICAgICAgICAgICBUZXN0QmVuY2gucnVuRnVuY3Rpb25zQnlDbGFzcyh0ZXN0Q2xhc3MsIGNvbnRleHQsIGZ1bmN0aW9uTmFtZSkudGhlbigoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICByZXNvbHZlKCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogXHJcbiAgICAgKiBAcGFyYW0ge0xpc3R9IGZ1bmN0aW9ucyBcclxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBmdW5jdGlvbk5hbWUgXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBmaWx0ZXIoZnVuY3Rpb25zLCBmdW5jdGlvbk5hbWUpIHtcclxuICAgICAgICBpZiAoIWZ1bmN0aW9uTmFtZSkge1xyXG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb25zO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gbmV3IExpc3QoZnVuY3Rpb25zLmdldEFycmF5KCkuZmlsdGVyKCh2YWx1ZSkgPT4ge1xyXG4gICAgICAgICAgICByZXR1cm4gdmFsdWUgPT09IGZ1bmN0aW9uTmFtZTtcclxuICAgICAgICB9KSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSB0ZXN0Q2xhc3MgXHJcbiAgICAgKiBAcGFyYW0ge1Rlc3RFeGVjdXRpb25Db250ZXh0fSBjb250ZXh0IFxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgbG9hZE9iamVjdEJ5Q2xhc3ModGVzdENsYXNzLCBjb250ZXh0KSB7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgICAgICAgaWYgKGNvbnRleHQudGVzdE9iamVjdE1hcC5jb250YWlucyh0ZXN0Q2xhc3MubmFtZSkpIHtcclxuICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBjb250ZXh0Lm9iamVjdFByb3ZpZGVyLnByb3ZpZGUodGVzdENsYXNzKS50aGVuKCh0ZXN0T2JqZWN0KSA9PiB7XHJcbiAgICAgICAgICAgICAgICBjb250ZXh0LnRlc3RPYmplY3RNYXAuc2V0KHRlc3RDbGFzcy5uYW1lLCB0ZXN0T2JqZWN0KTtcclxuICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSB0ZXN0Q2xhc3MgXHJcbiAgICAgKiBAcGFyYW0ge1Rlc3RFeGVjdXRpb25Db250ZXh0fSBjb250ZXh0IFxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgcnVuRnVuY3Rpb25zQnlDbGFzcyh0ZXN0Q2xhc3MsIGNvbnRleHQsIGZ1bmN0aW9uTmFtZSkge1xyXG4gICAgICAgIC8qKiBAdHlwZSB7TGlzdH0gKi9cclxuICAgICAgICBjb25zdCB0ZXN0RnVuY3Rpb25zID0gdGVzdENsYXNzLnRlc3RGdW5jdGlvbnMoKTtcclxuICAgICAgICByZXR1cm4gdGVzdEZ1bmN0aW9ucy5wcm9taXNlQ2hhaW4oKHRlc3RGdW5jdGlvbikgPT4ge1xyXG4gICAgICAgICAgICBpZiAoZnVuY3Rpb25OYW1lICYmIHRlc3RGdW5jdGlvbi5uYW1lICE9PSBmdW5jdGlvbk5hbWUpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSxyZWplY3QpID0+IHsgcmVzb2x2ZSgpOyB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKGZ1bmN0aW9uQ29tcGxldGVSZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgICAgICAgICAgIFRlc3RCZW5jaC5ydW5GdW5jdGlvbih0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbiwgZnVuY3Rpb25Db21wbGV0ZVJlc29sdmUsIGNvbnRleHQpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9LCBjb250ZXh0KTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHRlc3RDbGFzcyBcclxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IHRlc3RGdW5jdGlvbiBcclxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmN0aW9uQ29tcGxldGVSZXNvbHZlXHJcbiAgICAgKiBAcGFyYW0ge1Rlc3RFeGVjdXRpb25Db250ZXh0fSBjb250ZXh0IFxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgcnVuRnVuY3Rpb24odGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24sIGZ1bmN0aW9uQ29tcGxldGVSZXNvbHZlLCBjb250ZXh0KSB7XHJcbiAgICAgICAgVGVzdEJlbmNoLmNhbGxSZXN1bHRMaXN0ZW5lcihjb250ZXh0LCBUZXN0Q2xhc3NTdGF0ZS5SVU5OSU5HLCB0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbik7XHJcbiAgICAgICAgVGVzdEJlbmNoLmxvYWRPYmplY3RCeUNsYXNzKHRlc3RDbGFzcywgY29udGV4dCkudGhlbigoKSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IHRlc3RPYmplY3QgPSBjb250ZXh0LnRlc3RPYmplY3RNYXAuZ2V0KHRlc3RDbGFzcy5uYW1lKTtcclxuXHJcbiAgICAgICAgICAgIC8qKiBAdHlwZSB7UHJvbWlzZX0gKi9cclxuICAgICAgICAgICAgbGV0IHRlc3RGdW5jdGlvblJlc3VsdCA9IG51bGw7XHJcblxyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgdGVzdEZ1bmN0aW9uUmVzdWx0ID0gdGVzdEZ1bmN0aW9uLmNhbGwodGVzdE9iamVjdCk7XHJcbiAgICAgICAgICAgICAgICBpZiAoISh0ZXN0RnVuY3Rpb25SZXN1bHQgaW5zdGFuY2VvZiBQcm9taXNlKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIFRlc3RCZW5jaC5yZXBvcnRTdWNjZXNzKHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uLCBjb250ZXh0KTtcclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKGV4Y2VwdGlvbikge1xyXG4gICAgICAgICAgICAgICAgVGVzdEJlbmNoLnJlcG9ydEZhaWx1cmUodGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24sIGV4Y2VwdGlvbiwgY29udGV4dCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmICghKHRlc3RGdW5jdGlvblJlc3VsdCBpbnN0YW5jZW9mIFByb21pc2UpKSB7XHJcbiAgICAgICAgICAgICAgICBmdW5jdGlvbkNvbXBsZXRlUmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0ZXN0RnVuY3Rpb25SZXN1bHQudGhlbigoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBUZXN0QmVuY2gucmVwb3J0U3VjY2Vzcyh0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbiwgY29udGV4dCk7XHJcbiAgICAgICAgICAgICAgICBmdW5jdGlvbkNvbXBsZXRlUmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICB9KS5jYXRjaCgoZXhjZXB0aW9uKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBUZXN0QmVuY2gucmVwb3J0RmFpbHVyZSh0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbiwgZXhjZXB0aW9uLCBjb250ZXh0KTtcclxuICAgICAgICAgICAgICAgIGZ1bmN0aW9uQ29tcGxldGVSZXNvbHZlKCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gdGVzdENsYXNzIFxyXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gdGVzdEZ1bmN0aW9uIFxyXG4gICAgICogQHBhcmFtIHtFcnJvcn0gZXhjZXB0aW9uIFxyXG4gICAgICogQHBhcmFtIHtUZXN0RXhlY3V0aW9uQ29udGV4dH0gY29udGV4dCBcclxuICAgICAqL1xyXG4gICAgc3RhdGljIHJlcG9ydEZhaWx1cmUodGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24sIGV4Y2VwdGlvbiwgY29udGV4dCkge1xyXG4gICAgICAgIFRlc3RCZW5jaC5hZGRGYWlsKHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uLCBjb250ZXh0KTtcclxuICAgICAgICBUZXN0QmVuY2guY2FsbFJlc3VsdExpc3RlbmVyKGNvbnRleHQsIFRlc3RDbGFzc1N0YXRlLkZBSUwsIHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uKTtcclxuICAgICAgICBMT0cuZXJyb3IoVGVzdEJlbmNoLnNpZ25hdHVyZSh0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbikgKyBcIiBmYWlsZWQuIFJlYXNvbjpcIik7XHJcbiAgICAgICAgTE9HLmVycm9yKGV4Y2VwdGlvbik7XHJcbiAgICAgICAgTE9HLmVycm9yKFwiXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gdGVzdENsYXNzIFxyXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gdGVzdEZ1bmN0aW9uIFxyXG4gICAgICogQHBhcmFtIHtUZXN0RXhlY3V0aW9uQ29udGV4dH0gY29udGV4dCBcclxuICAgICAqL1xyXG4gICAgc3RhdGljIHJlcG9ydFN1Y2Nlc3ModGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24sIGNvbnRleHQpIHtcclxuICAgICAgICBUZXN0QmVuY2guYWRkU3VjY2Vzcyh0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbiwgY29udGV4dCk7XHJcbiAgICAgICAgVGVzdEJlbmNoLmNhbGxSZXN1bHRMaXN0ZW5lcihjb250ZXh0LCBUZXN0Q2xhc3NTdGF0ZS5TVUNDRVNTLCB0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbik7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSB0ZXN0Q2xhc3MgXHJcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gc3RhdGUgXHJcbiAgICAgKiBAcGFyYW0ge1Rlc3RFeGVjdXRpb25Db250ZXh0fSBjb250ZXh0IFxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgY2FsbFJlc3VsdExpc3RlbmVyKGNvbnRleHQsIHN0YXRlLCB0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbikge1xyXG4gICAgICAgIGlmICghY29udGV4dC5yZXN1bHRMaXN0ZW5lcikge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNvbnRleHQucmVzdWx0TGlzdGVuZXIuY2FsbChuZXcgVGVzdENsYXNzU3RhdGUoc3RhdGUsIHRlc3RDbGFzcy5uYW1lLCB0ZXN0RnVuY3Rpb24gPyB0ZXN0RnVuY3Rpb24ubmFtZSA6IG51bGwpKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHRlc3RDbGFzcyBcclxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IHRlc3RGdW5jdGlvbiBcclxuICAgICAqIEBwYXJhbSB7VGVzdEV4ZWN1dGlvbkNvbnRleHR9IGNvbnRleHQgXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBhZGRTdWNjZXNzKHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uLCBjb250ZXh0KSB7XHJcbiAgICAgICAgY29udGV4dC5ydW5TdWNjZXNzVGVzdExpc3QuYWRkKFRlc3RCZW5jaC5zaWduYXR1cmUodGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24pKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHRlc3RDbGFzcyBcclxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IHRlc3RGdW5jdGlvbiBcclxuICAgICAqIEBwYXJhbSB7VGVzdEV4ZWN1dGlvbkNvbnRleHR9IGNvbnRleHQgXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBhZGRGYWlsKHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uLCBjb250ZXh0KSB7XHJcbiAgICAgICAgY29udGV4dC5ydW5GYWlsVGVzdExpc3QuYWRkKFRlc3RCZW5jaC5zaWduYXR1cmUodGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24pKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHRlc3RDbGFzcyBcclxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IHRlc3RGdW5jdGlvbiBcclxuICAgICAqL1xyXG4gICAgc3RhdGljIHNpZ25hdHVyZSh0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbikge1xyXG4gICAgICAgIHJldHVybiB0ZXN0Q2xhc3MubmFtZSArIFwiLlwiICsgdGVzdEZ1bmN0aW9uLm5hbWUgKyBcIigpXCI7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBcclxuICAgICAqIEBwYXJhbSB7VGVzdEV4ZWN1dGlvbkNvbnRleHR9IGNvbnRleHQgXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBjbG9zZShjb250ZXh0KSB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgVGVzdEJlbmNoLnByaW50UmVwb3J0KGNvbnRleHQpO1xyXG4gICAgICAgIH0gZmluYWxseSB7XHJcbiAgICAgICAgICAgIExvZ2dlci5jbGVhckxpc3RlbmVyKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogXHJcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gdGVzdE5hbWUgXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBwcmludEhlYWRlcih0ZXN0TmFtZSkge1xyXG4gICAgICAgIGNvbnN0IGxpbmUgPSBcIiMgIFJ1bm5pbmcgdGVzdDogXCIgKyB0ZXN0TmFtZSArIFwiICAjXCI7XHJcbiAgICAgICAgbGV0IGRlY29yYXRpb24gPSBcIlwiO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGluZS5sZW5ndGggOyBpKyspIHtcclxuICAgICAgICAgICAgZGVjb3JhdGlvbiA9IGRlY29yYXRpb24gKyBcIiNcIjtcclxuICAgICAgICB9XHJcbiAgICAgICAgTE9HLmluZm8oZGVjb3JhdGlvbik7XHJcbiAgICAgICAgTE9HLmluZm8obGluZSk7XHJcbiAgICAgICAgTE9HLmluZm8oZGVjb3JhdGlvbik7XHJcbiAgICAgICAgTE9HLmluZm8oXCJcIik7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBcclxuICAgICAqIEBwYXJhbSB7VGVzdEV4ZWN1dGlvbkNvbnRleHR9IGNvbnRleHQgXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBwcmludFJlcG9ydChjb250ZXh0KSB7XHJcbiAgICAgICAgTE9HLmluZm8oXCIjIyMjIyMjIyMjIyMjIyMjIyMjXCIpO1xyXG4gICAgICAgIExPRy5pbmZvKFwiIyAgIFRlc3QgUmVwb3J0ICAgI1wiKTtcclxuICAgICAgICBMT0cuaW5mbyhcIiMjIyMjIyMjIyMjIyMjIyMjIyNcIik7XHJcbiAgICAgICAgTE9HLmluZm8oXCJcIik7XHJcblxyXG4gICAgICAgIGxldCBzdWNjZXNzQ291bnRlciA9IDA7XHJcbiAgICAgICAgaWYgKGNvbnRleHQucnVuU3VjY2Vzc1Rlc3RMaXN0LnNpemUoKSA+IDApe1xyXG4gICAgICAgICAgICBMT0cuaW5mbyhcIlN1Y2NlZWRlZDpcIik7XHJcbiAgICAgICAgICAgIGNvbnRleHQucnVuU3VjY2Vzc1Rlc3RMaXN0LmZvckVhY2goKHZhbHVlLGNvbnRleHQpID0+IHtcclxuICAgICAgICAgICAgICAgIExPRy5pbmZvKHN1Y2Nlc3NDb3VudGVyKysgKyBcIi4gXCIgKyB2YWx1ZSk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIExPRy5pbmZvKFwiXCIpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IGZhaWxDb3VudGVyID0gMDtcclxuICAgICAgICBpZiAoY29udGV4dC5ydW5GYWlsVGVzdExpc3Quc2l6ZSgpID4gMCl7XHJcbiAgICAgICAgICAgIExPRy5pbmZvKFwiRmFpbGVkOlwiKTtcclxuICAgICAgICAgICAgY29udGV4dC5ydW5GYWlsVGVzdExpc3QuZm9yRWFjaCgodmFsdWUsY29udGV4dCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgTE9HLmluZm8oZmFpbENvdW50ZXIrKyArIFwiLiBcIiArIHZhbHVlKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgTE9HLmluZm8oXCJcIik7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoZmFpbENvdW50ZXIgIT0gMCkge1xyXG4gICAgICAgICAgICB0aHJvdyBjb250ZXh0LnJ1bkZhaWxUZXN0TGlzdC5zaXplKCkgKyBcIiBUZXN0cyBmYWlsZWRcIjtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG59Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQU8sTUFBTSxhQUFhLENBQUM7QUFDM0I7QUFDQSxJQUFJLE9BQU8sVUFBVSxDQUFDLE9BQU8sR0FBRyxJQUFJLEVBQUU7QUFDdEMsUUFBUSxHQUFHLE9BQU8sRUFBRTtBQUNwQixZQUFZLE9BQU87QUFDbkIsU0FBUztBQUNULFFBQVEsTUFBTSxrREFBa0QsR0FBRyxPQUFPLENBQUM7QUFDM0UsS0FBSztBQUNMO0FBQ0E7O0FDVE8sTUFBTSxZQUFZLENBQUM7QUFDMUI7QUFDQSxJQUFJLE9BQU8sWUFBWSxDQUFDLFFBQVEsRUFBRSxNQUFNLEVBQUU7QUFDMUMsUUFBUSxJQUFJLFFBQVEsS0FBSyxNQUFNLEVBQUU7QUFDakMsWUFBWSxPQUFPO0FBQ25CLFNBQVM7QUFDVCxRQUFRLE1BQU0sc0NBQXNDLEdBQUcsUUFBUSxHQUFHLGFBQWEsR0FBRyxNQUFNLEdBQUcsR0FBRyxDQUFDO0FBQy9GLEtBQUs7QUFDTDtBQUNBOztDQUFDLEtDVFksY0FBYyxDQUFDO0FBQzVCO0FBQ0EsSUFBSSxXQUFXLEdBQUc7QUFDbEI7QUFDQSxLQUFLO0FBQ0w7QUFDQSxJQUFJLE9BQU8sQ0FBQyxRQUFRLEVBQUUsSUFBSSxHQUFHLEVBQUUsRUFBRTtBQUNqQyxRQUFRLE9BQU8sSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUUsTUFBTSxLQUFLO0FBQ2hELFlBQVksT0FBTyxDQUFDLElBQUksUUFBUSxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQztBQUMzQyxTQUFTLENBQUMsQ0FBQztBQUNYLEtBQUs7QUFDTDtBQUNBOztDQUFDLEtDWlksY0FBYyxDQUFDO0FBQzVCO0FBQ0EsSUFBSSxXQUFXLE9BQU8sR0FBRyxFQUFFLE9BQU8sQ0FBQyxDQUFDLEVBQUU7QUFDdEMsSUFBSSxXQUFX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
