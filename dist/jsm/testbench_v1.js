import { Logger, Map, List } from './coreutil_v1.js'

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

class TestClassResult {

    static get SUCCESS() { return 1; }
    static get FAIL() { return 0; }

    /**
     * 
     * @param {String} className 
     * @param {String} result 
     */
    constructor(className, result) {

        /** @type {String} */
        this.className = className;
        
        /** @type {String} */
        this.result = result;
    }
}

class TestTrigger {

        /**
     * Run test by class name
     * @param {string} className 
     */
    runSingle(className) {

    }

    /**
     * Run all test classes
     */
    run() {
        
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

        /** @type {ObjectFunction} */
        this.resultListener = resultListener;

        /** @type {Map} */
        this.testClassMap = new Map();

        /** @type {Map} */
        this.testObjectMap = new Map();

        /** @type {ObjectProvider} */
        this.objectProvider = objectProvider;

        /** @type {List} */
        this.runSuccessTestList = new List();

        /** @type {List} */
        this.runFailTestList = new List();
        
        /** @type {List} */
        this.runTestFunctionList = new List();

        /** @type {List} */
        this.runTestClassList = new List();

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

    run() {
        Logger.listener = this.logListener;
        let parent = this;
        return this.testClassMap.promiseChain(this.runClass, this).then(() => {
            this.close(parent);
        });
    }

    /**
     * Run test by class name
     * @param {string} className 
     */
    runSingle(className) {
        Logger.listener = this.logListener;
        let testClass = this.testClassMap.get(className);
        let parent = this;
        return this.runClass(className, testClass, this).then(() => {
            this.close(parent);
        });
    }

    runClass(className, testClass, parent) {
        return new Promise((resolve, reject) => {
            parent.runTestClassList.add(testClass);
            parent.runTestFunctionList.addAll(testClass.testFunctions());
            parent.printHeader(className);
            parent.loadObjectByClassName(className, parent).then(() => {
                parent.runFunctionsByClassName(className, parent).then(() => {
                    resolve();
                });
            });
        });
    }

    loadObjectByClassName(className, parent) {
        return new Promise((resolve, reject) => {
            const testClass = parent.testClassMap.get(className);
            parent.objectProvider.provide(testClass).then((testObject) => {
                parent.testObjectMap.set(className, testObject);
                setTimeout(() => {
                    resolve();
                },100);
            });
        });
    }

    /**
     * 
     * @param {String} className 
     * @param {Object} parent 
     */
    runFunctionsByClassName(className, parent) {
        const testClass = parent.testClassMap.get(className);
        /** @type {List} */
        const testFunctions = testClass.testFunctions();
        return testFunctions.promiseChain((testFunction) => {
            return new Promise((functionCompleteResolve, reject) => {
                parent.runFunction(testClass, testFunction, functionCompleteResolve, parent);
            });
        }, parent);
    }

    /**
     * 
     * @param {Array} functionArray 
     * @param {Number} index 
     * @param {Function} functionCompleteResolve
     */
    runFunction(testClass, testFunction, functionCompleteResolve, parent) {
        
        const testObject = parent.testObjectMap.get(testClass.name);

        /** @type {Promise} */
        let testFunctionResult = null;

        try {
            testFunctionResult = testFunction.call(testObject);
            if (!(testFunctionResult instanceof Promise)) {
                parent.reportSuccess(testClass, testFunction, parent);
            };
        } catch (exception) {
            parent.reportFailure(testClass, testFunction, exception, parent);
        }

        if (!(testFunctionResult instanceof Promise)) {
            functionCompleteResolve();
            return;
        }

        testFunctionResult.then(() => {
            parent.reportSuccess(testClass, testFunction, parent);
            functionCompleteResolve();
        }).catch((exception) => {
            parent.reportFailure(testClass, testFunction, exception, parent);
            functionCompleteResolve();
        });
    }

    reportFailure(testClass, testFunction, exception, parent) {
        parent.addFail(testClass, testFunction, parent);
        parent.callResultListener(testClass, true, parent);
        LOG.error(this.signature(testClass, testFunction) + " failed. Reason:");
        LOG.error(exception);
        LOG.error("");
    }

    reportSuccess(testClass, testFunction, parent) {
        parent.addSuccess(testClass, testFunction, parent);
        parent.callResultListener(testClass, false, parent);
    }

    callResultListener(testClass, failed, parent) {
        if (!parent.resultListener) {
            return;
        }
        const result = failed ? TestClassResult.FAIL : TestClassResult.SUCCESS;
        parent.resultListener.call(new TestClassResult(testClass.name, result));
    }

    addSuccess(testClass, testFunction, parent) {
        parent.runSuccessTestList.add(parent.signature(testClass, testFunction));
    }

    addFail(testClass, testFunction, parent) {
        parent.runFailTestList.add(parent.signature(testClass, testFunction));
    }

    signature(testClass, testFunction) {
        return testClass.name + "." + testFunction.name + "()";
    }

    close(parent) {
        try {
            parent.printReport(parent);
        } finally {
            parent.reset(parent);
            Logger.clearListener();
        }
    }

    printHeader(testName) {
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

    printReport(parent) {
        LOG.info("###################");
        LOG.info("#   Test Report   #");
        LOG.info("###################");
        LOG.info("");

        let successCounter = 0;
        if (parent.runSuccessTestList.size() > 0){
            LOG.info("Succeeded:");
            parent.runSuccessTestList.forEach((value,parent) => {
                LOG.info(successCounter++ + ". " + value);
                return true;
            });
            LOG.info("");
        }

        let failCounter = 0;
        if (parent.runFailTestList.size() > 0){
            LOG.info("Failed:");
            parent.runFailTestList.forEach((value,parent) => {
                LOG.info(failCounter++ + ". " + value);
                return true;
            });
            LOG.info("");
        }

        if (failCounter != 0) {
            throw parent.runFailTestList.size() + " Tests failed";
        }
    }

    reset(parent) {
        parent.runFailTestList = new List();
        parent.runSuccessTestList = new List();

        parent.runTestFunctionList = new List();
        parent.runTestClassList = new List();
    }
}

const LOG$1 = new Logger("TestBench");

export { AssertBoolean, AssertString, ObjectProvider, TestBench, TestClassResult, TestTrigger };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdGJlbmNoX3YxLmpzIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdGVzdGJlbmNoL2Fzc2VydGlvbnMvYXNzZXJ0Qm9vbGVhbi5qcyIsIi4uLy4uL3NyYy90ZXN0YmVuY2gvYXNzZXJ0aW9ucy9hc3NlcnRTdHJpbmcuanMiLCIuLi8uLi9zcmMvdGVzdGJlbmNoL29iamVjdFByb3ZpZGVyLmpzIiwiLi4vLi4vc3JjL3Rlc3RiZW5jaC90ZXN0Q2xhc3NSZXN1bHQuanMiLCIuLi8uLi9zcmMvdGVzdGJlbmNoL3Rlc3RUcmlnZ2VyLmpzIiwiLi4vLi4vc3JjL3Rlc3RiZW5jaC90ZXN0QmVuY2guanMiLCIuLi8uLi9zcmMvdGVzdGJlbmNoL3Rlc3RCZW5jaDIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGNsYXNzIEFzc2VydEJvb2xlYW4ge1xyXG5cclxuICAgIHN0YXRpYyBhc3NlcnRUcnVlKGJvb2xlYW4gPSB0cnVlKSB7XHJcbiAgICAgICAgaWYoYm9vbGVhbikge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRocm93IFwiQm9vbGVhbiBhc3NlcnRpb24gZmFpbGVkLiBFeHBlY3RlZCB0cnVlIGJ1dCB3YXMgXCIgKyBib29sZWFuO1xyXG4gICAgfVxyXG5cclxufSIsImV4cG9ydCBjbGFzcyBBc3NlcnRTdHJpbmcge1xyXG5cclxuICAgIHN0YXRpYyBhc3NlcnRFcXVhbHMoZXhwZWN0ZWQsIGFjdHVhbCkge1xyXG4gICAgICAgIGlmIChleHBlY3RlZCA9PT0gYWN0dWFsKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhyb3cgXCJTdHJpbmcgQXNzZXJ0aW9uIEZhaWxlZC4gRXhwZWN0ZWQ6ICdcIiArIGV4cGVjdGVkICsgXCInIEFjdHVhbDogJ1wiICsgYWN0dWFsICsgXCInXCI7XHJcbiAgICB9XHJcblxyXG59IiwiZXhwb3J0IGNsYXNzIE9iamVjdFByb3ZpZGVyIHtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcigpIHtcclxuXHJcbiAgICB9XHJcblxyXG4gICAgcHJvdmlkZSh0aGVDbGFzcywgYXJncyA9IFtdKSB7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgICAgICAgcmVzb2x2ZShuZXcgdGhlQ2xhc3MoLi4uYXJncykpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxufSIsImV4cG9ydCBjbGFzcyBUZXN0Q2xhc3NSZXN1bHQge1xyXG5cclxuICAgIHN0YXRpYyBnZXQgU1VDQ0VTUygpIHsgcmV0dXJuIDE7IH1cclxuICAgIHN0YXRpYyBnZXQgRkFJTCgpIHsgcmV0dXJuIDA7IH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFxyXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IGNsYXNzTmFtZSBcclxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSByZXN1bHQgXHJcbiAgICAgKi9cclxuICAgIGNvbnN0cnVjdG9yKGNsYXNzTmFtZSwgcmVzdWx0KSB7XHJcblxyXG4gICAgICAgIC8qKiBAdHlwZSB7U3RyaW5nfSAqL1xyXG4gICAgICAgIHRoaXMuY2xhc3NOYW1lID0gY2xhc3NOYW1lO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8qKiBAdHlwZSB7U3RyaW5nfSAqL1xyXG4gICAgICAgIHRoaXMucmVzdWx0ID0gcmVzdWx0O1xyXG4gICAgfVxyXG59IiwiZXhwb3J0IGNsYXNzIFRlc3RUcmlnZ2VyIHtcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgKiBSdW4gdGVzdCBieSBjbGFzcyBuYW1lXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY2xhc3NOYW1lIFxyXG4gICAgICovXHJcbiAgICBydW5TaW5nbGUoY2xhc3NOYW1lKSB7XHJcblxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUnVuIGFsbCB0ZXN0IGNsYXNzZXNcclxuICAgICAqL1xyXG4gICAgcnVuKCkge1xyXG4gICAgICAgIFxyXG4gICAgfVxyXG59IiwiaW1wb3J0IHsgTGlzdCwgTG9nZ2VyLCBNYXAsIE9iamVjdEZ1bmN0aW9uIH0gZnJvbSBcImNvcmV1dGlsX3YxXCI7XHJcbmltcG9ydCB7IE9iamVjdFByb3ZpZGVyIH0gZnJvbSBcIi4vb2JqZWN0UHJvdmlkZXIuanNcIjtcclxuaW1wb3J0IHsgVGVzdENsYXNzUmVzdWx0IH0gZnJvbSBcIi4vdGVzdENsYXNzUmVzdWx0LmpzXCI7XHJcbmltcG9ydCB7IFRlc3RUcmlnZ2VyIH0gZnJvbSBcIi4vdGVzdFRyaWdnZXIuanNcIjtcclxuXHJcbmNvbnN0IExPRyA9IG5ldyBMb2dnZXIoXCJUZXN0QmVuY2hcIik7XHJcblxyXG5leHBvcnQgY2xhc3MgVGVzdEJlbmNoIGV4dGVuZHMgVGVzdFRyaWdnZXIge1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdEZ1bmN0aW9ufSBsb2dMaXN0ZW5lciBcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0RnVuY3Rpb259IHJlc3VsdExpc3RlbmVyIFxyXG4gICAgICogQHBhcmFtIHtPYmplY3RQcm92aWRlcn0gb2JqZWN0UHJvdmlkZXJcclxuICAgICAqL1xyXG4gICAgY29uc3RydWN0b3IobG9nTGlzdGVuZXIgPSBudWxsLFxyXG4gICAgICAgICAgICByZXN1bHRMaXN0ZW5lciA9IG51bGwsIFxyXG4gICAgICAgICAgICBvYmplY3RQcm92aWRlciA9IG5ldyBPYmplY3RQcm92aWRlcigpKSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgc3VwZXIoKTtcclxuXHJcbiAgICAgICAgLyoqIEB0eXBlIHtPYmplY3RGdW5jdGlvbn0gKi9cclxuICAgICAgICB0aGlzLmxvZ0xpc3RlbmVyID0gbG9nTGlzdGVuZXI7XHJcblxyXG4gICAgICAgIC8qKiBAdHlwZSB7T2JqZWN0RnVuY3Rpb259ICovXHJcbiAgICAgICAgdGhpcy5yZXN1bHRMaXN0ZW5lciA9IHJlc3VsdExpc3RlbmVyO1xyXG5cclxuICAgICAgICAvKiogQHR5cGUge01hcH0gKi9cclxuICAgICAgICB0aGlzLnRlc3RDbGFzc01hcCA9IG5ldyBNYXAoKTtcclxuXHJcbiAgICAgICAgLyoqIEB0eXBlIHtNYXB9ICovXHJcbiAgICAgICAgdGhpcy50ZXN0T2JqZWN0TWFwID0gbmV3IE1hcCgpO1xyXG5cclxuICAgICAgICAvKiogQHR5cGUge09iamVjdFByb3ZpZGVyfSAqL1xyXG4gICAgICAgIHRoaXMub2JqZWN0UHJvdmlkZXIgPSBvYmplY3RQcm92aWRlcjtcclxuXHJcbiAgICAgICAgLyoqIEB0eXBlIHtMaXN0fSAqL1xyXG4gICAgICAgIHRoaXMucnVuU3VjY2Vzc1Rlc3RMaXN0ID0gbmV3IExpc3QoKTtcclxuXHJcbiAgICAgICAgLyoqIEB0eXBlIHtMaXN0fSAqL1xyXG4gICAgICAgIHRoaXMucnVuRmFpbFRlc3RMaXN0ID0gbmV3IExpc3QoKTtcclxuICAgICAgICBcclxuICAgICAgICAvKiogQHR5cGUge0xpc3R9ICovXHJcbiAgICAgICAgdGhpcy5ydW5UZXN0RnVuY3Rpb25MaXN0ID0gbmV3IExpc3QoKTtcclxuXHJcbiAgICAgICAgLyoqIEB0eXBlIHtMaXN0fSAqL1xyXG4gICAgICAgIHRoaXMucnVuVGVzdENsYXNzTGlzdCA9IG5ldyBMaXN0KCk7XHJcblxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gdGVzdE9iamVjdCBcclxuICAgICAqIEByZXR1cm5zIHtUZXN0QmVuY2h9XHJcbiAgICAgKi9cclxuICAgIGFkZFRlc3QodGVzdENsYXNzKSB7XHJcbiAgICAgICAgaWYgKCF0ZXN0Q2xhc3MudGVzdEZ1bmN0aW9ucyB8fCAhKHRlc3RDbGFzcy50ZXN0RnVuY3Rpb25zKCkgaW5zdGFuY2VvZiBMaXN0KSkge1xyXG4gICAgICAgICAgICB0aHJvdyBcIkEgc3RhdGljIGZ1bmN0aW9uIGNhbGxlZCAndGVzdEZ1bmN0aW9ucycgbXVzdCBiZSBwcm92aWRlZCBpbiBcIiBcclxuICAgICAgICAgICAgICAgICsgdGVzdENsYXNzLm5hbWUgXHJcbiAgICAgICAgICAgICAgICArIFwiIHdoaWNoIHJldHVybnMgYSBMaXN0IGFsbCB0aGUgdGVzdCBmdW5jdGlvbnMgaW4gXCJcclxuICAgICAgICAgICAgICAgICsgdGVzdENsYXNzLm5hbWUgKyBcIi5wcm90b3R5cGVcIlxyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLnRlc3RDbGFzc01hcC5zZXQodGVzdENsYXNzLm5hbWUsIHRlc3RDbGFzcyk7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcblxyXG4gICAgY29udGFpbnModGVzdENsYXNzKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMudGVzdENsYXNzTWFwLmNvbnRhaW5zKHRlc3RDbGFzcy5uYW1lKTtcclxuICAgIH1cclxuXHJcbiAgICBydW4oKSB7XHJcbiAgICAgICAgTG9nZ2VyLmxpc3RlbmVyID0gdGhpcy5sb2dMaXN0ZW5lcjtcclxuICAgICAgICBsZXQgcGFyZW50ID0gdGhpcztcclxuICAgICAgICByZXR1cm4gdGhpcy50ZXN0Q2xhc3NNYXAucHJvbWlzZUNoYWluKHRoaXMucnVuQ2xhc3MsIHRoaXMpLnRoZW4oKCkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLmNsb3NlKHBhcmVudCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSdW4gdGVzdCBieSBjbGFzcyBuYW1lXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY2xhc3NOYW1lIFxyXG4gICAgICovXHJcbiAgICBydW5TaW5nbGUoY2xhc3NOYW1lKSB7XHJcbiAgICAgICAgTG9nZ2VyLmxpc3RlbmVyID0gdGhpcy5sb2dMaXN0ZW5lcjtcclxuICAgICAgICBsZXQgdGVzdENsYXNzID0gdGhpcy50ZXN0Q2xhc3NNYXAuZ2V0KGNsYXNzTmFtZSk7XHJcbiAgICAgICAgbGV0IHBhcmVudCA9IHRoaXM7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMucnVuQ2xhc3MoY2xhc3NOYW1lLCB0ZXN0Q2xhc3MsIHRoaXMpLnRoZW4oKCkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLmNsb3NlKHBhcmVudCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgcnVuQ2xhc3MoY2xhc3NOYW1lLCB0ZXN0Q2xhc3MsIHBhcmVudCkge1xyXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgICAgICAgIHBhcmVudC5ydW5UZXN0Q2xhc3NMaXN0LmFkZCh0ZXN0Q2xhc3MpO1xyXG4gICAgICAgICAgICBwYXJlbnQucnVuVGVzdEZ1bmN0aW9uTGlzdC5hZGRBbGwodGVzdENsYXNzLnRlc3RGdW5jdGlvbnMoKSk7XHJcbiAgICAgICAgICAgIHBhcmVudC5wcmludEhlYWRlcihjbGFzc05hbWUpO1xyXG4gICAgICAgICAgICBwYXJlbnQubG9hZE9iamVjdEJ5Q2xhc3NOYW1lKGNsYXNzTmFtZSwgcGFyZW50KS50aGVuKCgpID0+IHtcclxuICAgICAgICAgICAgICAgIHBhcmVudC5ydW5GdW5jdGlvbnNCeUNsYXNzTmFtZShjbGFzc05hbWUsIHBhcmVudCkudGhlbigoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGxvYWRPYmplY3RCeUNsYXNzTmFtZShjbGFzc05hbWUsIHBhcmVudCkge1xyXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IHRlc3RDbGFzcyA9IHBhcmVudC50ZXN0Q2xhc3NNYXAuZ2V0KGNsYXNzTmFtZSk7XHJcbiAgICAgICAgICAgIHBhcmVudC5vYmplY3RQcm92aWRlci5wcm92aWRlKHRlc3RDbGFzcykudGhlbigodGVzdE9iamVjdCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgcGFyZW50LnRlc3RPYmplY3RNYXAuc2V0KGNsYXNzTmFtZSwgdGVzdE9iamVjdCk7XHJcbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKCk7XHJcbiAgICAgICAgICAgICAgICB9LDEwMCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogXHJcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gY2xhc3NOYW1lIFxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHBhcmVudCBcclxuICAgICAqL1xyXG4gICAgcnVuRnVuY3Rpb25zQnlDbGFzc05hbWUoY2xhc3NOYW1lLCBwYXJlbnQpIHtcclxuICAgICAgICBjb25zdCB0ZXN0Q2xhc3MgPSBwYXJlbnQudGVzdENsYXNzTWFwLmdldChjbGFzc05hbWUpO1xyXG4gICAgICAgIC8qKiBAdHlwZSB7TGlzdH0gKi9cclxuICAgICAgICBjb25zdCB0ZXN0RnVuY3Rpb25zID0gdGVzdENsYXNzLnRlc3RGdW5jdGlvbnMoKTtcclxuICAgICAgICByZXR1cm4gdGVzdEZ1bmN0aW9ucy5wcm9taXNlQ2hhaW4oKHRlc3RGdW5jdGlvbikgPT4ge1xyXG4gICAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKGZ1bmN0aW9uQ29tcGxldGVSZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgICAgICAgICAgIHBhcmVudC5ydW5GdW5jdGlvbih0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbiwgZnVuY3Rpb25Db21wbGV0ZVJlc29sdmUsIHBhcmVudCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0sIHBhcmVudCk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBcclxuICAgICAqIEBwYXJhbSB7QXJyYXl9IGZ1bmN0aW9uQXJyYXkgXHJcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gaW5kZXggXHJcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jdGlvbkNvbXBsZXRlUmVzb2x2ZVxyXG4gICAgICovXHJcbiAgICBydW5GdW5jdGlvbih0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbiwgZnVuY3Rpb25Db21wbGV0ZVJlc29sdmUsIHBhcmVudCkge1xyXG4gICAgICAgIFxyXG4gICAgICAgIGNvbnN0IHRlc3RPYmplY3QgPSBwYXJlbnQudGVzdE9iamVjdE1hcC5nZXQodGVzdENsYXNzLm5hbWUpO1xyXG5cclxuICAgICAgICAvKiogQHR5cGUge1Byb21pc2V9ICovXHJcbiAgICAgICAgbGV0IHRlc3RGdW5jdGlvblJlc3VsdCA9IG51bGw7XHJcblxyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIHRlc3RGdW5jdGlvblJlc3VsdCA9IHRlc3RGdW5jdGlvbi5jYWxsKHRlc3RPYmplY3QpO1xyXG4gICAgICAgICAgICBpZiAoISh0ZXN0RnVuY3Rpb25SZXN1bHQgaW5zdGFuY2VvZiBQcm9taXNlKSkge1xyXG4gICAgICAgICAgICAgICAgcGFyZW50LnJlcG9ydFN1Y2Nlc3ModGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24sIHBhcmVudCk7XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSBjYXRjaCAoZXhjZXB0aW9uKSB7XHJcbiAgICAgICAgICAgIHBhcmVudC5yZXBvcnRGYWlsdXJlKHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uLCBleGNlcHRpb24sIHBhcmVudCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoISh0ZXN0RnVuY3Rpb25SZXN1bHQgaW5zdGFuY2VvZiBQcm9taXNlKSkge1xyXG4gICAgICAgICAgICBmdW5jdGlvbkNvbXBsZXRlUmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0ZXN0RnVuY3Rpb25SZXN1bHQudGhlbigoKSA9PiB7XHJcbiAgICAgICAgICAgIHBhcmVudC5yZXBvcnRTdWNjZXNzKHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uLCBwYXJlbnQpO1xyXG4gICAgICAgICAgICBmdW5jdGlvbkNvbXBsZXRlUmVzb2x2ZSgpO1xyXG4gICAgICAgIH0pLmNhdGNoKChleGNlcHRpb24pID0+IHtcclxuICAgICAgICAgICAgcGFyZW50LnJlcG9ydEZhaWx1cmUodGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24sIGV4Y2VwdGlvbiwgcGFyZW50KTtcclxuICAgICAgICAgICAgZnVuY3Rpb25Db21wbGV0ZVJlc29sdmUoKTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICByZXBvcnRGYWlsdXJlKHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uLCBleGNlcHRpb24sIHBhcmVudCkge1xyXG4gICAgICAgIHBhcmVudC5hZGRGYWlsKHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uLCBwYXJlbnQpO1xyXG4gICAgICAgIHBhcmVudC5jYWxsUmVzdWx0TGlzdGVuZXIodGVzdENsYXNzLCB0cnVlLCBwYXJlbnQpO1xyXG4gICAgICAgIExPRy5lcnJvcih0aGlzLnNpZ25hdHVyZSh0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbikgKyBcIiBmYWlsZWQuIFJlYXNvbjpcIik7XHJcbiAgICAgICAgTE9HLmVycm9yKGV4Y2VwdGlvbik7XHJcbiAgICAgICAgTE9HLmVycm9yKFwiXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIHJlcG9ydFN1Y2Nlc3ModGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24sIHBhcmVudCkge1xyXG4gICAgICAgIHBhcmVudC5hZGRTdWNjZXNzKHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uLCBwYXJlbnQpO1xyXG4gICAgICAgIHBhcmVudC5jYWxsUmVzdWx0TGlzdGVuZXIodGVzdENsYXNzLCBmYWxzZSwgcGFyZW50KTtcclxuICAgIH1cclxuXHJcbiAgICBjYWxsUmVzdWx0TGlzdGVuZXIodGVzdENsYXNzLCBmYWlsZWQsIHBhcmVudCkge1xyXG4gICAgICAgIGlmICghcGFyZW50LnJlc3VsdExpc3RlbmVyKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gZmFpbGVkID8gVGVzdENsYXNzUmVzdWx0LkZBSUwgOiBUZXN0Q2xhc3NSZXN1bHQuU1VDQ0VTUztcclxuICAgICAgICBwYXJlbnQucmVzdWx0TGlzdGVuZXIuY2FsbChuZXcgVGVzdENsYXNzUmVzdWx0KHRlc3RDbGFzcy5uYW1lLCByZXN1bHQpKTtcclxuICAgIH1cclxuXHJcbiAgICBhZGRTdWNjZXNzKHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uLCBwYXJlbnQpIHtcclxuICAgICAgICBwYXJlbnQucnVuU3VjY2Vzc1Rlc3RMaXN0LmFkZChwYXJlbnQuc2lnbmF0dXJlKHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uKSk7XHJcbiAgICB9XHJcblxyXG4gICAgYWRkRmFpbCh0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbiwgcGFyZW50KSB7XHJcbiAgICAgICAgcGFyZW50LnJ1bkZhaWxUZXN0TGlzdC5hZGQocGFyZW50LnNpZ25hdHVyZSh0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbikpO1xyXG4gICAgfVxyXG5cclxuICAgIHNpZ25hdHVyZSh0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbikge1xyXG4gICAgICAgIHJldHVybiB0ZXN0Q2xhc3MubmFtZSArIFwiLlwiICsgdGVzdEZ1bmN0aW9uLm5hbWUgKyBcIigpXCI7XHJcbiAgICB9XHJcblxyXG4gICAgY2xvc2UocGFyZW50KSB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgcGFyZW50LnByaW50UmVwb3J0KHBhcmVudCk7XHJcbiAgICAgICAgfSBmaW5hbGx5IHtcclxuICAgICAgICAgICAgcGFyZW50LnJlc2V0KHBhcmVudCk7XHJcbiAgICAgICAgICAgIExvZ2dlci5jbGVhckxpc3RlbmVyKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaW50SGVhZGVyKHRlc3ROYW1lKSB7XHJcbiAgICAgICAgY29uc3QgbGluZSA9IFwiIyAgUnVubmluZyB0ZXN0OiBcIiArIHRlc3ROYW1lICsgXCIgICNcIjtcclxuICAgICAgICBsZXQgZGVjb3JhdGlvbiA9IFwiXCI7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW5lLmxlbmd0aCA7IGkrKykge1xyXG4gICAgICAgICAgICBkZWNvcmF0aW9uID0gZGVjb3JhdGlvbiArIFwiI1wiO1xyXG4gICAgICAgIH1cclxuICAgICAgICBMT0cuaW5mbyhkZWNvcmF0aW9uKTtcclxuICAgICAgICBMT0cuaW5mbyhsaW5lKTtcclxuICAgICAgICBMT0cuaW5mbyhkZWNvcmF0aW9uKTtcclxuICAgICAgICBMT0cuaW5mbyhcIlwiKTtcclxuICAgIH1cclxuXHJcbiAgICBwcmludFJlcG9ydChwYXJlbnQpIHtcclxuICAgICAgICBMT0cuaW5mbyhcIiMjIyMjIyMjIyMjIyMjIyMjIyNcIik7XHJcbiAgICAgICAgTE9HLmluZm8oXCIjICAgVGVzdCBSZXBvcnQgICAjXCIpO1xyXG4gICAgICAgIExPRy5pbmZvKFwiIyMjIyMjIyMjIyMjIyMjIyMjI1wiKTtcclxuICAgICAgICBMT0cuaW5mbyhcIlwiKTtcclxuXHJcbiAgICAgICAgbGV0IHN1Y2Nlc3NDb3VudGVyID0gMDtcclxuICAgICAgICBpZiAocGFyZW50LnJ1blN1Y2Nlc3NUZXN0TGlzdC5zaXplKCkgPiAwKXtcclxuICAgICAgICAgICAgTE9HLmluZm8oXCJTdWNjZWVkZWQ6XCIpO1xyXG4gICAgICAgICAgICBwYXJlbnQucnVuU3VjY2Vzc1Rlc3RMaXN0LmZvckVhY2goKHZhbHVlLHBhcmVudCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgTE9HLmluZm8oc3VjY2Vzc0NvdW50ZXIrKyArIFwiLiBcIiArIHZhbHVlKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgTE9HLmluZm8oXCJcIik7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgZmFpbENvdW50ZXIgPSAwO1xyXG4gICAgICAgIGlmIChwYXJlbnQucnVuRmFpbFRlc3RMaXN0LnNpemUoKSA+IDApe1xyXG4gICAgICAgICAgICBMT0cuaW5mbyhcIkZhaWxlZDpcIik7XHJcbiAgICAgICAgICAgIHBhcmVudC5ydW5GYWlsVGVzdExpc3QuZm9yRWFjaCgodmFsdWUscGFyZW50KSA9PiB7XHJcbiAgICAgICAgICAgICAgICBMT0cuaW5mbyhmYWlsQ291bnRlcisrICsgXCIuIFwiICsgdmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBMT0cuaW5mbyhcIlwiKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChmYWlsQ291bnRlciAhPSAwKSB7XHJcbiAgICAgICAgICAgIHRocm93IHBhcmVudC5ydW5GYWlsVGVzdExpc3Quc2l6ZSgpICsgXCIgVGVzdHMgZmFpbGVkXCI7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHJlc2V0KHBhcmVudCkge1xyXG4gICAgICAgIHBhcmVudC5ydW5GYWlsVGVzdExpc3QgPSBuZXcgTGlzdCgpO1xyXG4gICAgICAgIHBhcmVudC5ydW5TdWNjZXNzVGVzdExpc3QgPSBuZXcgTGlzdCgpO1xyXG5cclxuICAgICAgICBwYXJlbnQucnVuVGVzdEZ1bmN0aW9uTGlzdCA9IG5ldyBMaXN0KCk7XHJcbiAgICAgICAgcGFyZW50LnJ1blRlc3RDbGFzc0xpc3QgPSBuZXcgTGlzdCgpO1xyXG4gICAgfVxyXG59IiwiaW1wb3J0IHsgTGlzdCwgTG9nZ2VyLCBNYXAsIE9iamVjdEZ1bmN0aW9uIH0gZnJvbSBcImNvcmV1dGlsX3YxXCI7XHJcbmltcG9ydCB7IE9iamVjdFByb3ZpZGVyIH0gZnJvbSBcIi4vb2JqZWN0UHJvdmlkZXIuanNcIjtcclxuaW1wb3J0IHsgVGVzdENsYXNzUmVzdWx0IH0gZnJvbSBcIi4vdGVzdENsYXNzUmVzdWx0LmpzXCI7XHJcbmltcG9ydCB7IFRlc3RUcmlnZ2VyIH0gZnJvbSBcIi4vdGVzdFRyaWdnZXIuanNcIjtcclxuXHJcbmNvbnN0IExPRyA9IG5ldyBMb2dnZXIoXCJUZXN0QmVuY2hcIik7XHJcblxyXG5leHBvcnQgY2xhc3MgVGVzdEJlbmNoIGV4dGVuZHMgVGVzdFRyaWdnZXIge1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdEZ1bmN0aW9ufSBsb2dMaXN0ZW5lciBcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0RnVuY3Rpb259IHJlc3VsdExpc3RlbmVyIFxyXG4gICAgICogQHBhcmFtIHtPYmplY3RQcm92aWRlcn0gb2JqZWN0UHJvdmlkZXJcclxuICAgICAqL1xyXG4gICAgY29uc3RydWN0b3IobG9nTGlzdGVuZXIgPSBudWxsLFxyXG4gICAgICAgICAgICByZXN1bHRMaXN0ZW5lciA9IG51bGwsIFxyXG4gICAgICAgICAgICBvYmplY3RQcm92aWRlciA9IG5ldyBPYmplY3RQcm92aWRlcigpKSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgc3VwZXIoKTtcclxuXHJcbiAgICAgICAgLyoqIEB0eXBlIHtPYmplY3RGdW5jdGlvbn0gKi9cclxuICAgICAgICB0aGlzLmxvZ0xpc3RlbmVyID0gbG9nTGlzdGVuZXI7XHJcblxyXG4gICAgICAgIC8qKiBAdHlwZSB7T2JqZWN0RnVuY3Rpb259ICovXHJcbiAgICAgICAgdGhpcy5yZXN1bHRMaXN0ZW5lciA9IHJlc3VsdExpc3RlbmVyO1xyXG5cclxuICAgICAgICAvKiogQHR5cGUge01hcH0gKi9cclxuICAgICAgICB0aGlzLnRlc3RDbGFzc01hcCA9IG5ldyBNYXAoKTtcclxuXHJcbiAgICAgICAgLyoqIEB0eXBlIHtNYXB9ICovXHJcbiAgICAgICAgdGhpcy50ZXN0T2JqZWN0TWFwID0gbmV3IE1hcCgpO1xyXG5cclxuICAgICAgICAvKiogQHR5cGUge09iamVjdFByb3ZpZGVyfSAqL1xyXG4gICAgICAgIHRoaXMub2JqZWN0UHJvdmlkZXIgPSBvYmplY3RQcm92aWRlcjtcclxuXHJcbiAgICAgICAgLyoqIEB0eXBlIHtMaXN0fSAqL1xyXG4gICAgICAgIHRoaXMucnVuU3VjY2Vzc1Rlc3RMaXN0ID0gbmV3IExpc3QoKTtcclxuXHJcbiAgICAgICAgLyoqIEB0eXBlIHtMaXN0fSAqL1xyXG4gICAgICAgIHRoaXMucnVuRmFpbFRlc3RMaXN0ID0gbmV3IExpc3QoKTtcclxuICAgICAgICBcclxuICAgICAgICAvKiogQHR5cGUge0xpc3R9ICovXHJcbiAgICAgICAgdGhpcy5ydW5UZXN0RnVuY3Rpb25MaXN0ID0gbmV3IExpc3QoKTtcclxuXHJcbiAgICAgICAgLyoqIEB0eXBlIHtMaXN0fSAqL1xyXG4gICAgICAgIHRoaXMucnVuVGVzdENsYXNzTGlzdCA9IG5ldyBMaXN0KCk7XHJcblxyXG4gICAgICAgIC8qKiBAdHlwZSB7TnVtYmVyfSAqL1xyXG4gICAgICAgIHRoaXMucnVuVGVzdEZ1bmN0aW9uQ291bnQgPSAwO1xyXG5cclxuICAgICAgICAvKiogQHR5cGUge051bWJlcn0gKi9cclxuICAgICAgICB0aGlzLnJ1blRlc3RDbGFzc0NvdW50ID0gMDtcclxuXHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSB0ZXN0T2JqZWN0IFxyXG4gICAgICogQHJldHVybnMge1Rlc3RCZW5jaH1cclxuICAgICAqL1xyXG4gICAgYWRkVGVzdCh0ZXN0Q2xhc3MpIHtcclxuICAgICAgICBpZiAoIXRlc3RDbGFzcy50ZXN0RnVuY3Rpb25zIHx8ICEodGVzdENsYXNzLnRlc3RGdW5jdGlvbnMoKSBpbnN0YW5jZW9mIExpc3QpKSB7XHJcbiAgICAgICAgICAgIHRocm93IFwiQSBzdGF0aWMgZnVuY3Rpb24gY2FsbGVkICd0ZXN0RnVuY3Rpb25zJyBtdXN0IGJlIHByb3ZpZGVkIGluIFwiIFxyXG4gICAgICAgICAgICAgICAgKyB0ZXN0Q2xhc3MubmFtZSBcclxuICAgICAgICAgICAgICAgICsgXCIgd2hpY2ggcmV0dXJucyBhIExpc3QgYWxsIHRoZSB0ZXN0IGZ1bmN0aW9ucyBpbiBcIlxyXG4gICAgICAgICAgICAgICAgKyB0ZXN0Q2xhc3MubmFtZSArIFwiLnByb3RvdHlwZVwiXHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMudGVzdENsYXNzTWFwLnNldCh0ZXN0Q2xhc3MubmFtZSwgdGVzdENsYXNzKTtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxuXHJcbiAgICBjb250YWlucyh0ZXN0Q2xhc3MpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy50ZXN0Q2xhc3NNYXAuY29udGFpbnModGVzdENsYXNzLm5hbWUpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUnVuIGFsbCB0ZXN0IGNsYXNzZXNcclxuICAgICAqL1xyXG4gICAgcnVuKCkge1xyXG4gICAgICAgIExvZ2dlci5saXN0ZW5lciA9IHRoaXMubG9nTGlzdGVuZXI7XHJcbiAgICAgICAgbGV0IGNsYXNzTmFtZUFycmF5ID0gW107XHJcbiAgICAgICAgdGhpcy50ZXN0Q2xhc3NNYXAuZm9yRWFjaCgoY2xhc3NOYW1lLCB0ZXN0Q2xhc3MsIHBhcmVudCkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLnJ1blRlc3RDbGFzc0xpc3QuYWRkKHRlc3RDbGFzcyk7XHJcbiAgICAgICAgICAgIHRoaXMucnVuVGVzdEZ1bmN0aW9uTGlzdC5hZGRBbGwodGVzdENsYXNzLnRlc3RGdW5jdGlvbnMoKSk7XHJcbiAgICAgICAgICAgIGNsYXNzTmFtZUFycmF5LnB1c2goY2xhc3NOYW1lKTtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgdGhpcy5ydW5DbGFzc05hbWVBdChjbGFzc05hbWVBcnJheSwgMCk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSdW4gdGVzdCBieSBjbGFzcyBuYW1lXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY2xhc3NOYW1lIFxyXG4gICAgICovXHJcbiAgICBydW5TaW5nbGUoY2xhc3NOYW1lKSB7XHJcbiAgICAgICAgTG9nZ2VyLmxpc3RlbmVyID0gdGhpcy5sb2dMaXN0ZW5lcjtcclxuICAgICAgICB0aGlzLnJ1blRlc3RDbGFzc0xpc3QuYWRkKHRoaXMudGVzdENsYXNzTWFwLmdldChjbGFzc05hbWUpKTtcclxuICAgICAgICB0aGlzLnJ1bkNsYXNzTmFtZUF0KFtjbGFzc05hbWVdLCAwKTtcclxuICAgIH1cclxuXHJcbiAgICBydW5DbGFzc05hbWVBdChjbGFzc05hbWVBcnJheSwgaW5kZXgpIHtcclxuXHJcbiAgICAgICAgaWYgKGluZGV4ID49IGNsYXNzTmFtZUFycmF5Lmxlbmd0aCkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBjbGFzc05hbWUgPSBjbGFzc05hbWVBcnJheVtpbmRleF07XHJcblxyXG4gICAgICAgIHRoaXMucnVuVGVzdENsYXNzQ291bnQrKztcclxuXHJcbiAgICAgICAgdGhpcy5wcmludEhlYWRlcihjbGFzc05hbWUpO1xyXG4gICAgICAgIHRoaXMubG9hZE9iamVjdEJ5Q2xhc3NOYW1lKGNsYXNzTmFtZSkudGhlbigoKSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMucnVuRnVuY3Rpb25zQnlDbGFzc05hbWUoY2xhc3NOYW1lLCAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnJ1bkNsYXNzTmFtZUF0KGNsYXNzTmFtZUFycmF5LCBpbmRleCsxKTtcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGxvYWRPYmplY3RCeUNsYXNzTmFtZShjbGFzc05hbWUpIHtcclxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCB0ZXN0Q2xhc3MgPSB0aGlzLnRlc3RDbGFzc01hcC5nZXQoY2xhc3NOYW1lKTtcclxuICAgICAgICAgICAgdGhpcy5vYmplY3RQcm92aWRlci5wcm92aWRlKHRlc3RDbGFzcykudGhlbigodGVzdE9iamVjdCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgdGhpcy50ZXN0T2JqZWN0TWFwLnNldChjbGFzc05hbWUsIHRlc3RPYmplY3QpO1xyXG4gICAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICAgICAgfSwgMTAwKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBcclxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBjbGFzc05hbWUgXHJcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBvbkNvbXBsZXRlIFxyXG4gICAgICovXHJcbiAgICBydW5GdW5jdGlvbnNCeUNsYXNzTmFtZShjbGFzc05hbWUsIG9uQ29tcGxldGUpIHtcclxuICAgICAgICBjb25zdCB0ZXN0Q2xhc3MgPSB0aGlzLnRlc3RDbGFzc01hcC5nZXQoY2xhc3NOYW1lKTtcclxuICAgICAgICBjb25zdCB0ZXN0RnVuY3Rpb25zID0gdGVzdENsYXNzLnRlc3RGdW5jdGlvbnMoKTtcclxuICAgICAgICBjb25zdCBmdW5jdGlvbkFycmF5ID0gW107XHJcblxyXG4gICAgICAgIHRlc3RGdW5jdGlvbnMuZm9yRWFjaCgodmFsdWUsIHBhcmVudCkgPT4ge1xyXG4gICAgICAgICAgICAvKiogQHR5cGUge0Z1bmN0aW9ufSAqL1xyXG4gICAgICAgICAgICBjb25zdCB0ZXN0RnVuY3Rpb24gPSB2YWx1ZTtcclxuICAgICAgICAgICAgZnVuY3Rpb25BcnJheS5wdXNoKHRlc3RGdW5jdGlvbik7XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBpZiAoZnVuY3Rpb25BcnJheS5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgIHRoaXMucnVuRnVuY3Rpb25BdCh0ZXN0Q2xhc3MsIGZ1bmN0aW9uQXJyYXksIDAsIG9uQ29tcGxldGUpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFxyXG4gICAgICogQHBhcmFtIHtBcnJheX0gZnVuY3Rpb25BcnJheSBcclxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSBpbmRleCBcclxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IG9uQ29tcGxldGVcclxuICAgICAqL1xyXG4gICAgcnVuRnVuY3Rpb25BdCh0ZXN0Q2xhc3MsIGZ1bmN0aW9uQXJyYXksIGluZGV4LCBvbkNvbXBsZXRlKSB7XHJcbiAgICAgICAgaWYgKGZ1bmN0aW9uQXJyYXkubGVuZ3RoIDw9IGluZGV4KSB7XHJcbiAgICAgICAgICAgIG9uQ29tcGxldGUuY2FsbCgpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGNvbnN0IHRlc3RPYmplY3QgPSB0aGlzLnRlc3RPYmplY3RNYXAuZ2V0KHRlc3RDbGFzcy5uYW1lKTtcclxuICAgICAgICBjb25zdCB0ZXN0RnVuY3Rpb24gPSBmdW5jdGlvbkFycmF5W2luZGV4XTtcclxuXHJcbiAgICAgICAgLyoqIEB0eXBlIHtQcm9taXNlfSAqL1xyXG4gICAgICAgIGxldCB0ZXN0RnVuY3Rpb25SZXN1bHQgPSBudWxsO1xyXG5cclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICB0ZXN0RnVuY3Rpb25SZXN1bHQgPSB0ZXN0RnVuY3Rpb24uY2FsbCh0ZXN0T2JqZWN0KTtcclxuICAgICAgICAgICAgaWYgKCEodGVzdEZ1bmN0aW9uUmVzdWx0IGluc3RhbmNlb2YgUHJvbWlzZSkpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMucnVuVGVzdEZ1bmN0aW9uQ291bnQgKys7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnJlcG9ydFN1Y2Nlc3ModGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24pO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5ydW5GdW5jdGlvbkF0KHRlc3RDbGFzcywgZnVuY3Rpb25BcnJheSwgaW5kZXgrMSwgb25Db21wbGV0ZSk7XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSBjYXRjaCAoZXhjZXB0aW9uKSB7XHJcbiAgICAgICAgICAgIHRoaXMucnVuVGVzdEZ1bmN0aW9uQ291bnQgKys7XHJcbiAgICAgICAgICAgIHRoaXMucmVwb3J0RmFpbHVyZSh0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbiwgZXhjZXB0aW9uKTtcclxuICAgICAgICAgICAgdGhpcy5ydW5GdW5jdGlvbkF0KHRlc3RDbGFzcywgZnVuY3Rpb25BcnJheSwgaW5kZXgrMSwgb25Db21wbGV0ZSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoISh0ZXN0RnVuY3Rpb25SZXN1bHQgaW5zdGFuY2VvZiBQcm9taXNlKSkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0ZXN0RnVuY3Rpb25SZXN1bHQudGhlbigoKSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMucnVuVGVzdEZ1bmN0aW9uQ291bnQgKys7XHJcbiAgICAgICAgICAgIHRoaXMucmVwb3J0U3VjY2Vzcyh0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbik7XHJcbiAgICAgICAgICAgIHRoaXMucnVuRnVuY3Rpb25BdCh0ZXN0Q2xhc3MsIGZ1bmN0aW9uQXJyYXksIGluZGV4KzEsIG9uQ29tcGxldGUpO1xyXG5cclxuICAgICAgICB9KS5jYXRjaCgoZXhjZXB0aW9uKSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMucnVuVGVzdEZ1bmN0aW9uQ291bnQgKys7XHJcbiAgICAgICAgICAgIHRoaXMucmVwb3J0RmFpbHVyZSh0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbiwgZXhjZXB0aW9uKTtcclxuICAgICAgICAgICAgdGhpcy5ydW5GdW5jdGlvbkF0KHRlc3RDbGFzcywgZnVuY3Rpb25BcnJheSwgaW5kZXgrMSwgb25Db21wbGV0ZSk7XHJcblxyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIHJlcG9ydEZhaWx1cmUodGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24sIGV4Y2VwdGlvbikge1xyXG4gICAgICAgIHRoaXMuYWRkRmFpbCh0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbik7XHJcbiAgICAgICAgdGhpcy5jYWxsUmVzdWx0TGlzdGVuZXIodGVzdENsYXNzLCB0cnVlKTtcclxuICAgICAgICBMT0cuZXJyb3IodGhpcy5zaWduYXR1cmUodGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24pICsgXCIgZmFpbGVkLiBSZWFzb246XCIpO1xyXG4gICAgICAgIExPRy5lcnJvcihleGNlcHRpb24pO1xyXG4gICAgICAgIExPRy5lcnJvcihcIlwiKTtcclxuICAgICAgICB0aGlzLnRyeUNsb3NlKCk7XHJcbiAgICB9XHJcblxyXG4gICAgcmVwb3J0U3VjY2Vzcyh0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbikge1xyXG4gICAgICAgIHRoaXMuYWRkU3VjY2Vzcyh0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbik7XHJcbiAgICAgICAgdGhpcy5jYWxsUmVzdWx0TGlzdGVuZXIodGVzdENsYXNzLCBmYWxzZSk7XHJcbiAgICAgICAgdGhpcy50cnlDbG9zZSgpO1xyXG4gICAgfVxyXG5cclxuICAgIGNhbGxSZXN1bHRMaXN0ZW5lcih0ZXN0Q2xhc3MsIGZhaWxlZCkge1xyXG4gICAgICAgIGlmICghdGhpcy5yZXN1bHRMaXN0ZW5lcikge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGZhaWxlZCA/IFRlc3RDbGFzc1Jlc3VsdC5GQUlMIDogVGVzdENsYXNzUmVzdWx0LlNVQ0NFU1M7XHJcbiAgICAgICAgdGhpcy5yZXN1bHRMaXN0ZW5lci5jYWxsKG5ldyBUZXN0Q2xhc3NSZXN1bHQodGVzdENsYXNzLm5hbWUsIHJlc3VsdCkpO1xyXG4gICAgfVxyXG5cclxuICAgIGFkZFN1Y2Nlc3ModGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24pIHtcclxuICAgICAgICB0aGlzLnJ1blN1Y2Nlc3NUZXN0TGlzdC5hZGQodGhpcy5zaWduYXR1cmUodGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24pKTtcclxuICAgIH1cclxuXHJcbiAgICBhZGRGYWlsKHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uKSB7XHJcbiAgICAgICAgdGhpcy5ydW5GYWlsVGVzdExpc3QuYWRkKHRoaXMuc2lnbmF0dXJlKHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uKSk7XHJcbiAgICB9XHJcblxyXG4gICAgc2lnbmF0dXJlKHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uKSB7XHJcbiAgICAgICAgcmV0dXJuIHRlc3RDbGFzcy5uYW1lICsgXCIuXCIgKyB0ZXN0RnVuY3Rpb24ubmFtZSArIFwiKClcIjtcclxuICAgIH1cclxuXHJcbiAgICB0cnlDbG9zZSgpIHtcclxuICAgICAgICBpZiAodGhpcy5ydW5UZXN0RnVuY3Rpb25MaXN0LnNpemUoKSA8PSB0aGlzLnJ1blRlc3RGdW5jdGlvbkNvdW50ICYmIHRoaXMucnVuVGVzdENsYXNzTGlzdC5zaXplKCkgPD0gdGhpcy5ydW5UZXN0Q2xhc3NDb3VudCkge1xyXG4gICAgICAgICAgICB0aGlzLmNsb3NlKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGNsb3NlKCkge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIHRoaXMucHJpbnRSZXBvcnQoKTtcclxuICAgICAgICB9IGZpbmFsbHkge1xyXG4gICAgICAgICAgICB0aGlzLnJlc2V0KCk7XHJcbiAgICAgICAgICAgIExvZ2dlci5jbGVhckxpc3RlbmVyKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaW50SGVhZGVyKHRlc3ROYW1lKSB7XHJcbiAgICAgICAgY29uc3QgbGluZSA9IFwiIyAgUnVubmluZyB0ZXN0OiBcIiArIHRlc3ROYW1lICsgXCIgICNcIjtcclxuICAgICAgICBsZXQgZGVjb3JhdGlvbiA9IFwiXCI7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW5lLmxlbmd0aCA7IGkrKykge1xyXG4gICAgICAgICAgICBkZWNvcmF0aW9uID0gZGVjb3JhdGlvbiArIFwiI1wiO1xyXG4gICAgICAgIH1cclxuICAgICAgICBMT0cuaW5mbyhkZWNvcmF0aW9uKTtcclxuICAgICAgICBMT0cuaW5mbyhsaW5lKTtcclxuICAgICAgICBMT0cuaW5mbyhkZWNvcmF0aW9uKTtcclxuICAgICAgICBMT0cuaW5mbyhcIlwiKTtcclxuICAgIH1cclxuXHJcbiAgICBwcmludFJlcG9ydCgpIHtcclxuICAgICAgICBMT0cuaW5mbyhcIiMjIyMjIyMjIyMjIyMjIyMjIyNcIik7XHJcbiAgICAgICAgTE9HLmluZm8oXCIjICAgVGVzdCBSZXBvcnQgICAjXCIpO1xyXG4gICAgICAgIExPRy5pbmZvKFwiIyMjIyMjIyMjIyMjIyMjIyMjI1wiKTtcclxuICAgICAgICBMT0cuaW5mbyhcIlwiKTtcclxuXHJcbiAgICAgICAgbGV0IHN1Y2Nlc3NDb3VudGVyID0gMDtcclxuICAgICAgICBpZiAodGhpcy5ydW5TdWNjZXNzVGVzdExpc3Quc2l6ZSgpID4gMCl7XHJcbiAgICAgICAgICAgIExPRy5pbmZvKFwiU3VjY2VlZGVkOlwiKTtcclxuICAgICAgICAgICAgdGhpcy5ydW5TdWNjZXNzVGVzdExpc3QuZm9yRWFjaCgodmFsdWUscGFyZW50KSA9PiB7XHJcbiAgICAgICAgICAgICAgICBMT0cuaW5mbyhzdWNjZXNzQ291bnRlcisrICsgXCIuIFwiICsgdmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBMT0cuaW5mbyhcIlwiKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCBmYWlsQ291bnRlciA9IDA7XHJcbiAgICAgICAgaWYgKHRoaXMucnVuRmFpbFRlc3RMaXN0LnNpemUoKSA+IDApe1xyXG4gICAgICAgICAgICBMT0cuaW5mbyhcIkZhaWxlZDpcIik7XHJcbiAgICAgICAgICAgIHRoaXMucnVuRmFpbFRlc3RMaXN0LmZvckVhY2goKHZhbHVlLHBhcmVudCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgTE9HLmluZm8oZmFpbENvdW50ZXIrKyArIFwiLiBcIiArIHZhbHVlKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgTE9HLmluZm8oXCJcIik7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoZmFpbENvdW50ZXIgIT0gMCkge1xyXG4gICAgICAgICAgICB0aHJvdyB0aGlzLnJ1bkZhaWxUZXN0TGlzdC5zaXplKCkgKyBcIiBUZXN0cyBmYWlsZWRcIjtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcmVzZXQoKSB7XHJcbiAgICAgICAgdGhpcy5ydW5GYWlsVGVzdExpc3QgPSBuZXcgTGlzdCgpO1xyXG4gICAgICAgIHRoaXMucnVuU3VjY2Vzc1Rlc3RMaXN0ID0gbmV3IExpc3QoKTtcclxuXHJcbiAgICAgICAgdGhpcy5ydW5UZXN0RnVuY3Rpb25MaXN0ID0gbmV3IExpc3QoKTtcclxuICAgICAgICB0aGlzLnJ1blRlc3RDbGFzc0xpc3QgPSBuZXcgTGlzdCgpO1xyXG5cclxuICAgICAgICB0aGlzLnJ1blRlc3RGdW5jdGlvbkNvdW50ID0gMDtcclxuICAgICAgICB0aGlzLnJ1blRlc3RDbGFzc0NvdW50ID0gMDtcclxuICAgIH1cclxufSJdLCJuYW1lcyI6WyJMT0ciXSwibWFwcGluZ3MiOiI7O0FBQU8sTUFBTSxhQUFhLENBQUM7QUFDM0I7QUFDQSxJQUFJLE9BQU8sVUFBVSxDQUFDLE9BQU8sR0FBRyxJQUFJLEVBQUU7QUFDdEMsUUFBUSxHQUFHLE9BQU8sRUFBRTtBQUNwQixZQUFZ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
