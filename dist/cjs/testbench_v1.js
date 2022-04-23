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
     * @param {Method} resultListener 
     */
    constructor(testClassMap, objectProvider, resultListener = null) {

        /** @type {Method} */
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
     * @param {Method} logListener 
     * @param {Method} resultListener 
     * @param {ObjectProvider} objectProvider
     */
    constructor(logListener = null,
            resultListener = null, 
            objectProvider = new ObjectProvider()) {
        
        super();

        /** @type {Method} */
        this.logListener = logListener;

        /** @type {Map} */
        this.testClassMap = new coreutil_v1.Map();

        /** @type {Method} */
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

    async runAll() {
        coreutil_v1.Logger.listener = this.logListener;
        let context = new TestExecutionContext(this.testClassMap, this.objectProvider, this.resultListener);
        try {
            await this.testClassMap.promiseChain(TestBench.run, context);
            TestBench.close(context);
            return context;
        } catch(error) {
            throw error;
        }
    }

    /**
     * Run test by class name
     * @param {string} testClassName 
     */
    async runClass(testClassName) {
        coreutil_v1.Logger.listener = this.logListener;
        let testClass = this.testClassMap.get(testClassName);
        let context = new TestExecutionContext(this.testClassMap, this.objectProvider, this.resultListener);
        try {
            await TestBench.run(testClassName, testClass, context);
            TestBench.close(context);
            return context;
        } catch(error) {
            throw error;
        }
    }

    /**
     * Run test by class name
     * @param {string} testClassName 
     */
    async runFunction(testClassName, functionName) {
        coreutil_v1.Logger.listener = this.logListener;
        let testClass = this.testClassMap.get(testClassName);
        let context = new TestExecutionContext(this.testClassMap, this.objectProvider, this.resultListener);
        try {
            await TestBench.run(testClassName, testClass, context, functionName);
            TestBench.close(context);
            return context;
        } catch(error) {
            throw error;
        }
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
    static async loadObjectByClass(testClass, context) {
        if (context.testObjectMap.contains(testClass.name)) {
            return context;
        }
        try {
            const testObject = await context.objectProvider.provide(testClass);
            context.testObjectMap.set(testClass.name, testObject);
            return context;
        } catch(error) {
            throw new Error(error);
        }
    }

    /**
     * 
     * @param {Object} testClass 
     * @param {TestExecutionContext} context 
     */
    static async runFunctionsByClass(testClass, context, functionName) {
        /** @type {List} */
        const testFunctions = testClass.testFunctions();
        await testFunctions.promiseChain((testFunction) => {
            if (functionName && testFunction.name !== functionName) {
                return Promise.resolve();
            }
            return TestBench.runFunction(testClass, testFunction, context);
        }, context);
    }

    /**
     * 
     * @param {Object} testClass 
     * @param {Function} testFunction 
     * @param {Function} functionCompleteResolve
     * @param {TestExecutionContext} context 
     */
    static async runFunction(testClass, testFunction, context) {
        TestBench.callResultListener(context, TestClassState.RUNNING, testClass, testFunction);
        await TestBench.loadObjectByClass(testClass, context);
        const testObject = context.testObjectMap.get(testClass.name);

        /** @type {Promise} */
        let testFunctionResult = null;

        try {
            testFunctionResult = testFunction.call(testObject);
        } catch (exception) {
            TestBench.reportFailure(testClass, testFunction, exception, context);
        }

        if (!(testFunctionResult instanceof Promise)) {
            TestBench.reportSuccess(testClass, testFunction, context);
            return;
        }
        try {
            await testFunctionResult;
            TestBench.reportSuccess(testClass, testFunction, context);
        } catch(exception) {
            TestBench.reportFailure(testClass, testFunction, exception, context);
        }
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdGJlbmNoX3YxLmpzIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdGVzdGJlbmNoL29iamVjdFByb3ZpZGVyLmpzIiwiLi4vLi4vc3JjL3Rlc3RiZW5jaC90ZXN0Q2xhc3NTdGF0ZS5qcyIsIi4uLy4uL3NyYy90ZXN0YmVuY2gvdGVzdEV4ZWN1dGlvbkNvbnRleHQuanMiLCIuLi8uLi9zcmMvdGVzdGJlbmNoL3Rlc3RUcmlnZ2VyLmpzIiwiLi4vLi4vc3JjL3Rlc3RiZW5jaC90ZXN0QmVuY2guanMiLCIuLi8uLi9zcmMvdGVzdGJlbmNoL2Fzc2VydGlvbnMvYXNzZXJ0Qm9vbGVhbi5qcyIsIi4uLy4uL3NyYy90ZXN0YmVuY2gvYXNzZXJ0aW9ucy9hc3NlcnRTdHJpbmcuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGNsYXNzIE9iamVjdFByb3ZpZGVyIHtcblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgIH1cblxuXG4gICAgXG4gICAgcHJvdmlkZSh0aGVDbGFzcywgYXJncyA9IFtdKSB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICByZXNvbHZlKG5ldyB0aGVDbGFzcyguLi5hcmdzKSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxufSIsImV4cG9ydCBjbGFzcyBUZXN0Q2xhc3NTdGF0ZSB7XG5cbiAgICBzdGF0aWMgZ2V0IFJVTk5JTkcoKSB7IHJldHVybiAwOyB9XG4gICAgc3RhdGljIGdldCBTVUNDRVNTKCkgeyByZXR1cm4gMTsgfVxuICAgIHN0YXRpYyBnZXQgRkFJTCgpIHsgcmV0dXJuIC0xOyB9XG5cbiAgICAvKipcbiAgICAgKiBcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gY2xhc3NOYW1lIFxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBzdGF0ZSBcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihzdGF0ZSwgY2xhc3NOYW1lLCBmdW5jdGlvbk5hbWUpIHtcblxuICAgICAgICAvKiogQHR5cGUge1N0cmluZ30gKi9cbiAgICAgICAgdGhpcy5zdGF0ZSA9IHN0YXRlO1xuXG4gICAgICAgIC8qKiBAdHlwZSB7U3RyaW5nfSAqL1xuICAgICAgICB0aGlzLmNsYXNzTmFtZSA9IGNsYXNzTmFtZTtcblxuICAgICAgICAvKiogQHR5cGUge1N0cmluZ30gKi9cbiAgICAgICAgdGhpcy5mdW5jdGlvbk5hbWUgPSBmdW5jdGlvbk5hbWU7XG4gICAgICAgIFxuICAgIH1cbn0iLCJpbXBvcnQgeyBMaXN0LCBNYXAsIE1ldGhvZCB9IGZyb20gXCJjb3JldXRpbF92MVwiO1xuaW1wb3J0IHsgT2JqZWN0UHJvdmlkZXIgfSBmcm9tIFwiLi9vYmplY3RQcm92aWRlci5qc1wiO1xuXG5leHBvcnQgY2xhc3MgVGVzdEV4ZWN1dGlvbkNvbnRleHQge1xuXG4gICAgLyoqXG4gICAgICogXG4gICAgICogQHBhcmFtIHtNYXB9IHRlc3RDbGFzc01hcFxuICAgICAqIEBwYXJhbSB7T2JqZWN0UHJvdmlkZXJ9IG9iamVjdFByb3ZpZGVyIFxuICAgICAqIEBwYXJhbSB7TWV0aG9kfSByZXN1bHRMaXN0ZW5lciBcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3Rvcih0ZXN0Q2xhc3NNYXAsIG9iamVjdFByb3ZpZGVyLCByZXN1bHRMaXN0ZW5lciA9IG51bGwpIHtcblxuICAgICAgICAvKiogQHR5cGUge01ldGhvZH0gKi9cbiAgICAgICAgdGhpcy5yZXN1bHRMaXN0ZW5lciA9IHJlc3VsdExpc3RlbmVyO1xuXG4gICAgICAgIC8qKiBAdHlwZSB7T2JqZWN0UHJvdmlkZXJ9ICovXG4gICAgICAgIHRoaXMub2JqZWN0UHJvdmlkZXIgPSBvYmplY3RQcm92aWRlcjtcblxuICAgICAgICAvKiogQHR5cGUge01hcH0gKi9cbiAgICAgICAgdGhpcy50ZXN0Q2xhc3NNYXAgPSB0ZXN0Q2xhc3NNYXA7XG5cbiAgICAgICAgLyoqIEB0eXBlIHtNYXB9ICovXG4gICAgICAgIHRoaXMudGVzdE9iamVjdE1hcCA9IG5ldyBNYXAoKTtcblxuICAgICAgICAvKiogQHR5cGUge0xpc3R9ICovXG4gICAgICAgIHRoaXMucnVuU3VjY2Vzc1Rlc3RMaXN0ID0gbmV3IExpc3QoKTtcblxuICAgICAgICAvKiogQHR5cGUge0xpc3R9ICovXG4gICAgICAgIHRoaXMucnVuRmFpbFRlc3RMaXN0ID0gbmV3IExpc3QoKTtcbiAgICAgICAgXG4gICAgfVxuXG59IiwiZXhwb3J0IGNsYXNzIFRlc3RUcmlnZ2VyIHtcblxuICAgIC8qKlxuICAgICAqIFJ1biB0ZXN0IGJ5IGNsYXNzIG5hbWVcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY2xhc3NOYW1lIFxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBmdW5jdGlvbk5hbWUgXG4gICAgICovXG4gICAgcnVuRnVuY3Rpb24oY2xhc3NOYW1lLCBmdW5jdGlvbk5hbWUpIHtcblxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJ1biB0ZXN0IGJ5IGNsYXNzIG5hbWVcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY2xhc3NOYW1lIFxuICAgICAqL1xuICAgIHJ1bkNsYXNzKGNsYXNzTmFtZSkge1xuXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUnVuIGFsbCB0ZXN0IGNsYXNzZXNcbiAgICAgKi9cbiAgICBydW5BbGwoKSB7XG4gICAgICAgIFxuICAgIH1cbn0iLCJpbXBvcnQgeyBMaXN0LCBMb2dnZXIsIE1hcCwgTWV0aG9kIH0gZnJvbSBcImNvcmV1dGlsX3YxXCI7XG5pbXBvcnQgeyBPYmplY3RQcm92aWRlciB9IGZyb20gXCIuL29iamVjdFByb3ZpZGVyLmpzXCI7XG5pbXBvcnQgeyBUZXN0Q2xhc3NTdGF0ZSB9IGZyb20gXCIuL3Rlc3RDbGFzc1N0YXRlLmpzXCI7XG5pbXBvcnQgeyBUZXN0RXhlY3V0aW9uQ29udGV4dCB9IGZyb20gXCIuL3Rlc3RFeGVjdXRpb25Db250ZXh0LmpzXCI7XG5pbXBvcnQgeyBUZXN0VHJpZ2dlciB9IGZyb20gXCIuL3Rlc3RUcmlnZ2VyLmpzXCI7XG5cbmNvbnN0IExPRyA9IG5ldyBMb2dnZXIoXCJUZXN0QmVuY2hcIik7XG5cbmV4cG9ydCBjbGFzcyBUZXN0QmVuY2ggZXh0ZW5kcyBUZXN0VHJpZ2dlciB7XG5cbiAgICAvKipcbiAgICAgKiBcbiAgICAgKiBAcGFyYW0ge01ldGhvZH0gbG9nTGlzdGVuZXIgXG4gICAgICogQHBhcmFtIHtNZXRob2R9IHJlc3VsdExpc3RlbmVyIFxuICAgICAqIEBwYXJhbSB7T2JqZWN0UHJvdmlkZXJ9IG9iamVjdFByb3ZpZGVyXG4gICAgICovXG4gICAgY29uc3RydWN0b3IobG9nTGlzdGVuZXIgPSBudWxsLFxuICAgICAgICAgICAgcmVzdWx0TGlzdGVuZXIgPSBudWxsLCBcbiAgICAgICAgICAgIG9iamVjdFByb3ZpZGVyID0gbmV3IE9iamVjdFByb3ZpZGVyKCkpIHtcbiAgICAgICAgXG4gICAgICAgIHN1cGVyKCk7XG5cbiAgICAgICAgLyoqIEB0eXBlIHtNZXRob2R9ICovXG4gICAgICAgIHRoaXMubG9nTGlzdGVuZXIgPSBsb2dMaXN0ZW5lcjtcblxuICAgICAgICAvKiogQHR5cGUge01hcH0gKi9cbiAgICAgICAgdGhpcy50ZXN0Q2xhc3NNYXAgPSBuZXcgTWFwKCk7XG5cbiAgICAgICAgLyoqIEB0eXBlIHtNZXRob2R9ICovXG4gICAgICAgIHRoaXMucmVzdWx0TGlzdGVuZXIgPSByZXN1bHRMaXN0ZW5lcjtcblxuICAgICAgICAvKiogQHR5cGUge09iamVjdFByb3ZpZGVyfSAqL1xuICAgICAgICB0aGlzLm9iamVjdFByb3ZpZGVyID0gb2JqZWN0UHJvdmlkZXI7XG5cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSB0ZXN0Q2xhc3MgXG4gICAgICogQHJldHVybnMge1Rlc3RCZW5jaH1cbiAgICAgKi9cbiAgICBhZGRUZXN0KHRlc3RDbGFzcykge1xuICAgICAgICBpZiAoIXRlc3RDbGFzcy50ZXN0RnVuY3Rpb25zIHx8ICEodGVzdENsYXNzLnRlc3RGdW5jdGlvbnMoKSBpbnN0YW5jZW9mIExpc3QpKSB7XG4gICAgICAgICAgICB0aHJvdyBcIkEgc3RhdGljIGZ1bmN0aW9uIGNhbGxlZCAndGVzdEZ1bmN0aW9ucycgbXVzdCBiZSBwcm92aWRlZCBpbiBcIiBcbiAgICAgICAgICAgICAgICArIHRlc3RDbGFzcy5uYW1lIFxuICAgICAgICAgICAgICAgICsgXCIgd2hpY2ggcmV0dXJucyBhIExpc3QgYWxsIHRoZSB0ZXN0IGZ1bmN0aW9ucyBpbiBcIlxuICAgICAgICAgICAgICAgICsgdGVzdENsYXNzLm5hbWUgKyBcIi5wcm90b3R5cGVcIlxuICAgICAgICB9XG4gICAgICAgIHRlc3RDbGFzcy50ZXN0RnVuY3Rpb25zKCkuZm9yRWFjaCgodmFsdWUscGFyZW50KSA9PiB7XG4gICAgICAgICAgICBpZighdmFsdWUpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyB0ZXN0Q2xhc3MubmFtZSArIFwiLnRlc3RGdW5jdGlvbnMoKSByZWZlcnMgdG8gbWlzc2luZyBmdW5jdGlvbnNcIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9LCB0aGlzKTtcbiAgICAgICAgdGhpcy50ZXN0Q2xhc3NNYXAuc2V0KHRlc3RDbGFzcy5uYW1lLCB0ZXN0Q2xhc3MpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICBjb250YWlucyh0ZXN0Q2xhc3MpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudGVzdENsYXNzTWFwLmNvbnRhaW5zKHRlc3RDbGFzcy5uYW1lKTtcbiAgICB9XG5cbiAgICBhc3luYyBydW5BbGwoKSB7XG4gICAgICAgIExvZ2dlci5saXN0ZW5lciA9IHRoaXMubG9nTGlzdGVuZXI7XG4gICAgICAgIGxldCBjb250ZXh0ID0gbmV3IFRlc3RFeGVjdXRpb25Db250ZXh0KHRoaXMudGVzdENsYXNzTWFwLCB0aGlzLm9iamVjdFByb3ZpZGVyLCB0aGlzLnJlc3VsdExpc3RlbmVyKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMudGVzdENsYXNzTWFwLnByb21pc2VDaGFpbihUZXN0QmVuY2gucnVuLCBjb250ZXh0KTtcbiAgICAgICAgICAgIFRlc3RCZW5jaC5jbG9zZShjb250ZXh0KTtcbiAgICAgICAgICAgIHJldHVybiBjb250ZXh0O1xuICAgICAgICB9IGNhdGNoKGVycm9yKSB7XG4gICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJ1biB0ZXN0IGJ5IGNsYXNzIG5hbWVcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdGVzdENsYXNzTmFtZSBcbiAgICAgKi9cbiAgICBhc3luYyBydW5DbGFzcyh0ZXN0Q2xhc3NOYW1lKSB7XG4gICAgICAgIExvZ2dlci5saXN0ZW5lciA9IHRoaXMubG9nTGlzdGVuZXI7XG4gICAgICAgIGxldCB0ZXN0Q2xhc3MgPSB0aGlzLnRlc3RDbGFzc01hcC5nZXQodGVzdENsYXNzTmFtZSk7XG4gICAgICAgIGxldCBjb250ZXh0ID0gbmV3IFRlc3RFeGVjdXRpb25Db250ZXh0KHRoaXMudGVzdENsYXNzTWFwLCB0aGlzLm9iamVjdFByb3ZpZGVyLCB0aGlzLnJlc3VsdExpc3RlbmVyKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IFRlc3RCZW5jaC5ydW4odGVzdENsYXNzTmFtZSwgdGVzdENsYXNzLCBjb250ZXh0KTtcbiAgICAgICAgICAgIFRlc3RCZW5jaC5jbG9zZShjb250ZXh0KTtcbiAgICAgICAgICAgIHJldHVybiBjb250ZXh0O1xuICAgICAgICB9IGNhdGNoKGVycm9yKSB7XG4gICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJ1biB0ZXN0IGJ5IGNsYXNzIG5hbWVcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdGVzdENsYXNzTmFtZSBcbiAgICAgKi9cbiAgICBhc3luYyBydW5GdW5jdGlvbih0ZXN0Q2xhc3NOYW1lLCBmdW5jdGlvbk5hbWUpIHtcbiAgICAgICAgTG9nZ2VyLmxpc3RlbmVyID0gdGhpcy5sb2dMaXN0ZW5lcjtcbiAgICAgICAgbGV0IHRlc3RDbGFzcyA9IHRoaXMudGVzdENsYXNzTWFwLmdldCh0ZXN0Q2xhc3NOYW1lKTtcbiAgICAgICAgbGV0IGNvbnRleHQgPSBuZXcgVGVzdEV4ZWN1dGlvbkNvbnRleHQodGhpcy50ZXN0Q2xhc3NNYXAsIHRoaXMub2JqZWN0UHJvdmlkZXIsIHRoaXMucmVzdWx0TGlzdGVuZXIpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgVGVzdEJlbmNoLnJ1bih0ZXN0Q2xhc3NOYW1lLCB0ZXN0Q2xhc3MsIGNvbnRleHQsIGZ1bmN0aW9uTmFtZSk7XG4gICAgICAgICAgICBUZXN0QmVuY2guY2xvc2UoY29udGV4dCk7XG4gICAgICAgICAgICByZXR1cm4gY29udGV4dDtcbiAgICAgICAgfSBjYXRjaChlcnJvcikge1xuICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gdGVzdENsYXNzTmFtZVxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSB0ZXN0Q2xhc3MgXG4gICAgICogQHBhcmFtIHtUZXN0RXhlY3V0aW9uQ29udGV4dH0gY29udGV4dCBcbiAgICAgKiBAcmV0dXJuIHtQcm9taXNlfVxuICAgICAqL1xuICAgIHN0YXRpYyBydW4odGVzdENsYXNzTmFtZSwgdGVzdENsYXNzLCBjb250ZXh0LCBmdW5jdGlvbk5hbWUgPSBudWxsKSB7XG4gICAgICAgIFRlc3RCZW5jaC5wcmludEhlYWRlcih0ZXN0Q2xhc3MubmFtZSk7XG4gICAgICAgIHJldHVybiBUZXN0QmVuY2gucnVuRnVuY3Rpb25zQnlDbGFzcyh0ZXN0Q2xhc3MsIGNvbnRleHQsIGZ1bmN0aW9uTmFtZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogXG4gICAgICogQHBhcmFtIHtMaXN0fSBmdW5jdGlvbnMgXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IGZ1bmN0aW9uTmFtZSBcbiAgICAgKi9cbiAgICBzdGF0aWMgZmlsdGVyKGZ1bmN0aW9ucywgZnVuY3Rpb25OYW1lKSB7XG4gICAgICAgIGlmICghZnVuY3Rpb25OYW1lKSB7XG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb25zO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmdW5jdGlvbnMuZmlsdGVyKCh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHZhbHVlID09PSBmdW5jdGlvbk5hbWU7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSB0ZXN0Q2xhc3MgXG4gICAgICogQHBhcmFtIHtUZXN0RXhlY3V0aW9uQ29udGV4dH0gY29udGV4dCBcbiAgICAgKi9cbiAgICBzdGF0aWMgYXN5bmMgbG9hZE9iamVjdEJ5Q2xhc3ModGVzdENsYXNzLCBjb250ZXh0KSB7XG4gICAgICAgIGlmIChjb250ZXh0LnRlc3RPYmplY3RNYXAuY29udGFpbnModGVzdENsYXNzLm5hbWUpKSB7XG4gICAgICAgICAgICByZXR1cm4gY29udGV4dDtcbiAgICAgICAgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgdGVzdE9iamVjdCA9IGF3YWl0IGNvbnRleHQub2JqZWN0UHJvdmlkZXIucHJvdmlkZSh0ZXN0Q2xhc3MpO1xuICAgICAgICAgICAgY29udGV4dC50ZXN0T2JqZWN0TWFwLnNldCh0ZXN0Q2xhc3MubmFtZSwgdGVzdE9iamVjdCk7XG4gICAgICAgICAgICByZXR1cm4gY29udGV4dDtcbiAgICAgICAgfSBjYXRjaChlcnJvcikge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGVycm9yKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSB0ZXN0Q2xhc3MgXG4gICAgICogQHBhcmFtIHtUZXN0RXhlY3V0aW9uQ29udGV4dH0gY29udGV4dCBcbiAgICAgKi9cbiAgICBzdGF0aWMgYXN5bmMgcnVuRnVuY3Rpb25zQnlDbGFzcyh0ZXN0Q2xhc3MsIGNvbnRleHQsIGZ1bmN0aW9uTmFtZSkge1xuICAgICAgICAvKiogQHR5cGUge0xpc3R9ICovXG4gICAgICAgIGNvbnN0IHRlc3RGdW5jdGlvbnMgPSB0ZXN0Q2xhc3MudGVzdEZ1bmN0aW9ucygpO1xuICAgICAgICBhd2FpdCB0ZXN0RnVuY3Rpb25zLnByb21pc2VDaGFpbigodGVzdEZ1bmN0aW9uKSA9PiB7XG4gICAgICAgICAgICBpZiAoZnVuY3Rpb25OYW1lICYmIHRlc3RGdW5jdGlvbi5uYW1lICE9PSBmdW5jdGlvbk5hbWUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gVGVzdEJlbmNoLnJ1bkZ1bmN0aW9uKHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uLCBjb250ZXh0KTtcbiAgICAgICAgfSwgY29udGV4dCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHRlc3RDbGFzcyBcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSB0ZXN0RnVuY3Rpb24gXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuY3Rpb25Db21wbGV0ZVJlc29sdmVcbiAgICAgKiBAcGFyYW0ge1Rlc3RFeGVjdXRpb25Db250ZXh0fSBjb250ZXh0IFxuICAgICAqL1xuICAgIHN0YXRpYyBhc3luYyBydW5GdW5jdGlvbih0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbiwgY29udGV4dCkge1xuICAgICAgICBUZXN0QmVuY2guY2FsbFJlc3VsdExpc3RlbmVyKGNvbnRleHQsIFRlc3RDbGFzc1N0YXRlLlJVTk5JTkcsIHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uKTtcbiAgICAgICAgYXdhaXQgVGVzdEJlbmNoLmxvYWRPYmplY3RCeUNsYXNzKHRlc3RDbGFzcywgY29udGV4dCk7XG4gICAgICAgIGNvbnN0IHRlc3RPYmplY3QgPSBjb250ZXh0LnRlc3RPYmplY3RNYXAuZ2V0KHRlc3RDbGFzcy5uYW1lKTtcblxuICAgICAgICAvKiogQHR5cGUge1Byb21pc2V9ICovXG4gICAgICAgIGxldCB0ZXN0RnVuY3Rpb25SZXN1bHQgPSBudWxsO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICB0ZXN0RnVuY3Rpb25SZXN1bHQgPSB0ZXN0RnVuY3Rpb24uY2FsbCh0ZXN0T2JqZWN0KTtcbiAgICAgICAgfSBjYXRjaCAoZXhjZXB0aW9uKSB7XG4gICAgICAgICAgICBUZXN0QmVuY2gucmVwb3J0RmFpbHVyZSh0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbiwgZXhjZXB0aW9uLCBjb250ZXh0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghKHRlc3RGdW5jdGlvblJlc3VsdCBpbnN0YW5jZW9mIFByb21pc2UpKSB7XG4gICAgICAgICAgICBUZXN0QmVuY2gucmVwb3J0U3VjY2Vzcyh0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbiwgY29udGV4dCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH07XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IHRlc3RGdW5jdGlvblJlc3VsdDtcbiAgICAgICAgICAgIFRlc3RCZW5jaC5yZXBvcnRTdWNjZXNzKHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uLCBjb250ZXh0KTtcbiAgICAgICAgfSBjYXRjaChleGNlcHRpb24pIHtcbiAgICAgICAgICAgIFRlc3RCZW5jaC5yZXBvcnRGYWlsdXJlKHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uLCBleGNlcHRpb24sIGNvbnRleHQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHRlc3RDbGFzcyBcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSB0ZXN0RnVuY3Rpb24gXG4gICAgICogQHBhcmFtIHtFcnJvcn0gZXhjZXB0aW9uIFxuICAgICAqIEBwYXJhbSB7VGVzdEV4ZWN1dGlvbkNvbnRleHR9IGNvbnRleHQgXG4gICAgICovXG4gICAgc3RhdGljIHJlcG9ydEZhaWx1cmUodGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24sIGV4Y2VwdGlvbiwgY29udGV4dCkge1xuICAgICAgICBUZXN0QmVuY2guYWRkRmFpbCh0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbiwgY29udGV4dCk7XG4gICAgICAgIFRlc3RCZW5jaC5jYWxsUmVzdWx0TGlzdGVuZXIoY29udGV4dCwgVGVzdENsYXNzU3RhdGUuRkFJTCwgdGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24pO1xuICAgICAgICBMT0cuZXJyb3IoVGVzdEJlbmNoLnNpZ25hdHVyZSh0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbikgKyBcIiBmYWlsZWQuIFJlYXNvbjpcIik7XG4gICAgICAgIExPRy5lcnJvcihleGNlcHRpb24pO1xuICAgICAgICBMT0cuZXJyb3IoXCJcIik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHRlc3RDbGFzcyBcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSB0ZXN0RnVuY3Rpb24gXG4gICAgICogQHBhcmFtIHtUZXN0RXhlY3V0aW9uQ29udGV4dH0gY29udGV4dCBcbiAgICAgKi9cbiAgICBzdGF0aWMgcmVwb3J0U3VjY2Vzcyh0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbiwgY29udGV4dCkge1xuICAgICAgICBUZXN0QmVuY2guYWRkU3VjY2Vzcyh0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbiwgY29udGV4dCk7XG4gICAgICAgIFRlc3RCZW5jaC5jYWxsUmVzdWx0TGlzdGVuZXIoY29udGV4dCwgVGVzdENsYXNzU3RhdGUuU1VDQ0VTUywgdGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSB0ZXN0Q2xhc3MgXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHN0YXRlIFxuICAgICAqIEBwYXJhbSB7VGVzdEV4ZWN1dGlvbkNvbnRleHR9IGNvbnRleHQgXG4gICAgICovXG4gICAgc3RhdGljIGNhbGxSZXN1bHRMaXN0ZW5lcihjb250ZXh0LCBzdGF0ZSwgdGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24pIHtcbiAgICAgICAgaWYgKCFjb250ZXh0LnJlc3VsdExpc3RlbmVyKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgY29udGV4dC5yZXN1bHRMaXN0ZW5lci5jYWxsKG5ldyBUZXN0Q2xhc3NTdGF0ZShzdGF0ZSwgdGVzdENsYXNzLm5hbWUsIHRlc3RGdW5jdGlvbiA/IHRlc3RGdW5jdGlvbi5uYW1lIDogbnVsbCkpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSB0ZXN0Q2xhc3MgXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gdGVzdEZ1bmN0aW9uIFxuICAgICAqIEBwYXJhbSB7VGVzdEV4ZWN1dGlvbkNvbnRleHR9IGNvbnRleHQgXG4gICAgICovXG4gICAgc3RhdGljIGFkZFN1Y2Nlc3ModGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24sIGNvbnRleHQpIHtcbiAgICAgICAgY29udGV4dC5ydW5TdWNjZXNzVGVzdExpc3QuYWRkKFRlc3RCZW5jaC5zaWduYXR1cmUodGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24pKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gdGVzdENsYXNzIFxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IHRlc3RGdW5jdGlvbiBcbiAgICAgKiBAcGFyYW0ge1Rlc3RFeGVjdXRpb25Db250ZXh0fSBjb250ZXh0IFxuICAgICAqL1xuICAgIHN0YXRpYyBhZGRGYWlsKHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uLCBjb250ZXh0KSB7XG4gICAgICAgIGNvbnRleHQucnVuRmFpbFRlc3RMaXN0LmFkZChUZXN0QmVuY2guc2lnbmF0dXJlKHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uKSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHRlc3RDbGFzcyBcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSB0ZXN0RnVuY3Rpb24gXG4gICAgICovXG4gICAgc3RhdGljIHNpZ25hdHVyZSh0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbikge1xuICAgICAgICByZXR1cm4gdGVzdENsYXNzLm5hbWUgKyBcIi5cIiArIHRlc3RGdW5jdGlvbi5uYW1lICsgXCIoKVwiO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFxuICAgICAqIEBwYXJhbSB7VGVzdEV4ZWN1dGlvbkNvbnRleHR9IGNvbnRleHQgXG4gICAgICovXG4gICAgc3RhdGljIGNsb3NlKGNvbnRleHQpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIFRlc3RCZW5jaC5wcmludFJlcG9ydChjb250ZXh0KTtcbiAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICAgIExvZ2dlci5jbGVhckxpc3RlbmVyKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gdGVzdE5hbWUgXG4gICAgICovXG4gICAgc3RhdGljIHByaW50SGVhZGVyKHRlc3ROYW1lKSB7XG4gICAgICAgIGNvbnN0IGxpbmUgPSBcIiMgIFJ1bm5pbmcgdGVzdDogXCIgKyB0ZXN0TmFtZSArIFwiICAjXCI7XG4gICAgICAgIGxldCBkZWNvcmF0aW9uID0gXCJcIjtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW5lLmxlbmd0aCA7IGkrKykge1xuICAgICAgICAgICAgZGVjb3JhdGlvbiA9IGRlY29yYXRpb24gKyBcIiNcIjtcbiAgICAgICAgfVxuICAgICAgICBMT0cuaW5mbyhkZWNvcmF0aW9uKTtcbiAgICAgICAgTE9HLmluZm8obGluZSk7XG4gICAgICAgIExPRy5pbmZvKGRlY29yYXRpb24pO1xuICAgICAgICBMT0cuaW5mbyhcIlwiKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBcbiAgICAgKiBAcGFyYW0ge1Rlc3RFeGVjdXRpb25Db250ZXh0fSBjb250ZXh0IFxuICAgICAqL1xuICAgIHN0YXRpYyBwcmludFJlcG9ydChjb250ZXh0KSB7XG4gICAgICAgIExPRy5pbmZvKFwiIyMjIyMjIyMjIyMjIyMjIyMjI1wiKTtcbiAgICAgICAgTE9HLmluZm8oXCIjICAgVGVzdCBSZXBvcnQgICAjXCIpO1xuICAgICAgICBMT0cuaW5mbyhcIiMjIyMjIyMjIyMjIyMjIyMjIyNcIik7XG4gICAgICAgIExPRy5pbmZvKFwiXCIpO1xuXG4gICAgICAgIGxldCBzdWNjZXNzQ291bnRlciA9IDA7XG4gICAgICAgIGlmIChjb250ZXh0LnJ1blN1Y2Nlc3NUZXN0TGlzdC5zaXplKCkgPiAwKXtcbiAgICAgICAgICAgIExPRy5pbmZvKFwiU3VjY2VlZGVkOlwiKTtcbiAgICAgICAgICAgIGNvbnRleHQucnVuU3VjY2Vzc1Rlc3RMaXN0LmZvckVhY2goKHZhbHVlLGNvbnRleHQpID0+IHtcbiAgICAgICAgICAgICAgICBMT0cuaW5mbyhzdWNjZXNzQ291bnRlcisrICsgXCIuIFwiICsgdmFsdWUpO1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBMT0cuaW5mbyhcIlwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBmYWlsQ291bnRlciA9IDA7XG4gICAgICAgIGlmIChjb250ZXh0LnJ1bkZhaWxUZXN0TGlzdC5zaXplKCkgPiAwKXtcbiAgICAgICAgICAgIExPRy5pbmZvKFwiRmFpbGVkOlwiKTtcbiAgICAgICAgICAgIGNvbnRleHQucnVuRmFpbFRlc3RMaXN0LmZvckVhY2goKHZhbHVlLGNvbnRleHQpID0+IHtcbiAgICAgICAgICAgICAgICBMT0cuaW5mbyhmYWlsQ291bnRlcisrICsgXCIuIFwiICsgdmFsdWUpO1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBMT0cuaW5mbyhcIlwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChmYWlsQ291bnRlciAhPSAwKSB7XG4gICAgICAgICAgICB0aHJvdyBjb250ZXh0LnJ1bkZhaWxUZXN0TGlzdC5zaXplKCkgKyBcIiBUZXN0cyBmYWlsZWRcIjtcbiAgICAgICAgfVxuICAgIH1cblxufSIsImV4cG9ydCBjbGFzcyBBc3NlcnRCb29sZWFuIHtcblxuICAgIHN0YXRpYyBhc3NlcnRUcnVlKGJvb2xlYW4gPSB0cnVlKSB7XG4gICAgICAgIGlmKGJvb2xlYW4pIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBcIkJvb2xlYW4gYXNzZXJ0aW9uIGZhaWxlZC4gRXhwZWN0ZWQgdHJ1ZSBidXQgd2FzIFwiICsgYm9vbGVhbjtcbiAgICB9XG5cbn0iLCJleHBvcnQgY2xhc3MgQXNzZXJ0U3RyaW5nIHtcblxuICAgIHN0YXRpYyBhc3NlcnRFcXVhbHMoZXhwZWN0ZWQsIGFjdHVhbCkge1xuICAgICAgICBpZiAoZXhwZWN0ZWQgPT09IGFjdHVhbCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHRocm93IFwiU3RyaW5nIEFzc2VydGlvbiBGYWlsZWQuIEV4cGVjdGVkOiAnXCIgKyBleHBlY3RlZCArIFwiJyBBY3R1YWw6ICdcIiArIGFjdHVhbCArIFwiJ1wiO1xuICAgIH1cblxufSJdLCJuYW1lcyI6WyJNYXAiLCJMaXN0IiwiTG9nZ2VyIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBTyxNQUFNLGNBQWMsQ0FBQztBQUM1QjtBQUNBLElBQUksV0FBVyxHQUFHO0FBQ2xCLEtBQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQSxJQUFJLE9BQU8sQ0FBQyxRQUFRLEVBQUUsSUFBSSxHQUFHLEVBQUUsRUFBRTtBQUNqQyxRQUFRLE9BQU8s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
