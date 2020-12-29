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
                },1000);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdGJlbmNoX3YxLmpzIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdGVzdGJlbmNoL2Fzc2VydGlvbnMvYXNzZXJ0Qm9vbGVhbi5qcyIsIi4uLy4uL3NyYy90ZXN0YmVuY2gvYXNzZXJ0aW9ucy9hc3NlcnRTdHJpbmcuanMiLCIuLi8uLi9zcmMvdGVzdGJlbmNoL29iamVjdFByb3ZpZGVyLmpzIiwiLi4vLi4vc3JjL3Rlc3RiZW5jaC90ZXN0Q2xhc3NSZXN1bHQuanMiLCIuLi8uLi9zcmMvdGVzdGJlbmNoL3Rlc3RUcmlnZ2VyLmpzIiwiLi4vLi4vc3JjL3Rlc3RiZW5jaC90ZXN0QmVuY2guanMiLCIuLi8uLi9zcmMvdGVzdGJlbmNoL3Rlc3RCZW5jaDIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGNsYXNzIEFzc2VydEJvb2xlYW4ge1xyXG5cclxuICAgIHN0YXRpYyBhc3NlcnRUcnVlKGJvb2xlYW4gPSB0cnVlKSB7XHJcbiAgICAgICAgaWYoYm9vbGVhbikge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRocm93IFwiQm9vbGVhbiBhc3NlcnRpb24gZmFpbGVkLiBFeHBlY3RlZCB0cnVlIGJ1dCB3YXMgXCIgKyBib29sZWFuO1xyXG4gICAgfVxyXG5cclxufSIsImV4cG9ydCBjbGFzcyBBc3NlcnRTdHJpbmcge1xyXG5cclxuICAgIHN0YXRpYyBhc3NlcnRFcXVhbHMoZXhwZWN0ZWQsIGFjdHVhbCkge1xyXG4gICAgICAgIGlmIChleHBlY3RlZCA9PT0gYWN0dWFsKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhyb3cgXCJTdHJpbmcgQXNzZXJ0aW9uIEZhaWxlZC4gRXhwZWN0ZWQ6ICdcIiArIGV4cGVjdGVkICsgXCInIEFjdHVhbDogJ1wiICsgYWN0dWFsICsgXCInXCI7XHJcbiAgICB9XHJcblxyXG59IiwiZXhwb3J0IGNsYXNzIE9iamVjdFByb3ZpZGVyIHtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcigpIHtcclxuXHJcbiAgICB9XHJcblxyXG4gICAgcHJvdmlkZSh0aGVDbGFzcywgYXJncyA9IFtdKSB7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgICAgICAgcmVzb2x2ZShuZXcgdGhlQ2xhc3MoLi4uYXJncykpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxufSIsImV4cG9ydCBjbGFzcyBUZXN0Q2xhc3NSZXN1bHQge1xyXG5cclxuICAgIHN0YXRpYyBnZXQgU1VDQ0VTUygpIHsgcmV0dXJuIDE7IH1cclxuICAgIHN0YXRpYyBnZXQgRkFJTCgpIHsgcmV0dXJuIDA7IH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFxyXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IGNsYXNzTmFtZSBcclxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSByZXN1bHQgXHJcbiAgICAgKi9cclxuICAgIGNvbnN0cnVjdG9yKGNsYXNzTmFtZSwgcmVzdWx0KSB7XHJcblxyXG4gICAgICAgIC8qKiBAdHlwZSB7U3RyaW5nfSAqL1xyXG4gICAgICAgIHRoaXMuY2xhc3NOYW1lID0gY2xhc3NOYW1lO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8qKiBAdHlwZSB7U3RyaW5nfSAqL1xyXG4gICAgICAgIHRoaXMucmVzdWx0ID0gcmVzdWx0O1xyXG4gICAgfVxyXG59IiwiZXhwb3J0IGNsYXNzIFRlc3RUcmlnZ2VyIHtcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgKiBSdW4gdGVzdCBieSBjbGFzcyBuYW1lXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY2xhc3NOYW1lIFxyXG4gICAgICovXHJcbiAgICBydW5TaW5nbGUoY2xhc3NOYW1lKSB7XHJcblxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUnVuIGFsbCB0ZXN0IGNsYXNzZXNcclxuICAgICAqL1xyXG4gICAgcnVuKCkge1xyXG4gICAgICAgIFxyXG4gICAgfVxyXG59IiwiaW1wb3J0IHsgTGlzdCwgTG9nZ2VyLCBNYXAsIE9iamVjdEZ1bmN0aW9uIH0gZnJvbSBcImNvcmV1dGlsX3YxXCI7XHJcbmltcG9ydCB7IE9iamVjdFByb3ZpZGVyIH0gZnJvbSBcIi4vb2JqZWN0UHJvdmlkZXIuanNcIjtcclxuaW1wb3J0IHsgVGVzdENsYXNzUmVzdWx0IH0gZnJvbSBcIi4vdGVzdENsYXNzUmVzdWx0LmpzXCI7XHJcbmltcG9ydCB7IFRlc3RUcmlnZ2VyIH0gZnJvbSBcIi4vdGVzdFRyaWdnZXIuanNcIjtcclxuXHJcbmNvbnN0IExPRyA9IG5ldyBMb2dnZXIoXCJUZXN0QmVuY2hcIik7XHJcblxyXG5leHBvcnQgY2xhc3MgVGVzdEJlbmNoIGV4dGVuZHMgVGVzdFRyaWdnZXIge1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdEZ1bmN0aW9ufSBsb2dMaXN0ZW5lciBcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0RnVuY3Rpb259IHJlc3VsdExpc3RlbmVyIFxyXG4gICAgICogQHBhcmFtIHtPYmplY3RQcm92aWRlcn0gb2JqZWN0UHJvdmlkZXJcclxuICAgICAqL1xyXG4gICAgY29uc3RydWN0b3IobG9nTGlzdGVuZXIgPSBudWxsLFxyXG4gICAgICAgICAgICByZXN1bHRMaXN0ZW5lciA9IG51bGwsIFxyXG4gICAgICAgICAgICBvYmplY3RQcm92aWRlciA9IG5ldyBPYmplY3RQcm92aWRlcigpKSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgc3VwZXIoKTtcclxuXHJcbiAgICAgICAgLyoqIEB0eXBlIHtPYmplY3RGdW5jdGlvbn0gKi9cclxuICAgICAgICB0aGlzLmxvZ0xpc3RlbmVyID0gbG9nTGlzdGVuZXI7XHJcblxyXG4gICAgICAgIC8qKiBAdHlwZSB7T2JqZWN0RnVuY3Rpb259ICovXHJcbiAgICAgICAgdGhpcy5yZXN1bHRMaXN0ZW5lciA9IHJlc3VsdExpc3RlbmVyO1xyXG5cclxuICAgICAgICAvKiogQHR5cGUge01hcH0gKi9cclxuICAgICAgICB0aGlzLnRlc3RDbGFzc01hcCA9IG5ldyBNYXAoKTtcclxuXHJcbiAgICAgICAgLyoqIEB0eXBlIHtNYXB9ICovXHJcbiAgICAgICAgdGhpcy50ZXN0T2JqZWN0TWFwID0gbmV3IE1hcCgpO1xyXG5cclxuICAgICAgICAvKiogQHR5cGUge09iamVjdFByb3ZpZGVyfSAqL1xyXG4gICAgICAgIHRoaXMub2JqZWN0UHJvdmlkZXIgPSBvYmplY3RQcm92aWRlcjtcclxuXHJcbiAgICAgICAgLyoqIEB0eXBlIHtMaXN0fSAqL1xyXG4gICAgICAgIHRoaXMucnVuU3VjY2Vzc1Rlc3RMaXN0ID0gbmV3IExpc3QoKTtcclxuXHJcbiAgICAgICAgLyoqIEB0eXBlIHtMaXN0fSAqL1xyXG4gICAgICAgIHRoaXMucnVuRmFpbFRlc3RMaXN0ID0gbmV3IExpc3QoKTtcclxuICAgICAgICBcclxuICAgICAgICAvKiogQHR5cGUge0xpc3R9ICovXHJcbiAgICAgICAgdGhpcy5ydW5UZXN0RnVuY3Rpb25MaXN0ID0gbmV3IExpc3QoKTtcclxuXHJcbiAgICAgICAgLyoqIEB0eXBlIHtMaXN0fSAqL1xyXG4gICAgICAgIHRoaXMucnVuVGVzdENsYXNzTGlzdCA9IG5ldyBMaXN0KCk7XHJcblxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gdGVzdE9iamVjdCBcclxuICAgICAqIEByZXR1cm5zIHtUZXN0QmVuY2h9XHJcbiAgICAgKi9cclxuICAgIGFkZFRlc3QodGVzdENsYXNzKSB7XHJcbiAgICAgICAgaWYgKCF0ZXN0Q2xhc3MudGVzdEZ1bmN0aW9ucyB8fCAhKHRlc3RDbGFzcy50ZXN0RnVuY3Rpb25zKCkgaW5zdGFuY2VvZiBMaXN0KSkge1xyXG4gICAgICAgICAgICB0aHJvdyBcIkEgc3RhdGljIGZ1bmN0aW9uIGNhbGxlZCAndGVzdEZ1bmN0aW9ucycgbXVzdCBiZSBwcm92aWRlZCBpbiBcIiBcclxuICAgICAgICAgICAgICAgICsgdGVzdENsYXNzLm5hbWUgXHJcbiAgICAgICAgICAgICAgICArIFwiIHdoaWNoIHJldHVybnMgYSBMaXN0IGFsbCB0aGUgdGVzdCBmdW5jdGlvbnMgaW4gXCJcclxuICAgICAgICAgICAgICAgICsgdGVzdENsYXNzLm5hbWUgKyBcIi5wcm90b3R5cGVcIlxyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLnRlc3RDbGFzc01hcC5zZXQodGVzdENsYXNzLm5hbWUsIHRlc3RDbGFzcyk7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcblxyXG4gICAgY29udGFpbnModGVzdENsYXNzKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMudGVzdENsYXNzTWFwLmNvbnRhaW5zKHRlc3RDbGFzcy5uYW1lKTtcclxuICAgIH1cclxuXHJcbiAgICBydW4oKSB7XHJcbiAgICAgICAgTG9nZ2VyLmxpc3RlbmVyID0gdGhpcy5sb2dMaXN0ZW5lcjtcclxuICAgICAgICBsZXQgcGFyZW50ID0gdGhpcztcclxuICAgICAgICByZXR1cm4gdGhpcy50ZXN0Q2xhc3NNYXAucHJvbWlzZUNoYWluKHRoaXMucnVuQ2xhc3MsIHRoaXMpLnRoZW4oKCkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLmNsb3NlKHBhcmVudCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSdW4gdGVzdCBieSBjbGFzcyBuYW1lXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY2xhc3NOYW1lIFxyXG4gICAgICovXHJcbiAgICBydW5TaW5nbGUoY2xhc3NOYW1lKSB7XHJcbiAgICAgICAgTG9nZ2VyLmxpc3RlbmVyID0gdGhpcy5sb2dMaXN0ZW5lcjtcclxuICAgICAgICBsZXQgdGVzdENsYXNzID0gdGhpcy50ZXN0Q2xhc3NNYXAuZ2V0KGNsYXNzTmFtZSk7XHJcbiAgICAgICAgbGV0IHBhcmVudCA9IHRoaXM7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMucnVuQ2xhc3MoY2xhc3NOYW1lLCB0ZXN0Q2xhc3MsIHRoaXMpLnRoZW4oKCkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLmNsb3NlKHBhcmVudCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgcnVuQ2xhc3MoY2xhc3NOYW1lLCB0ZXN0Q2xhc3MsIHBhcmVudCkge1xyXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgICAgICAgIHBhcmVudC5ydW5UZXN0Q2xhc3NMaXN0LmFkZCh0ZXN0Q2xhc3MpO1xyXG4gICAgICAgICAgICBwYXJlbnQucnVuVGVzdEZ1bmN0aW9uTGlzdC5hZGRBbGwodGVzdENsYXNzLnRlc3RGdW5jdGlvbnMoKSk7XHJcbiAgICAgICAgICAgIHBhcmVudC5wcmludEhlYWRlcihjbGFzc05hbWUpO1xyXG4gICAgICAgICAgICBwYXJlbnQubG9hZE9iamVjdEJ5Q2xhc3NOYW1lKGNsYXNzTmFtZSwgcGFyZW50KS50aGVuKCgpID0+IHtcclxuICAgICAgICAgICAgICAgIHBhcmVudC5ydW5GdW5jdGlvbnNCeUNsYXNzTmFtZShjbGFzc05hbWUsIHBhcmVudCkudGhlbigoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGxvYWRPYmplY3RCeUNsYXNzTmFtZShjbGFzc05hbWUsIHBhcmVudCkge1xyXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IHRlc3RDbGFzcyA9IHBhcmVudC50ZXN0Q2xhc3NNYXAuZ2V0KGNsYXNzTmFtZSk7XHJcbiAgICAgICAgICAgIHBhcmVudC5vYmplY3RQcm92aWRlci5wcm92aWRlKHRlc3RDbGFzcykudGhlbigodGVzdE9iamVjdCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgcGFyZW50LnRlc3RPYmplY3RNYXAuc2V0KGNsYXNzTmFtZSwgdGVzdE9iamVjdCk7XHJcbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKCk7XHJcbiAgICAgICAgICAgICAgICB9LDEwMDApO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFxyXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IGNsYXNzTmFtZSBcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwYXJlbnQgXHJcbiAgICAgKi9cclxuICAgIHJ1bkZ1bmN0aW9uc0J5Q2xhc3NOYW1lKGNsYXNzTmFtZSwgcGFyZW50KSB7XHJcbiAgICAgICAgY29uc3QgdGVzdENsYXNzID0gcGFyZW50LnRlc3RDbGFzc01hcC5nZXQoY2xhc3NOYW1lKTtcclxuICAgICAgICAvKiogQHR5cGUge0xpc3R9ICovXHJcbiAgICAgICAgY29uc3QgdGVzdEZ1bmN0aW9ucyA9IHRlc3RDbGFzcy50ZXN0RnVuY3Rpb25zKCk7XHJcbiAgICAgICAgcmV0dXJuIHRlc3RGdW5jdGlvbnMucHJvbWlzZUNoYWluKCh0ZXN0RnVuY3Rpb24pID0+IHtcclxuICAgICAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChmdW5jdGlvbkNvbXBsZXRlUmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgICAgICAgICAgICBwYXJlbnQucnVuRnVuY3Rpb24odGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24sIGZ1bmN0aW9uQ29tcGxldGVSZXNvbHZlLCBwYXJlbnQpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9LCBwYXJlbnQpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogXHJcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBmdW5jdGlvbkFycmF5IFxyXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IGluZGV4IFxyXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuY3Rpb25Db21wbGV0ZVJlc29sdmVcclxuICAgICAqL1xyXG4gICAgcnVuRnVuY3Rpb24odGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24sIGZ1bmN0aW9uQ29tcGxldGVSZXNvbHZlLCBwYXJlbnQpIHtcclxuICAgICAgICBcclxuICAgICAgICBjb25zdCB0ZXN0T2JqZWN0ID0gcGFyZW50LnRlc3RPYmplY3RNYXAuZ2V0KHRlc3RDbGFzcy5uYW1lKTtcclxuXHJcbiAgICAgICAgLyoqIEB0eXBlIHtQcm9taXNlfSAqL1xyXG4gICAgICAgIGxldCB0ZXN0RnVuY3Rpb25SZXN1bHQgPSBudWxsO1xyXG5cclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICB0ZXN0RnVuY3Rpb25SZXN1bHQgPSB0ZXN0RnVuY3Rpb24uY2FsbCh0ZXN0T2JqZWN0KTtcclxuICAgICAgICAgICAgaWYgKCEodGVzdEZ1bmN0aW9uUmVzdWx0IGluc3RhbmNlb2YgUHJvbWlzZSkpIHtcclxuICAgICAgICAgICAgICAgIHBhcmVudC5yZXBvcnRTdWNjZXNzKHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uLCBwYXJlbnQpO1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0gY2F0Y2ggKGV4Y2VwdGlvbikge1xyXG4gICAgICAgICAgICBwYXJlbnQucmVwb3J0RmFpbHVyZSh0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbiwgZXhjZXB0aW9uLCBwYXJlbnQpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKCEodGVzdEZ1bmN0aW9uUmVzdWx0IGluc3RhbmNlb2YgUHJvbWlzZSkpIHtcclxuICAgICAgICAgICAgZnVuY3Rpb25Db21wbGV0ZVJlc29sdmUoKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGVzdEZ1bmN0aW9uUmVzdWx0LnRoZW4oKCkgPT4ge1xyXG4gICAgICAgICAgICBwYXJlbnQucmVwb3J0U3VjY2Vzcyh0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbiwgcGFyZW50KTtcclxuICAgICAgICAgICAgZnVuY3Rpb25Db21wbGV0ZVJlc29sdmUoKTtcclxuICAgICAgICB9KS5jYXRjaCgoZXhjZXB0aW9uKSA9PiB7XHJcbiAgICAgICAgICAgIHBhcmVudC5yZXBvcnRGYWlsdXJlKHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uLCBleGNlcHRpb24sIHBhcmVudCk7XHJcbiAgICAgICAgICAgIGZ1bmN0aW9uQ29tcGxldGVSZXNvbHZlKCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgcmVwb3J0RmFpbHVyZSh0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbiwgZXhjZXB0aW9uLCBwYXJlbnQpIHtcclxuICAgICAgICBwYXJlbnQuYWRkRmFpbCh0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbiwgcGFyZW50KTtcclxuICAgICAgICBwYXJlbnQuY2FsbFJlc3VsdExpc3RlbmVyKHRlc3RDbGFzcywgdHJ1ZSwgcGFyZW50KTtcclxuICAgICAgICBMT0cuZXJyb3IodGhpcy5zaWduYXR1cmUodGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24pICsgXCIgZmFpbGVkLiBSZWFzb246XCIpO1xyXG4gICAgICAgIExPRy5lcnJvcihleGNlcHRpb24pO1xyXG4gICAgICAgIExPRy5lcnJvcihcIlwiKTtcclxuICAgIH1cclxuXHJcbiAgICByZXBvcnRTdWNjZXNzKHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uLCBwYXJlbnQpIHtcclxuICAgICAgICBwYXJlbnQuYWRkU3VjY2Vzcyh0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbiwgcGFyZW50KTtcclxuICAgICAgICBwYXJlbnQuY2FsbFJlc3VsdExpc3RlbmVyKHRlc3RDbGFzcywgZmFsc2UsIHBhcmVudCk7XHJcbiAgICB9XHJcblxyXG4gICAgY2FsbFJlc3VsdExpc3RlbmVyKHRlc3RDbGFzcywgZmFpbGVkLCBwYXJlbnQpIHtcclxuICAgICAgICBpZiAoIXBhcmVudC5yZXN1bHRMaXN0ZW5lcikge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGZhaWxlZCA/IFRlc3RDbGFzc1Jlc3VsdC5GQUlMIDogVGVzdENsYXNzUmVzdWx0LlNVQ0NFU1M7XHJcbiAgICAgICAgcGFyZW50LnJlc3VsdExpc3RlbmVyLmNhbGwobmV3IFRlc3RDbGFzc1Jlc3VsdCh0ZXN0Q2xhc3MubmFtZSwgcmVzdWx0KSk7XHJcbiAgICB9XHJcblxyXG4gICAgYWRkU3VjY2Vzcyh0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbiwgcGFyZW50KSB7XHJcbiAgICAgICAgcGFyZW50LnJ1blN1Y2Nlc3NUZXN0TGlzdC5hZGQocGFyZW50LnNpZ25hdHVyZSh0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbikpO1xyXG4gICAgfVxyXG5cclxuICAgIGFkZEZhaWwodGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24sIHBhcmVudCkge1xyXG4gICAgICAgIHBhcmVudC5ydW5GYWlsVGVzdExpc3QuYWRkKHBhcmVudC5zaWduYXR1cmUodGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24pKTtcclxuICAgIH1cclxuXHJcbiAgICBzaWduYXR1cmUodGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24pIHtcclxuICAgICAgICByZXR1cm4gdGVzdENsYXNzLm5hbWUgKyBcIi5cIiArIHRlc3RGdW5jdGlvbi5uYW1lICsgXCIoKVwiO1xyXG4gICAgfVxyXG5cclxuICAgIGNsb3NlKHBhcmVudCkge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIHBhcmVudC5wcmludFJlcG9ydChwYXJlbnQpO1xyXG4gICAgICAgIH0gZmluYWxseSB7XHJcbiAgICAgICAgICAgIHBhcmVudC5yZXNldChwYXJlbnQpO1xyXG4gICAgICAgICAgICBMb2dnZXIuY2xlYXJMaXN0ZW5lcigpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcmludEhlYWRlcih0ZXN0TmFtZSkge1xyXG4gICAgICAgIGNvbnN0IGxpbmUgPSBcIiMgIFJ1bm5pbmcgdGVzdDogXCIgKyB0ZXN0TmFtZSArIFwiICAjXCI7XHJcbiAgICAgICAgbGV0IGRlY29yYXRpb24gPSBcIlwiO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGluZS5sZW5ndGggOyBpKyspIHtcclxuICAgICAgICAgICAgZGVjb3JhdGlvbiA9IGRlY29yYXRpb24gKyBcIiNcIjtcclxuICAgICAgICB9XHJcbiAgICAgICAgTE9HLmluZm8oZGVjb3JhdGlvbik7XHJcbiAgICAgICAgTE9HLmluZm8obGluZSk7XHJcbiAgICAgICAgTE9HLmluZm8oZGVjb3JhdGlvbik7XHJcbiAgICAgICAgTE9HLmluZm8oXCJcIik7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpbnRSZXBvcnQocGFyZW50KSB7XHJcbiAgICAgICAgTE9HLmluZm8oXCIjIyMjIyMjIyMjIyMjIyMjIyMjXCIpO1xyXG4gICAgICAgIExPRy5pbmZvKFwiIyAgIFRlc3QgUmVwb3J0ICAgI1wiKTtcclxuICAgICAgICBMT0cuaW5mbyhcIiMjIyMjIyMjIyMjIyMjIyMjIyNcIik7XHJcbiAgICAgICAgTE9HLmluZm8oXCJcIik7XHJcblxyXG4gICAgICAgIGxldCBzdWNjZXNzQ291bnRlciA9IDA7XHJcbiAgICAgICAgaWYgKHBhcmVudC5ydW5TdWNjZXNzVGVzdExpc3Quc2l6ZSgpID4gMCl7XHJcbiAgICAgICAgICAgIExPRy5pbmZvKFwiU3VjY2VlZGVkOlwiKTtcclxuICAgICAgICAgICAgcGFyZW50LnJ1blN1Y2Nlc3NUZXN0TGlzdC5mb3JFYWNoKCh2YWx1ZSxwYXJlbnQpID0+IHtcclxuICAgICAgICAgICAgICAgIExPRy5pbmZvKHN1Y2Nlc3NDb3VudGVyKysgKyBcIi4gXCIgKyB2YWx1ZSk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIExPRy5pbmZvKFwiXCIpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IGZhaWxDb3VudGVyID0gMDtcclxuICAgICAgICBpZiAocGFyZW50LnJ1bkZhaWxUZXN0TGlzdC5zaXplKCkgPiAwKXtcclxuICAgICAgICAgICAgTE9HLmluZm8oXCJGYWlsZWQ6XCIpO1xyXG4gICAgICAgICAgICBwYXJlbnQucnVuRmFpbFRlc3RMaXN0LmZvckVhY2goKHZhbHVlLHBhcmVudCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgTE9HLmluZm8oZmFpbENvdW50ZXIrKyArIFwiLiBcIiArIHZhbHVlKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgTE9HLmluZm8oXCJcIik7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoZmFpbENvdW50ZXIgIT0gMCkge1xyXG4gICAgICAgICAgICB0aHJvdyBwYXJlbnQucnVuRmFpbFRlc3RMaXN0LnNpemUoKSArIFwiIFRlc3RzIGZhaWxlZFwiO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICByZXNldChwYXJlbnQpIHtcclxuICAgICAgICBwYXJlbnQucnVuRmFpbFRlc3RMaXN0ID0gbmV3IExpc3QoKTtcclxuICAgICAgICBwYXJlbnQucnVuU3VjY2Vzc1Rlc3RMaXN0ID0gbmV3IExpc3QoKTtcclxuXHJcbiAgICAgICAgcGFyZW50LnJ1blRlc3RGdW5jdGlvbkxpc3QgPSBuZXcgTGlzdCgpO1xyXG4gICAgICAgIHBhcmVudC5ydW5UZXN0Q2xhc3NMaXN0ID0gbmV3IExpc3QoKTtcclxuICAgIH1cclxufSIsImltcG9ydCB7IExpc3QsIExvZ2dlciwgTWFwLCBPYmplY3RGdW5jdGlvbiB9IGZyb20gXCJjb3JldXRpbF92MVwiO1xyXG5pbXBvcnQgeyBPYmplY3RQcm92aWRlciB9IGZyb20gXCIuL29iamVjdFByb3ZpZGVyLmpzXCI7XHJcbmltcG9ydCB7IFRlc3RDbGFzc1Jlc3VsdCB9IGZyb20gXCIuL3Rlc3RDbGFzc1Jlc3VsdC5qc1wiO1xyXG5pbXBvcnQgeyBUZXN0VHJpZ2dlciB9IGZyb20gXCIuL3Rlc3RUcmlnZ2VyLmpzXCI7XHJcblxyXG5jb25zdCBMT0cgPSBuZXcgTG9nZ2VyKFwiVGVzdEJlbmNoXCIpO1xyXG5cclxuZXhwb3J0IGNsYXNzIFRlc3RCZW5jaCBleHRlbmRzIFRlc3RUcmlnZ2VyIHtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFxyXG4gICAgICogQHBhcmFtIHtPYmplY3RGdW5jdGlvbn0gbG9nTGlzdGVuZXIgXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdEZ1bmN0aW9ufSByZXN1bHRMaXN0ZW5lciBcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0UHJvdmlkZXJ9IG9iamVjdFByb3ZpZGVyXHJcbiAgICAgKi9cclxuICAgIGNvbnN0cnVjdG9yKGxvZ0xpc3RlbmVyID0gbnVsbCxcclxuICAgICAgICAgICAgcmVzdWx0TGlzdGVuZXIgPSBudWxsLCBcclxuICAgICAgICAgICAgb2JqZWN0UHJvdmlkZXIgPSBuZXcgT2JqZWN0UHJvdmlkZXIoKSkge1xyXG4gICAgICAgIFxyXG4gICAgICAgIHN1cGVyKCk7XHJcblxyXG4gICAgICAgIC8qKiBAdHlwZSB7T2JqZWN0RnVuY3Rpb259ICovXHJcbiAgICAgICAgdGhpcy5sb2dMaXN0ZW5lciA9IGxvZ0xpc3RlbmVyO1xyXG5cclxuICAgICAgICAvKiogQHR5cGUge09iamVjdEZ1bmN0aW9ufSAqL1xyXG4gICAgICAgIHRoaXMucmVzdWx0TGlzdGVuZXIgPSByZXN1bHRMaXN0ZW5lcjtcclxuXHJcbiAgICAgICAgLyoqIEB0eXBlIHtNYXB9ICovXHJcbiAgICAgICAgdGhpcy50ZXN0Q2xhc3NNYXAgPSBuZXcgTWFwKCk7XHJcblxyXG4gICAgICAgIC8qKiBAdHlwZSB7TWFwfSAqL1xyXG4gICAgICAgIHRoaXMudGVzdE9iamVjdE1hcCA9IG5ldyBNYXAoKTtcclxuXHJcbiAgICAgICAgLyoqIEB0eXBlIHtPYmplY3RQcm92aWRlcn0gKi9cclxuICAgICAgICB0aGlzLm9iamVjdFByb3ZpZGVyID0gb2JqZWN0UHJvdmlkZXI7XHJcblxyXG4gICAgICAgIC8qKiBAdHlwZSB7TGlzdH0gKi9cclxuICAgICAgICB0aGlzLnJ1blN1Y2Nlc3NUZXN0TGlzdCA9IG5ldyBMaXN0KCk7XHJcblxyXG4gICAgICAgIC8qKiBAdHlwZSB7TGlzdH0gKi9cclxuICAgICAgICB0aGlzLnJ1bkZhaWxUZXN0TGlzdCA9IG5ldyBMaXN0KCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLyoqIEB0eXBlIHtMaXN0fSAqL1xyXG4gICAgICAgIHRoaXMucnVuVGVzdEZ1bmN0aW9uTGlzdCA9IG5ldyBMaXN0KCk7XHJcblxyXG4gICAgICAgIC8qKiBAdHlwZSB7TGlzdH0gKi9cclxuICAgICAgICB0aGlzLnJ1blRlc3RDbGFzc0xpc3QgPSBuZXcgTGlzdCgpO1xyXG5cclxuICAgICAgICAvKiogQHR5cGUge051bWJlcn0gKi9cclxuICAgICAgICB0aGlzLnJ1blRlc3RGdW5jdGlvbkNvdW50ID0gMDtcclxuXHJcbiAgICAgICAgLyoqIEB0eXBlIHtOdW1iZXJ9ICovXHJcbiAgICAgICAgdGhpcy5ydW5UZXN0Q2xhc3NDb3VudCA9IDA7XHJcblxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gdGVzdE9iamVjdCBcclxuICAgICAqIEByZXR1cm5zIHtUZXN0QmVuY2h9XHJcbiAgICAgKi9cclxuICAgIGFkZFRlc3QodGVzdENsYXNzKSB7XHJcbiAgICAgICAgaWYgKCF0ZXN0Q2xhc3MudGVzdEZ1bmN0aW9ucyB8fCAhKHRlc3RDbGFzcy50ZXN0RnVuY3Rpb25zKCkgaW5zdGFuY2VvZiBMaXN0KSkge1xyXG4gICAgICAgICAgICB0aHJvdyBcIkEgc3RhdGljIGZ1bmN0aW9uIGNhbGxlZCAndGVzdEZ1bmN0aW9ucycgbXVzdCBiZSBwcm92aWRlZCBpbiBcIiBcclxuICAgICAgICAgICAgICAgICsgdGVzdENsYXNzLm5hbWUgXHJcbiAgICAgICAgICAgICAgICArIFwiIHdoaWNoIHJldHVybnMgYSBMaXN0IGFsbCB0aGUgdGVzdCBmdW5jdGlvbnMgaW4gXCJcclxuICAgICAgICAgICAgICAgICsgdGVzdENsYXNzLm5hbWUgKyBcIi5wcm90b3R5cGVcIlxyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLnRlc3RDbGFzc01hcC5zZXQodGVzdENsYXNzLm5hbWUsIHRlc3RDbGFzcyk7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcblxyXG4gICAgY29udGFpbnModGVzdENsYXNzKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMudGVzdENsYXNzTWFwLmNvbnRhaW5zKHRlc3RDbGFzcy5uYW1lKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFJ1biBhbGwgdGVzdCBjbGFzc2VzXHJcbiAgICAgKi9cclxuICAgIHJ1bigpIHtcclxuICAgICAgICBMb2dnZXIubGlzdGVuZXIgPSB0aGlzLmxvZ0xpc3RlbmVyO1xyXG4gICAgICAgIGxldCBjbGFzc05hbWVBcnJheSA9IFtdO1xyXG4gICAgICAgIHRoaXMudGVzdENsYXNzTWFwLmZvckVhY2goKGNsYXNzTmFtZSwgdGVzdENsYXNzLCBwYXJlbnQpID0+IHtcclxuICAgICAgICAgICAgdGhpcy5ydW5UZXN0Q2xhc3NMaXN0LmFkZCh0ZXN0Q2xhc3MpO1xyXG4gICAgICAgICAgICB0aGlzLnJ1blRlc3RGdW5jdGlvbkxpc3QuYWRkQWxsKHRlc3RDbGFzcy50ZXN0RnVuY3Rpb25zKCkpO1xyXG4gICAgICAgICAgICBjbGFzc05hbWVBcnJheS5wdXNoKGNsYXNzTmFtZSk7XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHRoaXMucnVuQ2xhc3NOYW1lQXQoY2xhc3NOYW1lQXJyYXksIDApO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUnVuIHRlc3QgYnkgY2xhc3MgbmFtZVxyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGNsYXNzTmFtZSBcclxuICAgICAqL1xyXG4gICAgcnVuU2luZ2xlKGNsYXNzTmFtZSkge1xyXG4gICAgICAgIExvZ2dlci5saXN0ZW5lciA9IHRoaXMubG9nTGlzdGVuZXI7XHJcbiAgICAgICAgdGhpcy5ydW5UZXN0Q2xhc3NMaXN0LmFkZCh0aGlzLnRlc3RDbGFzc01hcC5nZXQoY2xhc3NOYW1lKSk7XHJcbiAgICAgICAgdGhpcy5ydW5DbGFzc05hbWVBdChbY2xhc3NOYW1lXSwgMCk7XHJcbiAgICB9XHJcblxyXG4gICAgcnVuQ2xhc3NOYW1lQXQoY2xhc3NOYW1lQXJyYXksIGluZGV4KSB7XHJcblxyXG4gICAgICAgIGlmIChpbmRleCA+PSBjbGFzc05hbWVBcnJheS5sZW5ndGgpIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgY2xhc3NOYW1lID0gY2xhc3NOYW1lQXJyYXlbaW5kZXhdO1xyXG5cclxuICAgICAgICB0aGlzLnJ1blRlc3RDbGFzc0NvdW50Kys7XHJcblxyXG4gICAgICAgIHRoaXMucHJpbnRIZWFkZXIoY2xhc3NOYW1lKTtcclxuICAgICAgICB0aGlzLmxvYWRPYmplY3RCeUNsYXNzTmFtZShjbGFzc05hbWUpLnRoZW4oKCkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLnJ1bkZ1bmN0aW9uc0J5Q2xhc3NOYW1lKGNsYXNzTmFtZSwgKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5ydW5DbGFzc05hbWVBdChjbGFzc05hbWVBcnJheSwgaW5kZXgrMSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBsb2FkT2JqZWN0QnlDbGFzc05hbWUoY2xhc3NOYW1lKSB7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgICAgICAgY29uc3QgdGVzdENsYXNzID0gdGhpcy50ZXN0Q2xhc3NNYXAuZ2V0KGNsYXNzTmFtZSk7XHJcbiAgICAgICAgICAgIHRoaXMub2JqZWN0UHJvdmlkZXIucHJvdmlkZSh0ZXN0Q2xhc3MpLnRoZW4oKHRlc3RPYmplY3QpID0+IHtcclxuICAgICAgICAgICAgICAgIHRoaXMudGVzdE9iamVjdE1hcC5zZXQoY2xhc3NOYW1lLCB0ZXN0T2JqZWN0KTtcclxuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcclxuICAgICAgICAgICAgICAgIH0sIDEwMCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogXHJcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gY2xhc3NOYW1lIFxyXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gb25Db21wbGV0ZSBcclxuICAgICAqL1xyXG4gICAgcnVuRnVuY3Rpb25zQnlDbGFzc05hbWUoY2xhc3NOYW1lLCBvbkNvbXBsZXRlKSB7XHJcbiAgICAgICAgY29uc3QgdGVzdENsYXNzID0gdGhpcy50ZXN0Q2xhc3NNYXAuZ2V0KGNsYXNzTmFtZSk7XHJcbiAgICAgICAgY29uc3QgdGVzdEZ1bmN0aW9ucyA9IHRlc3RDbGFzcy50ZXN0RnVuY3Rpb25zKCk7XHJcbiAgICAgICAgY29uc3QgZnVuY3Rpb25BcnJheSA9IFtdO1xyXG5cclxuICAgICAgICB0ZXN0RnVuY3Rpb25zLmZvckVhY2goKHZhbHVlLCBwYXJlbnQpID0+IHtcclxuICAgICAgICAgICAgLyoqIEB0eXBlIHtGdW5jdGlvbn0gKi9cclxuICAgICAgICAgICAgY29uc3QgdGVzdEZ1bmN0aW9uID0gdmFsdWU7XHJcbiAgICAgICAgICAgIGZ1bmN0aW9uQXJyYXkucHVzaCh0ZXN0RnVuY3Rpb24pO1xyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgaWYgKGZ1bmN0aW9uQXJyYXkubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICB0aGlzLnJ1bkZ1bmN0aW9uQXQodGVzdENsYXNzLCBmdW5jdGlvbkFycmF5LCAwLCBvbkNvbXBsZXRlKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBcclxuICAgICAqIEBwYXJhbSB7QXJyYXl9IGZ1bmN0aW9uQXJyYXkgXHJcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gaW5kZXggXHJcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBvbkNvbXBsZXRlXHJcbiAgICAgKi9cclxuICAgIHJ1bkZ1bmN0aW9uQXQodGVzdENsYXNzLCBmdW5jdGlvbkFycmF5LCBpbmRleCwgb25Db21wbGV0ZSkge1xyXG4gICAgICAgIGlmIChmdW5jdGlvbkFycmF5Lmxlbmd0aCA8PSBpbmRleCkge1xyXG4gICAgICAgICAgICBvbkNvbXBsZXRlLmNhbGwoKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBjb25zdCB0ZXN0T2JqZWN0ID0gdGhpcy50ZXN0T2JqZWN0TWFwLmdldCh0ZXN0Q2xhc3MubmFtZSk7XHJcbiAgICAgICAgY29uc3QgdGVzdEZ1bmN0aW9uID0gZnVuY3Rpb25BcnJheVtpbmRleF07XHJcblxyXG4gICAgICAgIC8qKiBAdHlwZSB7UHJvbWlzZX0gKi9cclxuICAgICAgICBsZXQgdGVzdEZ1bmN0aW9uUmVzdWx0ID0gbnVsbDtcclxuXHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgdGVzdEZ1bmN0aW9uUmVzdWx0ID0gdGVzdEZ1bmN0aW9uLmNhbGwodGVzdE9iamVjdCk7XHJcbiAgICAgICAgICAgIGlmICghKHRlc3RGdW5jdGlvblJlc3VsdCBpbnN0YW5jZW9mIFByb21pc2UpKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnJ1blRlc3RGdW5jdGlvbkNvdW50ICsrO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5yZXBvcnRTdWNjZXNzKHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uKTtcclxuICAgICAgICAgICAgICAgIHRoaXMucnVuRnVuY3Rpb25BdCh0ZXN0Q2xhc3MsIGZ1bmN0aW9uQXJyYXksIGluZGV4KzEsIG9uQ29tcGxldGUpO1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0gY2F0Y2ggKGV4Y2VwdGlvbikge1xyXG4gICAgICAgICAgICB0aGlzLnJ1blRlc3RGdW5jdGlvbkNvdW50ICsrO1xyXG4gICAgICAgICAgICB0aGlzLnJlcG9ydEZhaWx1cmUodGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24sIGV4Y2VwdGlvbik7XHJcbiAgICAgICAgICAgIHRoaXMucnVuRnVuY3Rpb25BdCh0ZXN0Q2xhc3MsIGZ1bmN0aW9uQXJyYXksIGluZGV4KzEsIG9uQ29tcGxldGUpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKCEodGVzdEZ1bmN0aW9uUmVzdWx0IGluc3RhbmNlb2YgUHJvbWlzZSkpIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGVzdEZ1bmN0aW9uUmVzdWx0LnRoZW4oKCkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLnJ1blRlc3RGdW5jdGlvbkNvdW50ICsrO1xyXG4gICAgICAgICAgICB0aGlzLnJlcG9ydFN1Y2Nlc3ModGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24pO1xyXG4gICAgICAgICAgICB0aGlzLnJ1bkZ1bmN0aW9uQXQodGVzdENsYXNzLCBmdW5jdGlvbkFycmF5LCBpbmRleCsxLCBvbkNvbXBsZXRlKTtcclxuXHJcbiAgICAgICAgfSkuY2F0Y2goKGV4Y2VwdGlvbikgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLnJ1blRlc3RGdW5jdGlvbkNvdW50ICsrO1xyXG4gICAgICAgICAgICB0aGlzLnJlcG9ydEZhaWx1cmUodGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24sIGV4Y2VwdGlvbik7XHJcbiAgICAgICAgICAgIHRoaXMucnVuRnVuY3Rpb25BdCh0ZXN0Q2xhc3MsIGZ1bmN0aW9uQXJyYXksIGluZGV4KzEsIG9uQ29tcGxldGUpO1xyXG5cclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICByZXBvcnRGYWlsdXJlKHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uLCBleGNlcHRpb24pIHtcclxuICAgICAgICB0aGlzLmFkZEZhaWwodGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24pO1xyXG4gICAgICAgIHRoaXMuY2FsbFJlc3VsdExpc3RlbmVyKHRlc3RDbGFzcywgdHJ1ZSk7XHJcbiAgICAgICAgTE9HLmVycm9yKHRoaXMuc2lnbmF0dXJlKHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uKSArIFwiIGZhaWxlZC4gUmVhc29uOlwiKTtcclxuICAgICAgICBMT0cuZXJyb3IoZXhjZXB0aW9uKTtcclxuICAgICAgICBMT0cuZXJyb3IoXCJcIik7XHJcbiAgICAgICAgdGhpcy50cnlDbG9zZSgpO1xyXG4gICAgfVxyXG5cclxuICAgIHJlcG9ydFN1Y2Nlc3ModGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24pIHtcclxuICAgICAgICB0aGlzLmFkZFN1Y2Nlc3ModGVzdENsYXNzLCB0ZXN0RnVuY3Rpb24pO1xyXG4gICAgICAgIHRoaXMuY2FsbFJlc3VsdExpc3RlbmVyKHRlc3RDbGFzcywgZmFsc2UpO1xyXG4gICAgICAgIHRoaXMudHJ5Q2xvc2UoKTtcclxuICAgIH1cclxuXHJcbiAgICBjYWxsUmVzdWx0TGlzdGVuZXIodGVzdENsYXNzLCBmYWlsZWQpIHtcclxuICAgICAgICBpZiAoIXRoaXMucmVzdWx0TGlzdGVuZXIpIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjb25zdCByZXN1bHQgPSBmYWlsZWQgPyBUZXN0Q2xhc3NSZXN1bHQuRkFJTCA6IFRlc3RDbGFzc1Jlc3VsdC5TVUNDRVNTO1xyXG4gICAgICAgIHRoaXMucmVzdWx0TGlzdGVuZXIuY2FsbChuZXcgVGVzdENsYXNzUmVzdWx0KHRlc3RDbGFzcy5uYW1lLCByZXN1bHQpKTtcclxuICAgIH1cclxuXHJcbiAgICBhZGRTdWNjZXNzKHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uKSB7XHJcbiAgICAgICAgdGhpcy5ydW5TdWNjZXNzVGVzdExpc3QuYWRkKHRoaXMuc2lnbmF0dXJlKHRlc3RDbGFzcywgdGVzdEZ1bmN0aW9uKSk7XHJcbiAgICB9XHJcblxyXG4gICAgYWRkRmFpbCh0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbikge1xyXG4gICAgICAgIHRoaXMucnVuRmFpbFRlc3RMaXN0LmFkZCh0aGlzLnNpZ25hdHVyZSh0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbikpO1xyXG4gICAgfVxyXG5cclxuICAgIHNpZ25hdHVyZSh0ZXN0Q2xhc3MsIHRlc3RGdW5jdGlvbikge1xyXG4gICAgICAgIHJldHVybiB0ZXN0Q2xhc3MubmFtZSArIFwiLlwiICsgdGVzdEZ1bmN0aW9uLm5hbWUgKyBcIigpXCI7XHJcbiAgICB9XHJcblxyXG4gICAgdHJ5Q2xvc2UoKSB7XHJcbiAgICAgICAgaWYgKHRoaXMucnVuVGVzdEZ1bmN0aW9uTGlzdC5zaXplKCkgPD0gdGhpcy5ydW5UZXN0RnVuY3Rpb25Db3VudCAmJiB0aGlzLnJ1blRlc3RDbGFzc0xpc3Quc2l6ZSgpIDw9IHRoaXMucnVuVGVzdENsYXNzQ291bnQpIHtcclxuICAgICAgICAgICAgdGhpcy5jbG9zZSgpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBjbG9zZSgpIHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICB0aGlzLnByaW50UmVwb3J0KCk7XHJcbiAgICAgICAgfSBmaW5hbGx5IHtcclxuICAgICAgICAgICAgdGhpcy5yZXNldCgpO1xyXG4gICAgICAgICAgICBMb2dnZXIuY2xlYXJMaXN0ZW5lcigpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcmludEhlYWRlcih0ZXN0TmFtZSkge1xyXG4gICAgICAgIGNvbnN0IGxpbmUgPSBcIiMgIFJ1bm5pbmcgdGVzdDogXCIgKyB0ZXN0TmFtZSArIFwiICAjXCI7XHJcbiAgICAgICAgbGV0IGRlY29yYXRpb24gPSBcIlwiO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGluZS5sZW5ndGggOyBpKyspIHtcclxuICAgICAgICAgICAgZGVjb3JhdGlvbiA9IGRlY29yYXRpb24gKyBcIiNcIjtcclxuICAgICAgICB9XHJcbiAgICAgICAgTE9HLmluZm8oZGVjb3JhdGlvbik7XHJcbiAgICAgICAgTE9HLmluZm8obGluZSk7XHJcbiAgICAgICAgTE9HLmluZm8oZGVjb3JhdGlvbik7XHJcbiAgICAgICAgTE9HLmluZm8oXCJcIik7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpbnRSZXBvcnQoKSB7XHJcbiAgICAgICAgTE9HLmluZm8oXCIjIyMjIyMjIyMjIyMjIyMjIyMjXCIpO1xyXG4gICAgICAgIExPRy5pbmZvKFwiIyAgIFRlc3QgUmVwb3J0ICAgI1wiKTtcclxuICAgICAgICBMT0cuaW5mbyhcIiMjIyMjIyMjIyMjIyMjIyMjIyNcIik7XHJcbiAgICAgICAgTE9HLmluZm8oXCJcIik7XHJcblxyXG4gICAgICAgIGxldCBzdWNjZXNzQ291bnRlciA9IDA7XHJcbiAgICAgICAgaWYgKHRoaXMucnVuU3VjY2Vzc1Rlc3RMaXN0LnNpemUoKSA+IDApe1xyXG4gICAgICAgICAgICBMT0cuaW5mbyhcIlN1Y2NlZWRlZDpcIik7XHJcbiAgICAgICAgICAgIHRoaXMucnVuU3VjY2Vzc1Rlc3RMaXN0LmZvckVhY2goKHZhbHVlLHBhcmVudCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgTE9HLmluZm8oc3VjY2Vzc0NvdW50ZXIrKyArIFwiLiBcIiArIHZhbHVlKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgTE9HLmluZm8oXCJcIik7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgZmFpbENvdW50ZXIgPSAwO1xyXG4gICAgICAgIGlmICh0aGlzLnJ1bkZhaWxUZXN0TGlzdC5zaXplKCkgPiAwKXtcclxuICAgICAgICAgICAgTE9HLmluZm8oXCJGYWlsZWQ6XCIpO1xyXG4gICAgICAgICAgICB0aGlzLnJ1bkZhaWxUZXN0TGlzdC5mb3JFYWNoKCh2YWx1ZSxwYXJlbnQpID0+IHtcclxuICAgICAgICAgICAgICAgIExPRy5pbmZvKGZhaWxDb3VudGVyKysgKyBcIi4gXCIgKyB2YWx1ZSk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIExPRy5pbmZvKFwiXCIpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKGZhaWxDb3VudGVyICE9IDApIHtcclxuICAgICAgICAgICAgdGhyb3cgdGhpcy5ydW5GYWlsVGVzdExpc3Quc2l6ZSgpICsgXCIgVGVzdHMgZmFpbGVkXCI7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHJlc2V0KCkge1xyXG4gICAgICAgIHRoaXMucnVuRmFpbFRlc3RMaXN0ID0gbmV3IExpc3QoKTtcclxuICAgICAgICB0aGlzLnJ1blN1Y2Nlc3NUZXN0TGlzdCA9IG5ldyBMaXN0KCk7XHJcblxyXG4gICAgICAgIHRoaXMucnVuVGVzdEZ1bmN0aW9uTGlzdCA9IG5ldyBMaXN0KCk7XHJcbiAgICAgICAgdGhpcy5ydW5UZXN0Q2xhc3NMaXN0ID0gbmV3IExpc3QoKTtcclxuXHJcbiAgICAgICAgdGhpcy5ydW5UZXN0RnVuY3Rpb25Db3VudCA9IDA7XHJcbiAgICAgICAgdGhpcy5ydW5UZXN0Q2xhc3NDb3VudCA9IDA7XHJcbiAgICB9XHJcbn0iXSwibmFtZXMiOlsiTE9HIl0sIm1hcHBpbmdzIjoiOztBQUFPLE1BQU0sYUFBYSxDQUFDO0FBQzNCO0FBQ0EsSUFBSSxPQUFPLFVBQVUsQ0FBQyxPQUFPLEdBQUcsSUFBSSxFQUFFO0FBQ3RDLFFBQVEsR0FBRyxPQUFPLEVBQUU7QUFDcEIsWUFB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
