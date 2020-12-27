import { Logger, Map, List } from './coreutil_v1.js'

class AssertString {

    static assertEquals(expected, actual) {
        if (expected === actual) {
            return;
        }
        throw "String Assertion Failed. Expected: '" + expected + "' Actual: '" + actual + "'";
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
     * @param {ObjectFunction} listener 
     */
    constructor(listener = null) {
        
        super();

        /** @type {ObjectFunction} */
        this.listener = listener;

        /** @type {Map} */
        this.testMap = new Map();

        /** @type {List} */
        this.successTestMap = new List();

        /** @type {List} */
        this.failTestMap = new List();
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
        this.testMap.set(testClass.name, testClass);
        return this;
    }

    contains(testClass) {
        return this.testMap.contains(testClass.name);
    }

    named(className) {
        this.printHeader(className);

        const testClass = this.testMap.get(className);
        const testObject = new testClass();

        /** @type {List} */
        const testFunctions = testClass.testFunctions();

        testFunctions.forEach((value, parent) => {
            /** @type {Function} */
            const testFunction = value;
            try {
                testFunction.call(testObject);
                this.successTestMap.add(testClass.name + "." + testFunction.name + "()");
            } catch (exception) {
                LOG.error("Test: " + testClass.name + "." + testFunction.name + "() failed. Reason:");
                LOG.error(exception);
                LOG.error("");
                this.failTestMap.add(testClass.name + "." + testFunction.name + "()");
            }
            return true;
        });
    }

    /**
     * Run test by class name
     * @param {string} className 
     */
    runSingle(className) {
        Logger.listener = this.listener;
        this.named(className);
        this.printReport();
        this.reset();
        Logger.clearListener();
    }

    /**
     * Run all test classes
     */
    run() {
        Logger.listener = this.listener;
        this.testMap.forEach((key, value, parent) => {
            this.named(key);
            return true;
        });
        this.printReport();
        this.reset();
        Logger.clearListener();
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
        });
        LOG.info("");

        LOG.info("Failed:");
        let failCounter = 0;
        this.failTestMap.forEach((value,parent) => {
            LOG.info(failCounter++ + ". " + value);
        });
        LOG.info("");

        if (this.fails != 0) {
            throw this.failTestMap.size() + "Tests failed";
        }
    }

    reset() {
        this.failTestMap = new List();
        this.successTestMap = new List();
    }
}

