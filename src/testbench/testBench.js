import { List, Logger, Map, ObjectFunction } from "coreutil_v1";
import { TestClassResult } from "./testClassResult";
import { TestTrigger } from "./testTrigger";

const LOG = new Logger("TestBench");

export class TestBench extends TestTrigger {

    /**
     * 
     * @param {ObjectFunction} logListener 
     * @param {ObjectFunction} resultListener 
     */
    constructor(logListener = null, resultListener = null) {
        
        super();

        /** @type {ObjectFunction} */
        this.logListener = logListener;

        /** @type {ObjectFunction} */
        this.resultListener = resultListener;

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
        this.named(className);
        try {
            this.printReport();
        } finally {
            this.reset();
            Logger.clearListener();
        }
    }

    /**
     * Run all test classes
     */
    run() {
        Logger.listener = this.logListener;
        this.testMap.forEach((key, value, parent) => {
            this.named(key);
            return true;
        });
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