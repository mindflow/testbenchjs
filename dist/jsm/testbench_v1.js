import { Logger, Map, List } from './coreutil_v1.js'

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

        /** @type {List} */
        this.successTestMap = new List();

        /** @type {List} */
        this.failTestMap = new List();

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

    loadObjectByClassName(className) {
        return new Promise((resolve, reject) => {
            const testClass = this.testClassMap.get(className);
            this.objectProvider.provide(testClass).then((testObject) => {
                this.testObjectMap.set(className, testObject);
                resolve();
            });
        });
    }

    runFunctionsByClassName(className) {
        const testClass = this.testClassMap.get(className);

        /** @type {List} */
        const testFunctions = testClass.testFunctions();

        const testObject = this.testObjectMap.get(className);
        let failed = this.runFunctions(testFunctions, testClass, testObject);

        if (this.resultListener) {
            this.callResultListener(className, failed);
        }
    }

    runFunctions(testFunctions, testClass, testObject) {
        let failed = false;
        testFunctions.forEach((value, parent) => {
            /** @type {Function} */
            const testFunction = value;
            try {
                testFunction.call(testObject);
                this.successTestMap.add(testClass.name + "." + testFunction.name + "()");
            } catch (exception) {
                failed = true;
                LOG.error("Test: " + testClass.name + "." + testFunction.name + "() failed. Reason:");
                LOG.error(exception);
                LOG.error("");
                this.failTestMap.add(testClass.name + "." + testFunction.name + "()");
            }
            return true;
        });
        return failed;
    }

    callResultListener(className, failed) {
        if (failed) {
            this.resultListener.call(new TestClassResult(className, TestClassResult.FAIL));
        } else {
            this.resultListener.call(new TestClassResult(className, TestClassResult.SUCCESS));
        }
    }

    /**
     * Run test by class name
     * @param {string} className 
     */
    runSingle(className) {
        Logger.listener = this.logListener;
        this.printHeader(className);
        this.loadObjectByClassName(className).then(() => {
            this.runFunctionsByClassName(className);
            this.close();
        });
    }

    /**
     * Run all test classes
     */
    run() {
        Logger.listener = this.logListener;

        let classNameArray = [];
        this.testClassMap.forEach((key, value, parent) => {
            classNameArray.push(key);
            return true;
        });
        this.runClassNameAt(classNameArray, 0);
    }

    runClassNameAt(classNameArray, index) {
        // No more classNames to run
        if (index >= classNameArray.length) {
            this.close();
            return;
        }

        const className = classNameArray[index];
        this.printHeader(className);
        this.loadObjectByClassName(className).then(() => {
            this.runFunctionsByClassName(className);
            this.runClassNameAt(classNameArray, index+1);
        });
    }

    close() {
        try {
            this.printReport();
        } finally {
            this.reset();
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

    printReport() {
        LOG.info("###################");
        LOG.info("#   Test Report   #");
        LOG.info("###################");
        LOG.info("");

        LOG.info("Succeeded:");
        let successCounter = 0;
        this.successTestMap.forEach((value,parent) => {
            LOG.info(successCounter++ + ". " + value);
            return true;
        });
        LOG.info("");

        LOG.info("Failed:");
        let failCounter = 0;
        this.failTestMap.forEach((value,parent) => {
            LOG.info(failCounter++ + ". " + value);
            return true;
        });
        LOG.info("");

        if (failCounter != 0) {
            throw this.failTestMap.size() + " Tests failed";
        }
    }

    reset() {
        this.failTestMap = new List();
        this.successTestMap = new List();
    }
}

export { AssertString, ObjectProvider, TestBench, TestClassResult, TestTrigger };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdGJlbmNoX3YxLmpzIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdGVzdGJlbmNoL2Fzc2VydGlvbnMvYXNzZXJ0U3RyaW5nLmpzIiwiLi4vLi4vc3JjL3Rlc3RiZW5jaC9vYmplY3RQcm92aWRlci5qcyIsIi4uLy4uL3NyYy90ZXN0YmVuY2gvdGVzdENsYXNzUmVzdWx0LmpzIiwiLi4vLi4vc3JjL3Rlc3RiZW5jaC90ZXN0VHJpZ2dlci5qcyIsIi4uLy4uL3NyYy90ZXN0YmVuY2gvdGVzdEJlbmNoLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBjbGFzcyBBc3NlcnRTdHJpbmcge1xyXG5cclxuICAgIHN0YXRpYyBhc3NlcnRFcXVhbHMoZXhwZWN0ZWQsIGFjdHVhbCkge1xyXG4gICAgICAgIGlmIChleHBlY3RlZCA9PT0gYWN0dWFsKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhyb3cgXCJTdHJpbmcgQXNzZXJ0aW9uIEZhaWxlZC4gRXhwZWN0ZWQ6ICdcIiArIGV4cGVjdGVkICsgXCInIEFjdHVhbDogJ1wiICsgYWN0dWFsICsgXCInXCI7XHJcbiAgICB9XHJcblxyXG59IiwiZXhwb3J0IGNsYXNzIE9iamVjdFByb3ZpZGVyIHtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcigpIHtcclxuXHJcbiAgICB9XHJcblxyXG4gICAgcHJvdmlkZSh0aGVDbGFzcywgYXJncyA9IFtdKSB7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgICAgICAgcmVzb2x2ZShuZXcgdGhlQ2xhc3MoLi4uYXJncykpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxufSIsImV4cG9ydCBjbGFzcyBUZXN0Q2xhc3NSZXN1bHQge1xyXG5cclxuICAgIHN0YXRpYyBnZXQgU1VDQ0VTUygpIHsgcmV0dXJuIDE7IH1cclxuICAgIHN0YXRpYyBnZXQgRkFJTCgpIHsgcmV0dXJuIDA7IH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFxyXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IGNsYXNzTmFtZSBcclxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSByZXN1bHQgXHJcbiAgICAgKi9cclxuICAgIGNvbnN0cnVjdG9yKGNsYXNzTmFtZSwgcmVzdWx0KSB7XHJcblxyXG4gICAgICAgIC8qKiBAdHlwZSB7U3RyaW5nfSAqL1xyXG4gICAgICAgIHRoaXMuY2xhc3NOYW1lID0gY2xhc3NOYW1lO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8qKiBAdHlwZSB7U3RyaW5nfSAqL1xyXG4gICAgICAgIHRoaXMucmVzdWx0ID0gcmVzdWx0O1xyXG4gICAgfVxyXG59IiwiZXhwb3J0IGNsYXNzIFRlc3RUcmlnZ2VyIHtcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgKiBSdW4gdGVzdCBieSBjbGFzcyBuYW1lXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY2xhc3NOYW1lIFxyXG4gICAgICovXHJcbiAgICBydW5TaW5nbGUoY2xhc3NOYW1lKSB7XHJcblxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUnVuIGFsbCB0ZXN0IGNsYXNzZXNcclxuICAgICAqL1xyXG4gICAgcnVuKCkge1xyXG4gICAgICAgIFxyXG4gICAgfVxyXG59IiwiaW1wb3J0IHsgTGlzdCwgTG9nZ2VyLCBNYXAsIE9iamVjdEZ1bmN0aW9uIH0gZnJvbSBcImNvcmV1dGlsX3YxXCI7XHJcbmltcG9ydCB7IE9iamVjdFByb3ZpZGVyIH0gZnJvbSBcIi4vb2JqZWN0UHJvdmlkZXIuanNcIjtcclxuaW1wb3J0IHsgVGVzdENsYXNzUmVzdWx0IH0gZnJvbSBcIi4vdGVzdENsYXNzUmVzdWx0LmpzXCI7XHJcbmltcG9ydCB7IFRlc3RUcmlnZ2VyIH0gZnJvbSBcIi4vdGVzdFRyaWdnZXIuanNcIjtcclxuXHJcbmNvbnN0IExPRyA9IG5ldyBMb2dnZXIoXCJUZXN0QmVuY2hcIik7XHJcblxyXG5leHBvcnQgY2xhc3MgVGVzdEJlbmNoIGV4dGVuZHMgVGVzdFRyaWdnZXIge1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdEZ1bmN0aW9ufSBsb2dMaXN0ZW5lciBcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0RnVuY3Rpb259IHJlc3VsdExpc3RlbmVyIFxyXG4gICAgICogQHBhcmFtIHtPYmplY3RQcm92aWRlcn0gb2JqZWN0UHJvdmlkZXJcclxuICAgICAqL1xyXG4gICAgY29uc3RydWN0b3IobG9nTGlzdGVuZXIgPSBudWxsLFxyXG4gICAgICAgICAgICByZXN1bHRMaXN0ZW5lciA9IG51bGwsIFxyXG4gICAgICAgICAgICBvYmplY3RQcm92aWRlciA9IG5ldyBPYmplY3RQcm92aWRlcigpKSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgc3VwZXIoKTtcclxuXHJcbiAgICAgICAgLyoqIEB0eXBlIHtPYmplY3RGdW5jdGlvbn0gKi9cclxuICAgICAgICB0aGlzLmxvZ0xpc3RlbmVyID0gbG9nTGlzdGVuZXI7XHJcblxyXG4gICAgICAgIC8qKiBAdHlwZSB7T2JqZWN0RnVuY3Rpb259ICovXHJcbiAgICAgICAgdGhpcy5yZXN1bHRMaXN0ZW5lciA9IHJlc3VsdExpc3RlbmVyO1xyXG5cclxuICAgICAgICAvKiogQHR5cGUge01hcH0gKi9cclxuICAgICAgICB0aGlzLnRlc3RDbGFzc01hcCA9IG5ldyBNYXAoKTtcclxuXHJcbiAgICAgICAgLyoqIEB0eXBlIHtNYXB9ICovXHJcbiAgICAgICAgdGhpcy50ZXN0T2JqZWN0TWFwID0gbmV3IE1hcCgpO1xyXG5cclxuICAgICAgICAvKiogQHR5cGUge0xpc3R9ICovXHJcbiAgICAgICAgdGhpcy5zdWNjZXNzVGVzdE1hcCA9IG5ldyBMaXN0KCk7XHJcblxyXG4gICAgICAgIC8qKiBAdHlwZSB7TGlzdH0gKi9cclxuICAgICAgICB0aGlzLmZhaWxUZXN0TWFwID0gbmV3IExpc3QoKTtcclxuXHJcbiAgICAgICAgLyoqIEB0eXBlIHtPYmplY3RQcm92aWRlcn0gKi9cclxuICAgICAgICB0aGlzLm9iamVjdFByb3ZpZGVyID0gb2JqZWN0UHJvdmlkZXI7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSB0ZXN0T2JqZWN0IFxyXG4gICAgICogQHJldHVybnMge1Rlc3RCZW5jaH1cclxuICAgICAqL1xyXG4gICAgYWRkVGVzdCh0ZXN0Q2xhc3MpIHtcclxuICAgICAgICBpZiAoIXRlc3RDbGFzcy50ZXN0RnVuY3Rpb25zIHx8ICEodGVzdENsYXNzLnRlc3RGdW5jdGlvbnMoKSBpbnN0YW5jZW9mIExpc3QpKSB7XHJcbiAgICAgICAgICAgIHRocm93IFwiQSBzdGF0aWMgZnVuY3Rpb24gY2FsbGVkICd0ZXN0RnVuY3Rpb25zJyBtdXN0IGJlIHByb3ZpZGVkIGluIFwiIFxyXG4gICAgICAgICAgICAgICAgKyB0ZXN0Q2xhc3MubmFtZSBcclxuICAgICAgICAgICAgICAgICsgXCIgd2hpY2ggcmV0dXJucyBhIExpc3QgYWxsIHRoZSB0ZXN0IGZ1bmN0aW9ucyBpbiBcIlxyXG4gICAgICAgICAgICAgICAgKyB0ZXN0Q2xhc3MubmFtZSArIFwiLnByb3RvdHlwZVwiXHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMudGVzdENsYXNzTWFwLnNldCh0ZXN0Q2xhc3MubmFtZSwgdGVzdENsYXNzKTtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxuXHJcbiAgICBjb250YWlucyh0ZXN0Q2xhc3MpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy50ZXN0Q2xhc3NNYXAuY29udGFpbnModGVzdENsYXNzLm5hbWUpO1xyXG4gICAgfVxyXG5cclxuICAgIGxvYWRPYmplY3RCeUNsYXNzTmFtZShjbGFzc05hbWUpIHtcclxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCB0ZXN0Q2xhc3MgPSB0aGlzLnRlc3RDbGFzc01hcC5nZXQoY2xhc3NOYW1lKTtcclxuICAgICAgICAgICAgdGhpcy5vYmplY3RQcm92aWRlci5wcm92aWRlKHRlc3RDbGFzcykudGhlbigodGVzdE9iamVjdCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgdGhpcy50ZXN0T2JqZWN0TWFwLnNldChjbGFzc05hbWUsIHRlc3RPYmplY3QpO1xyXG4gICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBydW5GdW5jdGlvbnNCeUNsYXNzTmFtZShjbGFzc05hbWUpIHtcclxuICAgICAgICBjb25zdCB0ZXN0Q2xhc3MgPSB0aGlzLnRlc3RDbGFzc01hcC5nZXQoY2xhc3NOYW1lKTtcclxuXHJcbiAgICAgICAgLyoqIEB0eXBlIHtMaXN0fSAqL1xyXG4gICAgICAgIGNvbnN0IHRlc3RGdW5jdGlvbnMgPSB0ZXN0Q2xhc3MudGVzdEZ1bmN0aW9ucygpO1xyXG5cclxuICAgICAgICBjb25zdCB0ZXN0T2JqZWN0ID0gdGhpcy50ZXN0T2JqZWN0TWFwLmdldChjbGFzc05hbWUpO1xyXG4gICAgICAgIGxldCBmYWlsZWQgPSB0aGlzLnJ1bkZ1bmN0aW9ucyh0ZXN0RnVuY3Rpb25zLCB0ZXN0Q2xhc3MsIHRlc3RPYmplY3QpO1xyXG5cclxuICAgICAgICBpZiAodGhpcy5yZXN1bHRMaXN0ZW5lcikge1xyXG4gICAgICAgICAgICB0aGlzLmNhbGxSZXN1bHRMaXN0ZW5lcihjbGFzc05hbWUsIGZhaWxlZCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHJ1bkZ1bmN0aW9ucyh0ZXN0RnVuY3Rpb25zLCB0ZXN0Q2xhc3MsIHRlc3RPYmplY3QpIHtcclxuICAgICAgICBsZXQgZmFpbGVkID0gZmFsc2U7XHJcbiAgICAgICAgdGVzdEZ1bmN0aW9ucy5mb3JFYWNoKCh2YWx1ZSwgcGFyZW50KSA9PiB7XHJcbiAgICAgICAgICAgIC8qKiBAdHlwZSB7RnVuY3Rpb259ICovXHJcbiAgICAgICAgICAgIGNvbnN0IHRlc3RGdW5jdGlvbiA9IHZhbHVlO1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgdGVzdEZ1bmN0aW9uLmNhbGwodGVzdE9iamVjdCk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnN1Y2Nlc3NUZXN0TWFwLmFkZCh0ZXN0Q2xhc3MubmFtZSArIFwiLlwiICsgdGVzdEZ1bmN0aW9uLm5hbWUgKyBcIigpXCIpO1xyXG4gICAgICAgICAgICB9IGNhdGNoIChleGNlcHRpb24pIHtcclxuICAgICAgICAgICAgICAgIGZhaWxlZCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICBMT0cuZXJyb3IoXCJUZXN0OiBcIiArIHRlc3RDbGFzcy5uYW1lICsgXCIuXCIgKyB0ZXN0RnVuY3Rpb24ubmFtZSArIFwiKCkgZmFpbGVkLiBSZWFzb246XCIpO1xyXG4gICAgICAgICAgICAgICAgTE9HLmVycm9yKGV4Y2VwdGlvbik7XHJcbiAgICAgICAgICAgICAgICBMT0cuZXJyb3IoXCJcIik7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmZhaWxUZXN0TWFwLmFkZCh0ZXN0Q2xhc3MubmFtZSArIFwiLlwiICsgdGVzdEZ1bmN0aW9uLm5hbWUgKyBcIigpXCIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHJldHVybiBmYWlsZWQ7XHJcbiAgICB9XHJcblxyXG4gICAgY2FsbFJlc3VsdExpc3RlbmVyKGNsYXNzTmFtZSwgZmFpbGVkKSB7XHJcbiAgICAgICAgaWYgKGZhaWxlZCkge1xyXG4gICAgICAgICAgICB0aGlzLnJlc3VsdExpc3RlbmVyLmNhbGwobmV3IFRlc3RDbGFzc1Jlc3VsdChjbGFzc05hbWUsIFRlc3RDbGFzc1Jlc3VsdC5GQUlMKSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5yZXN1bHRMaXN0ZW5lci5jYWxsKG5ldyBUZXN0Q2xhc3NSZXN1bHQoY2xhc3NOYW1lLCBUZXN0Q2xhc3NSZXN1bHQuU1VDQ0VTUykpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFJ1biB0ZXN0IGJ5IGNsYXNzIG5hbWVcclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBjbGFzc05hbWUgXHJcbiAgICAgKi9cclxuICAgIHJ1blNpbmdsZShjbGFzc05hbWUpIHtcclxuICAgICAgICBMb2dnZXIubGlzdGVuZXIgPSB0aGlzLmxvZ0xpc3RlbmVyO1xyXG4gICAgICAgIHRoaXMucHJpbnRIZWFkZXIoY2xhc3NOYW1lKTtcclxuICAgICAgICB0aGlzLmxvYWRPYmplY3RCeUNsYXNzTmFtZShjbGFzc05hbWUpLnRoZW4oKCkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLnJ1bkZ1bmN0aW9uc0J5Q2xhc3NOYW1lKGNsYXNzTmFtZSk7XHJcbiAgICAgICAgICAgIHRoaXMuY2xvc2UoKTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFJ1biBhbGwgdGVzdCBjbGFzc2VzXHJcbiAgICAgKi9cclxuICAgIHJ1bigpIHtcclxuICAgICAgICBMb2dnZXIubGlzdGVuZXIgPSB0aGlzLmxvZ0xpc3RlbmVyO1xyXG4gICAgICAgIGNvbnN0IGxvYWRPYmplY3RCeUNsYXNzTmFtZVByb21pc2VzID0gW107XHJcblxyXG4gICAgICAgIGxldCBjbGFzc05hbWVBcnJheSA9IFtdO1xyXG4gICAgICAgIHRoaXMudGVzdENsYXNzTWFwLmZvckVhY2goKGtleSwgdmFsdWUsIHBhcmVudCkgPT4ge1xyXG4gICAgICAgICAgICBjbGFzc05hbWVBcnJheS5wdXNoKGtleSk7XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHRoaXMucnVuQ2xhc3NOYW1lQXQoY2xhc3NOYW1lQXJyYXksIDApO1xyXG4gICAgfVxyXG5cclxuICAgIHJ1bkNsYXNzTmFtZUF0KGNsYXNzTmFtZUFycmF5LCBpbmRleCkge1xyXG4gICAgICAgIC8vIE5vIG1vcmUgY2xhc3NOYW1lcyB0byBydW5cclxuICAgICAgICBpZiAoaW5kZXggPj0gY2xhc3NOYW1lQXJyYXkubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgIHRoaXMuY2xvc2UoKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgY2xhc3NOYW1lID0gY2xhc3NOYW1lQXJyYXlbaW5kZXhdO1xyXG4gICAgICAgIHRoaXMucHJpbnRIZWFkZXIoY2xhc3NOYW1lKTtcclxuICAgICAgICB0aGlzLmxvYWRPYmplY3RCeUNsYXNzTmFtZShjbGFzc05hbWUpLnRoZW4oKCkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLnJ1bkZ1bmN0aW9uc0J5Q2xhc3NOYW1lKGNsYXNzTmFtZSk7XHJcbiAgICAgICAgICAgIHRoaXMucnVuQ2xhc3NOYW1lQXQoY2xhc3NOYW1lQXJyYXksIGluZGV4KzEpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGNsb3NlKCkge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIHRoaXMucHJpbnRSZXBvcnQoKTtcclxuICAgICAgICB9IGZpbmFsbHkge1xyXG4gICAgICAgICAgICB0aGlzLnJlc2V0KCk7XHJcbiAgICAgICAgICAgIExvZ2dlci5jbGVhckxpc3RlbmVyKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaW50SGVhZGVyKHRlc3ROYW1lKSB7XHJcbiAgICAgICAgY29uc3QgbGluZSA9IFwiIyAgUnVubmluZyB0ZXN0OiBcIiArIHRlc3ROYW1lICsgXCIgICNcIjtcclxuICAgICAgICBsZXQgZGVjb3JhdGlvbiA9IFwiXCI7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW5lLmxlbmd0aCA7IGkrKykge1xyXG4gICAgICAgICAgICBkZWNvcmF0aW9uID0gZGVjb3JhdGlvbiArIFwiI1wiO1xyXG4gICAgICAgIH1cclxuICAgICAgICBMT0cuaW5mbyhkZWNvcmF0aW9uKTtcclxuICAgICAgICBMT0cuaW5mbyhsaW5lKTtcclxuICAgICAgICBMT0cuaW5mbyhkZWNvcmF0aW9uKTtcclxuICAgICAgICBMT0cuaW5mbyhcIlwiKTtcclxuICAgIH1cclxuXHJcbiAgICBwcmludFJlcG9ydCgpIHtcclxuICAgICAgICBMT0cuaW5mbyhcIiMjIyMjIyMjIyMjIyMjIyMjIyNcIik7XHJcbiAgICAgICAgTE9HLmluZm8oXCIjICAgVGVzdCBSZXBvcnQgICAjXCIpO1xyXG4gICAgICAgIExPRy5pbmZvKFwiIyMjIyMjIyMjIyMjIyMjIyMjI1wiKTtcclxuICAgICAgICBMT0cuaW5mbyhcIlwiKTtcclxuXHJcbiAgICAgICAgTE9HLmluZm8oXCJTdWNjZWVkZWQ6XCIpO1xyXG4gICAgICAgIGxldCBzdWNjZXNzQ291bnRlciA9IDA7XHJcbiAgICAgICAgdGhpcy5zdWNjZXNzVGVzdE1hcC5mb3JFYWNoKCh2YWx1ZSxwYXJlbnQpID0+IHtcclxuICAgICAgICAgICAgTE9HLmluZm8oc3VjY2Vzc0NvdW50ZXIrKyArIFwiLiBcIiArIHZhbHVlKTtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgTE9HLmluZm8oXCJcIik7XHJcblxyXG4gICAgICAgIExPRy5pbmZvKFwiRmFpbGVkOlwiKTtcclxuICAgICAgICBsZXQgZmFpbENvdW50ZXIgPSAwO1xyXG4gICAgICAgIHRoaXMuZmFpbFRlc3RNYXAuZm9yRWFjaCgodmFsdWUscGFyZW50KSA9PiB7XHJcbiAgICAgICAgICAgIExPRy5pbmZvKGZhaWxDb3VudGVyKysgKyBcIi4gXCIgKyB2YWx1ZSk7XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIExPRy5pbmZvKFwiXCIpO1xyXG5cclxuICAgICAgICBpZiAoZmFpbENvdW50ZXIgIT0gMCkge1xyXG4gICAgICAgICAgICB0aHJvdyB0aGlzLmZhaWxUZXN0TWFwLnNpemUoKSArIFwiIFRlc3RzIGZhaWxlZFwiO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICByZXNldCgpIHtcclxuICAgICAgICB0aGlzLmZhaWxUZXN0TWFwID0gbmV3IExpc3QoKTtcclxuICAgICAgICB0aGlzLnN1Y2Nlc3NUZXN0TWFwID0gbmV3IExpc3QoKTtcclxuICAgIH1cclxufSJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFPLE1BQU0sWUFBWSxDQUFDO0FBQzFCO0FBQ0EsSUFBSSxPQUFPLFlBQVksQ0FBQyxRQUFRLEVBQUUsTUFBTSxFQUFFO0FBQzFDLFFBQVEsSUFBSSxRQUFRLEtBQUssTUFBTSxFQUFFO0FBQ2pDLFlBQVksT0FBTztBQUNuQixTQUFTO0FBQ1QsUUFBUSxNQUFNLHNDQUFzQyxHQUFHLFFBQVEsR0FBRyxhQUFhLEdBQUcsTUFBTSxHQUFHLEdBQUcsQ0FBQztBQUMvRixLQUFLO0FBQ0w7QUFDQTs7QUNUTyxNQUFNLGNBQWMsQ0FBQztBQUM1QjtBQUNBLElBQUksV0FBVyxHQUFHO0FBQ2xCO0FBQ0EsS0FBSztBQUNMO0FBQ0EsSUFBSSxPQUFPLENBQUMsUUFBUSxFQUFFLElBQUksR0FBRyxFQUFFLEVBQUU7QUFDakMsUUFBUSxPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLE1BQU0sS0FBSztBQUNoRCxZQUFZLE9BQU8sQ0FBQyxJQUFJLFFBQVEsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUM7QUFDM0MsU0FBUyxDQUFDLENBQUM7QUFDWCxLQUFLO0FBQ0w7QUFDQTs7Q0FBQyxLQ1pZLGVBQWUsQ0FBQztBQUM3QjtBQUNBLElBQUksV0FBVyxPQUFPLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQyxFQUFFO0FBQ3RDLElBQUksV0FBVyxJQUFJLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQyxFQUFFO0FBQ25DO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7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