export { AssertString, TestBench, TestTrigger };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdGJlbmNoX3YxLmpzIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdGVzdGJlbmNoL2Fzc2VydGlvbnMvYXNzZXJ0U3RyaW5nLmpzIiwiLi4vLi4vc3JjL3Rlc3RiZW5jaC90ZXN0VHJpZ2dlci5qcyIsIi4uLy4uL3NyYy90ZXN0YmVuY2gvdGVzdEJlbmNoLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBjbGFzcyBBc3NlcnRTdHJpbmcge1xyXG5cclxuICAgIHN0YXRpYyBhc3NlcnRFcXVhbHMoZXhwZWN0ZWQsIGFjdHVhbCkge1xyXG4gICAgICAgIGlmIChleHBlY3RlZCA9PT0gYWN0dWFsKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhyb3cgXCJTdHJpbmcgQXNzZXJ0aW9uIEZhaWxlZC4gRXhwZWN0ZWQ6ICdcIiArIGV4cGVjdGVkICsgXCInIEFjdHVhbDogJ1wiICsgYWN0dWFsICsgXCInXCI7XHJcbiAgICB9XHJcblxyXG59IiwiZXhwb3J0IGNsYXNzIFRlc3RUcmlnZ2VyIHtcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgKiBSdW4gdGVzdCBieSBjbGFzcyBuYW1lXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY2xhc3NOYW1lIFxyXG4gICAgICovXHJcbiAgICBydW5TaW5nbGUoY2xhc3NOYW1lKSB7XHJcblxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUnVuIGFsbCB0ZXN0IGNsYXNzZXNcclxuICAgICAqL1xyXG4gICAgcnVuKCkge1xyXG4gICAgICAgIFxyXG4gICAgfVxyXG59IiwiaW1wb3J0IHsgTGlzdCwgTG9nZ2VyLCBNYXAsIE9iamVjdEZ1bmN0aW9uIH0gZnJvbSBcImNvcmV1dGlsX3YxXCI7XHJcbmltcG9ydCB7IFRlc3RUcmlnZ2VyIH0gZnJvbSBcIi4vdGVzdFRyaWdnZXJcIjtcclxuXHJcbmNvbnN0IExPRyA9IG5ldyBMb2dnZXIoXCJUZXN0QmVuY2hcIik7XHJcblxyXG5leHBvcnQgY2xhc3MgVGVzdEJlbmNoIGV4dGVuZHMgVGVzdFRyaWdnZXIge1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdEZ1bmN0aW9ufSBsaXN0ZW5lciBcclxuICAgICAqL1xyXG4gICAgY29uc3RydWN0b3IobGlzdGVuZXIgPSBudWxsKSB7XHJcbiAgICAgICAgXHJcbiAgICAgICAgc3VwZXIoKTtcclxuXHJcbiAgICAgICAgLyoqIEB0eXBlIHtPYmplY3RGdW5jdGlvbn0gKi9cclxuICAgICAgICB0aGlzLmxpc3RlbmVyID0gbGlzdGVuZXI7XHJcblxyXG4gICAgICAgIC8qKiBAdHlwZSB7TWFwfSAqL1xyXG4gICAgICAgIHRoaXMudGVzdE1hcCA9IG5ldyBNYXAoKTtcclxuXHJcbiAgICAgICAgLyoqIEB0eXBlIHtMaXN0fSAqL1xyXG4gICAgICAgIHRoaXMuc3VjY2Vzc1Rlc3RNYXAgPSBuZXcgTGlzdCgpO1xyXG5cclxuICAgICAgICAvKiogQHR5cGUge0xpc3R9ICovXHJcbiAgICAgICAgdGhpcy5mYWlsVGVzdE1hcCA9IG5ldyBMaXN0KCk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSB0ZXN0T2JqZWN0IFxyXG4gICAgICogQHJldHVybnMge1Rlc3RCZW5jaH1cclxuICAgICAqL1xyXG4gICAgYWRkVGVzdCh0ZXN0Q2xhc3MpIHtcclxuICAgICAgICBpZiAoIXRlc3RDbGFzcy50ZXN0RnVuY3Rpb25zIHx8ICEodGVzdENsYXNzLnRlc3RGdW5jdGlvbnMoKSBpbnN0YW5jZW9mIExpc3QpKSB7XHJcbiAgICAgICAgICAgIHRocm93IFwiQSBzdGF0aWMgZnVuY3Rpb24gY2FsbGVkICd0ZXN0RnVuY3Rpb25zJyBtdXN0IGJlIHByb3ZpZGVkIGluIFwiIFxyXG4gICAgICAgICAgICAgICAgKyB0ZXN0Q2xhc3MubmFtZSBcclxuICAgICAgICAgICAgICAgICsgXCIgd2hpY2ggcmV0dXJucyBhIExpc3QgYWxsIHRoZSB0ZXN0IGZ1bmN0aW9ucyBpbiBcIlxyXG4gICAgICAgICAgICAgICAgKyB0ZXN0Q2xhc3MubmFtZSArIFwiLnByb3RvdHlwZVwiXHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMudGVzdE1hcC5zZXQodGVzdENsYXNzLm5hbWUsIHRlc3RDbGFzcyk7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcblxyXG4gICAgY29udGFpbnModGVzdENsYXNzKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMudGVzdE1hcC5jb250YWlucyh0ZXN0Q2xhc3MubmFtZSk7XHJcbiAgICB9XHJcblxyXG4gICAgbmFtZWQoY2xhc3NOYW1lKSB7XHJcbiAgICAgICAgdGhpcy5wcmludEhlYWRlcihjbGFzc05hbWUpO1xyXG5cclxuICAgICAgICBjb25zdCB0ZXN0Q2xhc3MgPSB0aGlzLnRlc3RNYXAuZ2V0KGNsYXNzTmFtZSk7XHJcbiAgICAgICAgY29uc3QgdGVzdE9iamVjdCA9IG5ldyB0ZXN0Q2xhc3MoKTtcclxuXHJcbiAgICAgICAgLyoqIEB0eXBlIHtMaXN0fSAqL1xyXG4gICAgICAgIGNvbnN0IHRlc3RGdW5jdGlvbnMgPSB0ZXN0Q2xhc3MudGVzdEZ1bmN0aW9ucygpO1xyXG5cclxuICAgICAgICB0ZXN0RnVuY3Rpb25zLmZvckVhY2goKHZhbHVlLCBwYXJlbnQpID0+IHtcclxuICAgICAgICAgICAgLyoqIEB0eXBlIHtGdW5jdGlvbn0gKi9cclxuICAgICAgICAgICAgY29uc3QgdGVzdEZ1bmN0aW9uID0gdmFsdWU7XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICB0ZXN0RnVuY3Rpb24uY2FsbCh0ZXN0T2JqZWN0KTtcclxuICAgICAgICAgICAgICAgIHRoaXMuc3VjY2Vzc1Rlc3RNYXAuYWRkKHRlc3RDbGFzcy5uYW1lICsgXCIuXCIgKyB0ZXN0RnVuY3Rpb24ubmFtZSArIFwiKClcIik7XHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKGV4Y2VwdGlvbikge1xyXG4gICAgICAgICAgICAgICAgTE9HLmVycm9yKFwiVGVzdDogXCIgKyB0ZXN0Q2xhc3MubmFtZSArIFwiLlwiICsgdGVzdEZ1bmN0aW9uLm5hbWUgKyBcIigpIGZhaWxlZC4gUmVhc29uOlwiKTtcclxuICAgICAgICAgICAgICAgIExPRy5lcnJvcihleGNlcHRpb24pO1xyXG4gICAgICAgICAgICAgICAgTE9HLmVycm9yKFwiXCIpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5mYWlsVGVzdE1hcC5hZGQodGVzdENsYXNzLm5hbWUgKyBcIi5cIiArIHRlc3RGdW5jdGlvbi5uYW1lICsgXCIoKVwiKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFJ1biB0ZXN0IGJ5IGNsYXNzIG5hbWVcclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBjbGFzc05hbWUgXHJcbiAgICAgKi9cclxuICAgIHJ1blNpbmdsZShjbGFzc05hbWUpIHtcclxuICAgICAgICBMb2dnZXIubGlzdGVuZXIgPSB0aGlzLmxpc3RlbmVyO1xyXG4gICAgICAgIHRoaXMubmFtZWQoY2xhc3NOYW1lKTtcclxuICAgICAgICB0aGlzLnByaW50UmVwb3J0KCk7XHJcbiAgICAgICAgdGhpcy5yZXNldCgpO1xyXG4gICAgICAgIExvZ2dlci5jbGVhckxpc3RlbmVyKCk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSdW4gYWxsIHRlc3QgY2xhc3Nlc1xyXG4gICAgICovXHJcbiAgICBydW4oKSB7XHJcbiAgICAgICAgTG9nZ2VyLmxpc3RlbmVyID0gdGhpcy5saXN0ZW5lcjtcclxuICAgICAgICB0aGlzLnRlc3RNYXAuZm9yRWFjaCgoa2V5LCB2YWx1ZSwgcGFyZW50KSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMubmFtZWQoa2V5KTtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgdGhpcy5wcmludFJlcG9ydCgpO1xyXG4gICAgICAgIHRoaXMucmVzZXQoKTtcclxuICAgICAgICBMb2dnZXIuY2xlYXJMaXN0ZW5lcigpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaW50SGVhZGVyKHRlc3ROYW1lKSB7XHJcbiAgICAgICAgY29uc3QgbGluZSA9IFwiIyAgUnVubmluZyB0ZXN0OiBcIiArIHRlc3ROYW1lICsgXCIgICNcIjtcclxuICAgICAgICBsZXQgZGVjb3JhdGlvbiA9IFwiXCI7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW5lLmxlbmd0aCA7IGkrKykge1xyXG4gICAgICAgICAgICBkZWNvcmF0aW9uID0gZGVjb3JhdGlvbiArIFwiI1wiO1xyXG4gICAgICAgIH1cclxuICAgICAgICBMT0cuaW5mbyhkZWNvcmF0aW9uKTtcclxuICAgICAgICBMT0cuaW5mbyhsaW5lKTtcclxuICAgICAgICBMT0cuaW5mbyhkZWNvcmF0aW9uKTtcclxuICAgICAgICBMT0cuaW5mbyhcIlwiKTtcclxuICAgIH1cclxuXHJcbiAgICBwcmludFJlcG9ydCgpIHtcclxuICAgICAgICBMT0cuaW5mbyhcIiMjIyMjIyMjIyMjIyMjIyMjIyNcIik7XHJcbiAgICAgICAgTE9HLmluZm8oXCIjICAgVGVzdCBSZXBvcnQgICAjXCIpO1xyXG4gICAgICAgIExPRy5pbmZvKFwiIyMjIyMjIyMjIyMjIyMjIyMjI1wiKTtcclxuICAgICAgICBMT0cuaW5mbyhcIlwiKTtcclxuXHJcbiAgICAgICAgTE9HLmluZm8oXCJTdWNjZWVkZWQ6XCIpO1xyXG4gICAgICAgIGxldCBzdWNjZXNzQ291bnRlciA9IDA7XHJcbiAgICAgICAgdGhpcy5zdWNjZXNzVGVzdE1hcC5mb3JFYWNoKCh2YWx1ZSxwYXJlbnQpID0+IHtcclxuICAgICAgICAgICAgTE9HLmluZm8oc3VjY2Vzc0NvdW50ZXIrKyArIFwiLiBcIiArIHZhbHVlKTtcclxuICAgICAgICB9KTtcclxuICAgICAgICBMT0cuaW5mbyhcIlwiKTtcclxuXHJcbiAgICAgICAgTE9HLmluZm8oXCJGYWlsZWQ6XCIpO1xyXG4gICAgICAgIGxldCBmYWlsQ291bnRlciA9IDA7XHJcbiAgICAgICAgdGhpcy5mYWlsVGVzdE1hcC5mb3JFYWNoKCh2YWx1ZSxwYXJlbnQpID0+IHtcclxuICAgICAgICAgICAgTE9HLmluZm8oZmFpbENvdW50ZXIrKyArIFwiLiBcIiArIHZhbHVlKTtcclxuICAgICAgICB9KTtcclxuICAgICAgICBMT0cuaW5mbyhcIlwiKTtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuZmFpbHMgIT0gMCkge1xyXG4gICAgICAgICAgICB0aHJvdyB0aGlzLmZhaWxUZXN0TWFwLnNpemUoKSArIFwiVGVzdHMgZmFpbGVkXCI7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHJlc2V0KCkge1xyXG4gICAgICAgIHRoaXMuZmFpbFRlc3RNYXAgPSBuZXcgTGlzdCgpO1xyXG4gICAgICAgIHRoaXMuc3VjY2Vzc1Rlc3RNYXAgPSBuZXcgTGlzdCgpO1xyXG4gICAgfVxyXG59Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQU8sTUFBTSxZQUFZLENBQUM7QUFDMUI7QUFDQSxJQUFJLE9BQU8sWUFBWSxDQUFDLFFBQVEsRUFBRSxNQUFNLEVBQUU7QUFDMUMsUUFBUSxJQUFJLFFBQVEsS0FBSyxNQUFNLEVBQUU7QUFDakMsWUFBWSxPQUFPO0FBQ25CLFNBQVM7QUFDVCxRQUFRLE1BQU0sc0NBQXNDLEdBQUcsUUFBUSxHQUFHLGFBQWEsR0FBRyxNQUFNLEdBQUcsR0FBRyxDQUFDO0FBQy9GLEtBQUs7QUFDTDtBQUNBOztBQ1RPLE1BQU0sV0FBVyxDQUFDO0FBQ3pCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFJLFNBQVMsQ0FBQyxTQUFTLEVBQUU7QUFDekI7QUFDQSxLQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFJLEdBQUcsR0FBRztBQUNWO0FBQ0EsS0FB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
